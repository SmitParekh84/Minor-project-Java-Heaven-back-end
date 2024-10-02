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

// New route to get all orders for admin
// New route to get all orders for admin
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
// Assuming you want to fetch the best-selling item separately
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
      return res.status(404).json({ message: 'No best-selling item found' });
    }

    res.json({ bestSellingItem: bestSellingItems[0] });
  } catch (err) {
    console.error("Error fetching best-selling item:", err);
    res.status(500).json({ message: 'Server error' });
  }
});


export default router; // Use ES6 export for consistency
