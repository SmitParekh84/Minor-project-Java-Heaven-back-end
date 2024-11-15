import express from "express";
import Order from "../models/Order.js";
import Item from "../models/Item.js";
import dotenv from "dotenv"
import Stripe from 'stripe';


dotenv.config()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

// Input validation middleware for creating an order
const validateOrder = (req, res, next) => {
  const { userId, cartItems } = req.body;
  if (!userId || !cartItems || !Array.isArray(cartItems)) {
    return res.status(400).json({ error: "Invalid request data" });
  }

  for (const item of cartItems) {
    if (!item.id || !item.name || !item.price || !item.quantity) {
      return res.status(400).json({ error: "Each cart item must have id, name, price, and quantity" });
    }
  }

  next();
};
// Route for creating Stripe checkout session
// In your backend code
// In your backend code
router.post("/create-checkout-session", async (req, res) => {
  const { cartItems, successUrl, cancelUrl, address } = req.body;

  try {
    const lineItems = cartItems.map(item => ({
      price_data: {
        currency: 'inr',
        product_data: { name: item.name },
        unit_amount: item.price * 100,
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`, // Add session_id in success URL
      cancel_url: cancelUrl,
      metadata: {
        userId: req.body.userId, // Pass the user ID
        cartItems: JSON.stringify(req.body.cartItems), // Convert cart items to JSON string
        deliveryOption: req.body.deliveryOption,
        address: address || "",
      },
    });

    res.status(200).json({ id: session.id, url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});
router.get("/verify-payment-session", async (req, res) => {
  const { session_id } = req.query;

  if (!session_id) {
    return res.status(400).json({ error: "Missing session_id in query" });
  }

  try {
    // Fetch the session from Stripe to verify the payment
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Check if the payment was successful
    if (session.payment_status === "paid") {
      res.status(200).json(session);
    } else {
      res.status(400).json({ error: "Payment not completed" });
    }
  } catch (error) {
    console.error("Error verifying payment session:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

router.post("/orders", validateOrder, async (req, res) => {
  const { userId, cartItems, deliveryOption, address } = req.body; // Destructure deliveryOption and address

  try {
    // Calculate total amount
    let totalAmount = 0;
    const parsedCartItems = typeof cartItems === "string" ? JSON.parse(cartItems) : cartItems;
    const orderItems = parsedCartItems.map((item) => {
      const subtotal = item.price * item.quantity;
      totalAmount += subtotal;
      return {
        productId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        size: item.size,
        subtotal: subtotal,
      };
    });
    console.log("Address:", address);

    // Create new order with delivery option and address
    const newOrder = new Order({
      userId,
      items: orderItems,

      totalAmount,
      deliveryOption, // Add delivery option
      address: deliveryOption === "home" ? address : "", // Add address if home delivery
    });

    // Save order to the database
    await newOrder.save();
    // Deduct stock for each item in the order
    for (const orderItem of orderItems) {
      const item = await Item.findById(orderItem.productId);  // Find the item in the Item collection
      if (item) {
        // Decrease stock based on quantity in the order
        item.stock -= orderItem.quantity;
        // Ensure stock doesn't go below 0
        if (item.stock < 0) item.stock = 0;
        await item.save(); // Save updated item
      }
    }
    return res.status(201).json({
      message: "Order placed successfully",
      order: newOrder,
    });
  } catch (err) {
    console.error("Error creating order:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});


// Get list of orders for a particular user
router.get("/orders/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const orders = await Order.find({ userId });

    if (!orders.length) {
      return res.status(404).json({ message: "No orders found for this user" });
    }

    return res.status(200).json({ orders });
  } catch (err) {
    console.error("Error fetching orders:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// Get all orders for admin
router.get("/admin/orders", async (req, res) => {
  try {
    const orders = await Order.find().populate('userId', 'email mobile'); // Populate email and mobile

    if (!orders.length) {
      return res.status(404).json({ message: "No orders found" });
    }

    return res.status(200).json({ orders });
  } catch (err) {
    console.error("Error fetching all orders:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// Update order status
router.put("/orders/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // Expecting { status: "Pending", "Delivered", or "Cancelled" }

  if (!["Pending", "Delivered", "Cancelled"].includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    return res.status(200).json({
      message: "Order status updated successfully",
      order: updatedOrder,
    });
  } catch (err) {
    console.error("Error updating order status:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// Calculate total revenue and best-selling item
router.get("/admin/revenue", async (req, res) => {
  try {
    const orders = await Order.find();

    // Calculate total revenue and best-selling items
    let totalRevenue = 0;
    const itemSales = {};

    orders.forEach((order) => {
      totalRevenue += order.totalAmount; // Summing up total revenue

      order.items.forEach((item) => {
        if (itemSales[item.productId]) {
          itemSales[item.productId].quantity += item.quantity; // Update quantity sold
        } else {
          itemSales[item.productId] = {
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          };
        }
      });
    });

    // Find best-selling item
    const bestSellingItem = Object.keys(itemSales).reduce((max, key) =>
      itemSales[key].quantity > (max.quantity || 0) ? itemSales[key] : max
      , {});

    return res.status(200).json({
      totalRevenue,
      bestSellingItem,
    });
  } catch (err) {
    console.error("Error calculating revenue:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// Get the best-selling item
router.get('/best-selling', async (req, res) => {
  try {
    const bestSellingItems = await Order.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          totalSold: { $sum: '$items.quantity' },
          name: { $first: '$items.name' },
          price: { $first: '$items.price' } // Ensure you include price if needed
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 1 } // Get only the best-selling item
    ]);

    if (bestSellingItems.length === 0) {
      return res.status(404).json({ message: 'No best selling item found' });
    }

    res.status(200).json({ bestSellingItem: bestSellingItems[0] });
  } catch (err) {
    console.error("Error fetching best-selling item:", err);
    res.status(500).json({ message: 'Server error', details: err.message });
  }
});

export default router; // Use ES6 export for consistency
