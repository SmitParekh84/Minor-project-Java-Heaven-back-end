import express from "express";
import User from "../models/User.js"; // Assuming you have a User model
import Order from "../models/Order.js"; // Assuming you have an Order model for creating orders

const router = express.Router();

// Middleware for validating cart items input
const validateCartItem = (req, res, next) => {
    const { id, name, price, quantity } = req.body;
    if (!id || !name || !price || typeof quantity !== 'number') {
        return res.status(400).json({ error: "Invalid cart item data" });
    }
    next();
};

// Get all cart items for a user
router.get("/users/:userId/cart", async (req, res) => {
    const { userId } = req.body;
    console.log("User ID:", userId);
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({ cart: user.cartItems || [] });
    } catch (err) {
        console.error("Error fetching cart items:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
    }
});

// Add an item to the user's cart
router.post("/users/:userId/cart", validateCartItem, async (req, res) => {
    const { userId } = req.body;
    const { id, name, price, size, quantity } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Check if the item already exists in the user's cart
        const existingItemIndex = user.cartItems.findIndex(
            (item) => item.id === id && item.size === size
        );

        if (existingItemIndex >= 0) {
            // Update quantity if the item exists
            user.cartItems[existingItemIndex].quantity += quantity;
        } else {
            // Add new item to the cart
            user.cartItems.push({ id, name, price, size, quantity });
        }

        await user.save();
        return res.status(201).json({ message: "Item added to cart", cart: user.cartItems });
    } catch (err) {
        console.error("Error adding item to cart:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
    }
});

// Update quantity of an item in the cart
router.put("/users/:userId/cart/:itemId", async (req, res) => {
    const { userId, itemId } = req.body;
    const { size, quantity } = req.body;

    if (typeof quantity !== "number" || quantity < 1) {
        return res.status(400).json({ error: "Invalid quantity" });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const itemIndex = user.cartItems.findIndex(
            (item) => item.id === itemId && item.size === size
        );

        if (itemIndex === -1) {
            return res.status(404).json({ error: "Item not found in cart" });
        }

        user.cartItems[itemIndex].quantity = quantity;
        await user.save();
        return res.status(200).json({ message: "Item quantity updated", cart: user.cartItems });
    } catch (err) {
        console.error("Error updating cart item:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
    }
});

// Remove an item from the cart
router.delete("/users/:userId/cart/:itemId", async (req, res) => {
    const { userId, itemId } = req.body;
    const { size } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const updatedCartItems = user.cartItems.filter(
            (item) => !(item.id === itemId && item.size === size)
        );

        if (updatedCartItems.length === user.cartItems.length) {
            return res.status(404).json({ error: "Item not found in cart" });
        }

        user.cartItems = updatedCartItems;
        await user.save();
        return res.status(200).json({ message: "Item removed from cart", cart: user.cartItems });
    } catch (err) {
        console.error("Error removing item from cart:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
    }
});

// Clear all items from the user's cart
router.delete("/users/:userId/cart", async (req, res) => {
    const { userId } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        user.cartItems = [];
        await user.save();
        return res.status(200).json({ message: "Cart cleared", cart: user.cartItems });
    } catch (err) {
        console.error("Error clearing cart:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
    }
});

export default router;
