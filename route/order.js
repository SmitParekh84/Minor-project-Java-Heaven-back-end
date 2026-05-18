import express from 'express';
import Stripe from 'stripe';
import Order from '../models/Order.js';
import Item from '../models/Item.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { ORDER_STATUS, DELIVERY_OPTION } from '../constants/orderStatus.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

// POST /api/create-checkout-session
// Prices are always fetched from the DB — never trusted from the client
router.post('/create-checkout-session', authenticate, asyncHandler(async (req, res) => {
  const { cartItems, successUrl, cancelUrl, address, deliveryOption } = req.body;

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ success: false, msg: 'cartItems must be a non-empty array' });
  }

  // Fetch canonical prices from DB
  const lineItems = [];
  for (const cartItem of cartItems) {
    if (!cartItem.id || !cartItem.quantity || cartItem.quantity < 1) {
      return res.status(400).json({ success: false, msg: 'Each cart item must have id and quantity >= 1' });
    }
    const dbItem = await Item.findById(cartItem.id);
    if (!dbItem) {
      return res.status(404).json({ success: false, msg: `Item ${cartItem.id} not found` });
    }
    lineItems.push({
      price_data: {
        currency: 'inr',
        product_data: { name: dbItem.name },
        unit_amount: Math.round(dbItem.price * 100), // DB price, not client price
      },
      quantity: cartItem.quantity,
    });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: {
      userId: req.user.userId.toString(), // from verified JWT, not request body
      cartItems: JSON.stringify(cartItems.map((i) => ({ id: i.id, quantity: i.quantity, size: i.size || '' }))),
      deliveryOption: deliveryOption || DELIVERY_OPTION.HAND,
      address: address || '',
    },
  });

  res.status(200).json({ success: true, id: session.id, url: session.url });
}));

// GET /api/verify-payment-session
router.get('/verify-payment-session', authenticate, asyncHandler(async (req, res) => {
  const { session_id } = req.query;

  if (!session_id) {
    return res.status(400).json({ success: false, msg: 'Missing session_id' });
  }

  const session = await stripe.checkout.sessions.retrieve(session_id);

  if (session.payment_status !== 'paid') {
    return res.status(400).json({ success: false, msg: 'Payment not completed' });
  }

  res.status(200).json({ success: true, session });
}));

// POST /api/stripe-webhook — verifies Stripe-Signature; raw body required (set in server.js)
router.post('/stripe-webhook', asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return res.status(400).json({ success: false, msg: 'Missing Stripe-Signature header' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ success: false, msg: `Webhook signature verification failed: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.payment_status === 'paid') {
      await fulfillOrder(session);
    }
  }

  res.status(200).json({ received: true });
}));

async function fulfillOrder(session) {
  const { userId, cartItems: cartItemsJson, deliveryOption, address } = session.metadata;

  let parsedCartItems;
  try {
    parsedCartItems = JSON.parse(cartItemsJson);
  } catch {
    console.error('Webhook: failed to parse cartItems metadata');
    return;
  }

  // Recompute total from DB prices
  let totalAmount = 0;
  const orderItems = [];
  for (const cartItem of parsedCartItems) {
    const dbItem = await Item.findById(cartItem.id);
    if (!dbItem) continue;
    const subtotal = dbItem.price * cartItem.quantity;
    totalAmount += subtotal;
    orderItems.push({
      productId: cartItem.id,
      name: dbItem.name,
      price: dbItem.price,
      quantity: cartItem.quantity,
      size: cartItem.size || 'Regular',
      subtotal,
    });
  }

  // Atomically deduct stock — if any item is insufficient, compensate and abort
  const decremented = [];
  for (const orderItem of orderItems) {
    const updated = await Item.findOneAndUpdate(
      { _id: orderItem.productId, stock: { $gte: orderItem.quantity } },
      { $inc: { stock: -orderItem.quantity } },
      { new: true }
    );
    if (!updated) {
      // Compensate already-decremented items
      for (const d of decremented) {
        await Item.findByIdAndUpdate(d.productId, { $inc: { stock: d.quantity } });
      }
      console.error(`Webhook fulfillOrder: insufficient stock for ${orderItem.productId}`);
      return;
    }
    decremented.push({ productId: orderItem.productId, quantity: orderItem.quantity });
  }

  const newOrder = new Order({
    userId,
    items: orderItems,
    totalAmount,
    deliveryOption: deliveryOption || DELIVERY_OPTION.HAND,
    address: deliveryOption === DELIVERY_OPTION.HOME ? address : '',
    status: ORDER_STATUS.PENDING,
  });

  await newOrder.save();
}

// POST /api/orders — direct order creation (non-Stripe flow); auth required
router.post('/orders', authenticate, asyncHandler(async (req, res) => {
  const { cartItems, deliveryOption, address } = req.body;
  const userId = req.user.userId; // always from token

  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ success: false, msg: 'cartItems must be a non-empty array' });
  }
  if (!deliveryOption) {
    return res.status(400).json({ success: false, msg: 'deliveryOption is required' });
  }

  // Recompute total from DB prices
  let totalAmount = 0;
  const orderItems = [];
  for (const item of cartItems) {
    if (!item.id || !item.quantity) {
      return res.status(400).json({ success: false, msg: 'Each item must have id and quantity' });
    }
    const dbItem = await Item.findById(item.id);
    if (!dbItem) {
      return res.status(404).json({ success: false, msg: `Item ${item.id} not found` });
    }
    const subtotal = dbItem.price * item.quantity;
    totalAmount += subtotal;
    orderItems.push({
      productId: item.id,
      name: dbItem.name,
      price: dbItem.price,
      quantity: item.quantity,
      size: item.size || 'Regular',
      subtotal,
    });
  }

  // Atomic stock decrement with compensation on failure
  const decremented = [];
  for (const orderItem of orderItems) {
    const updated = await Item.findOneAndUpdate(
      { _id: orderItem.productId, stock: { $gte: orderItem.quantity } },
      { $inc: { stock: -orderItem.quantity } },
      { new: true }
    );
    if (!updated) {
      for (const d of decremented) {
        await Item.findByIdAndUpdate(d.productId, { $inc: { stock: d.quantity } });
      }
      return res.status(400).json({
        success: false,
        msg: `Insufficient stock for "${orderItem.name}". Please adjust your order.`,
      });
    }
    decremented.push({ productId: orderItem.productId, quantity: orderItem.quantity });
  }

  const newOrder = new Order({
    userId,
    items: orderItems,
    totalAmount,
    deliveryOption,
    address: deliveryOption === DELIVERY_OPTION.HOME ? address : '',
  });

  await newOrder.save();

  return res.status(201).json({ success: true, msg: 'Order placed successfully', order: newOrder });
}));

// GET /api/orders/:userId — enforces ownership
router.get('/orders/:userId', authenticate, asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (req.user.userId.toString() !== userId.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, msg: 'Forbidden' });
  }

  const orders = await Order.find({ userId });
  if (!orders.length) {
    return res.status(404).json({ success: false, msg: 'No orders found for this user' });
  }

  return res.status(200).json({ success: true, orders });
}));

// GET /api/admin/orders — admin only
router.get('/admin/orders', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const orders = await Order.find().populate('userId', 'email mobno');
  return res.status(200).json({ success: true, orders });
}));

// PUT /api/orders/:id/status — admin only
router.put('/orders/:id/status', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!Object.values(ORDER_STATUS).includes(status)) {
    return res.status(400).json({ success: false, msg: 'Invalid status value' });
  }

  const updatedOrder = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!updatedOrder) {
    return res.status(404).json({ success: false, msg: 'Order not found' });
  }

  return res.status(200).json({ success: true, msg: 'Order status updated', order: updatedOrder });
}));

// GET /api/admin/revenue
router.get('/admin/revenue', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const orders = await Order.find({ status: ORDER_STATUS.DELIVERED });

  let totalRevenue = 0;
  const itemSales = {};

  for (const order of orders) {
    totalRevenue += order.totalAmount;
    for (const item of order.items) {
      if (itemSales[item.productId]) {
        itemSales[item.productId].quantity += item.quantity;
      } else {
        itemSales[item.productId] = { name: item.name, price: item.price, quantity: item.quantity };
      }
    }
  }

  const bestSellingItem = Object.values(itemSales).reduce(
    (max, item) => (item.quantity > (max.quantity || 0) ? item : max),
    {}
  );

  return res.status(200).json({ success: true, totalRevenue, bestSellingItem });
}));

// GET /api/best-selling — public
router.get('/best-selling', asyncHandler(async (req, res) => {
  const bestSellingItems = await Order.aggregate([
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        totalSold: { $sum: '$items.quantity' },
        name: { $first: '$items.name' },
        price: { $first: '$items.price' },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 1 },
  ]);

  if (!bestSellingItems.length) {
    return res.status(404).json({ success: false, msg: 'No best-selling item found' });
  }

  res.status(200).json({ success: true, bestSellingItem: bestSellingItems[0] });
}));

export default router;
