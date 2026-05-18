import express from 'express';
import Item from '../models/Item.js';
import Order from '../models/Order.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { ORDER_STATUS } from '../constants/orderStatus.js';

const router = express.Router();

// GET /api/stock/available-stock — public read
router.get('/available-stock', asyncHandler(async (req, res) => {
  const items = await Item.find().select('name stock');
  const availableStock = items.map((item) => ({ name: item.name, stock: item.stock }));
  return res.status(200).json({ success: true, availableStock });
}));

// POST /api/stock/check-stock — public pre-flight check; read-only
router.post('/check-stock', asyncHandler(async (req, res) => {
  const { cartItems } = req.body;

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ success: false, msg: 'cartItems must be a non-empty array' });
  }

  for (const cartItem of cartItems) {
    const { productId, quantity } = cartItem;
    if (!productId || !quantity) {
      return res.status(400).json({ success: false, msg: 'Each cartItem must have productId and quantity' });
    }

    const item = await Item.findById(productId);
    if (!item) {
      return res.status(404).json({ success: false, msg: `Item ${productId} not found` });
    }

    if (item.stock < quantity) {
      return res.status(400).json({
        success: false,
        msg: `Insufficient stock for "${item.name}". Available: ${item.stock}, requested: ${quantity}.`,
      });
    }
  }

  return res.status(200).json({ success: true });
}));

// POST /api/stock/update-stock — admin only; atomic update via findOneAndUpdate
router.post('/update-stock', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { orderId } = req.body;

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ success: false, msg: 'Order not found' });

  if (order.status !== ORDER_STATUS.DELIVERED) {
    return res.status(400).json({ success: false, msg: 'Order is not delivered yet' });
  }

  const decremented = [];
  for (const orderItem of order.items) {
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
        msg: `Insufficient stock for item ${orderItem.productId}`,
      });
    }
    decremented.push({ productId: orderItem.productId, quantity: orderItem.quantity });
  }

  return res.status(200).json({ success: true, msg: 'Stock updated successfully' });
}));

// PUT /api/stock/update-stock/:itemId — admin only
router.put('/update-stock/:itemId', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { stock } = req.body;

  if (stock === undefined || stock < 0) {
    return res.status(400).json({ success: false, msg: 'stock must be a non-negative number' });
  }

  const item = await Item.findByIdAndUpdate(itemId, { stock }, { new: true });
  if (!item) return res.status(404).json({ success: false, msg: 'Item not found' });

  return res.status(200).json({ success: true, msg: 'Stock updated successfully', item });
}));

export default router;
