import express from 'express';
import Item from '../models/Item.js';  // Assuming Item model is in models/Item.js
import Order from '../models/Order.js';  // Assuming Order model is in models/Order.js

const router = express.Router();

// Route to update stock when an order is placed and delivered
router.post("/update-stock", async (req, res) => {
    const { orderId } = req.body;

    try {
        // Find the order by its ID
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Check if the order is delivered
        if (order.status !== 'Delivered') {
            return res.status(400).json({ message: "Order is not delivered yet" });
        }

        // Loop through each item in the order and update stock
        for (const orderItem of order.items) {
            const { productId, quantity } = orderItem;

            // Find the item in the Item model
            const item = await Item.findById(productId);
            if (!item) {
                return res.status(404).json({ message: `Item with ID ${productId} not found` });
            }

            // Ensure there is enough stock to fulfill the order
            if (item.stock < quantity) {
                return res.status(400).json({
                    message: `Not enough stock for item: ${item.name}, available: ${item.stock}, required: ${quantity}`,
                });
            }

            // Update the stock by subtracting the ordered quantity
            item.stock -= quantity;
            await item.save();
        }

        return res.status(200).json({ message: "Stock updated successfully" });
    } catch (err) {
        console.error("Error updating stock:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
    }
});
// Route to get available stock for all items
router.get("/available-stock", async (req, res) => {
    try {
        // Fetch all items from the database
        const items = await Item.find();

        // Create an array to hold the available stock for each item
        const availableStock = items.map(item => ({
            name: item.name,
            stock: item.stock
        }));

        return res.status(200).json({ availableStock });
    } catch (err) {
        console.error("Error fetching available stock:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
    }
});

// Route to update stock (PUT)
router.put("/update-stock/:itemId", async (req, res) => {
    const { itemId } = req.params; // Item ID passed as a parameter
    const { stock } = req.body; // New stock value to be updated

    try {
        // Find the item by its ID
        const item = await Item.findById(itemId);
        if (!item) {
            return res.status(404).json({ message: `Item with ID ${itemId} not found` });
        }

        // Update the stock value
        item.stock = stock;

        // Save the updated item to the database
        await item.save();

        return res.status(200).json({ message: "Stock updated successfully", item });
    } catch (err) {
        console.error("Error updating stock:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
    }
});
export default router;
