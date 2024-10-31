import express from "express";
import User from "../models/User.js";

const router = express.Router();

// Endpoint to update the user's cart in the database
router.post("/users/cart", async (req, res) => {
    const { userId, cartItems } = req.body;

    // Check if the userId and cartItems are provided
    if (!userId || !cartItems) {
        return res.status(400).json({ error: "User ID and cart items are required" });
    }

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        // Update user cart with cart items received from the request
        user.cartItems = cartItems; // directly use cartItems from request
        await user.save();
        return res.status(200).json({ message: "Cart updated", cart: user.cartItems });
    } catch (err) {
        console.error("Error updating cart:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
    }
});

// Endpoint to get the user's cart
router.get("/users/cart/:userId", async (req, res) => {
    const { userId } = req.params;

    // Check if the userId is provided
    if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
    }

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        // Return the user's cart items
        return res.status(200).json({ cart: user.cartItems });
    } catch (err) {
        console.error("Error retrieving cart:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
    }
});


export default router;
