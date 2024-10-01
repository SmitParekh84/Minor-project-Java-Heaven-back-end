import express from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order';

const router = express.Router();

// Checkout route
router.post('/checkout', async (req, res) => {
  const { userId, cartItems } = req.body;

  try {
    // Calculate total amount
    let totalAmount = 0;
    const orderItems = cartItems.map(item => {
      const subtotal = item.price * item.quantity;
      totalAmount += subtotal;
      return {
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        size: item.size,
        subtotal: subtotal,
      };
    });

    // Create a new order
    const newOrder = new Order({
      userId,
      items: orderItems,
      totalAmount,
    });

    await newOrder.save();

    return res.status(201).json({
      message: 'Order placed successfully',
      order: newOrder,
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
