// routes/order.js
import express from "express";
import Order from "../models/Order.js";

const router = express.Router();

// Order route
// Create a new order
router.post("/orders", async (req, res) => {
  const { userId, cartItems } = req.body;

  // Validate request data
  if (!userId || !cartItems || !Array.isArray(cartItems)) {
    return res.status(400).json({ error: "Invalid request data" });
  }

  try {
    // Calculate total amount
    let totalAmount = 0;
    const orderItems = cartItems.map((item) => {
      const subtotal = item.price * item.quantity;
      totalAmount += subtotal;
      return {
        productId: item.id,  // Use item.productId if that's the field in your cart item
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        size: item.size,
        subtotal: subtotal,
      };
    });

    // Create new order
    const newOrder = new Order({
      userId,
      items: orderItems,
      totalAmount,
    });

    // Save order to the database
    await newOrder.save();

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

export default router; // Use ES6 export for consistency
