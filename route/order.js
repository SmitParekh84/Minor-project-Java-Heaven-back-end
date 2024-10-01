import express from "express"
import mongoose from "mongoose"
import Order from "../models/Order.js"

const router = express.Router()

// Order route
router.post("/orders", async (req, res) => {
  const { userId, cartItems } = req.body

  if (!userId || !cartItems || !Array.isArray(cartItems)) {
    return res.status(400).json({ error: "Invalid request data" })
  }

  try {
    // Calculate total amount
    let totalAmount = 0
    const orderItems = cartItems.map((item) => {
      const subtotal = item.price * item.quantity
      totalAmount += subtotal
      return {
        productId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        size: item.size,
        subtotal: subtotal,
      }
    })

    const newOrder = new Order({
      userId,
      items: orderItems,
      totalAmount,
    })

    await newOrder.save()

    return res.status(201).json({
      message: "Order placed successfully",
      order: newOrder,
    })
  } catch (err) {
    console.error("Error creating order:", err)
    return res.status(500).json({ error: "Server error", details: err.message })
  }
})

export default router // Use ES6 export for consistency
