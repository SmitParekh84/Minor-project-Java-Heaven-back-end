import express from "express";
import User from "../models/User.js"; // Adjust the import path if necessary
import mongoose from "mongoose"; // Import mongoose for ID validation

const router = express.Router();

// GET route to fetch user by ID
router.get("/users/:userId", async (req, res) => {
    const userId = req.params.userId; // Get the userId from the request parameters

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: "Invalid user ID format" });
    }

    try {
        const user = await User.findById(userId); // Find the user in the database

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" }); // Handle user not found
        }

        res.json({ success: true, user }); // Return user details
    } catch (err) {
        console.error("Error fetching user:", err.message);
        res.status(500).json({ success: false, message: "Server error", details: err.message }); // Handle server errors
    }
});
// GET route to fetch user's cart
router.get("/users/:userId/cart", async (req, res) => {
    const userId = req.params.userId; // Get the userId from the request parameters

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: "Invalid user ID format" });
    }

    try {
        const user = await User.findById(userId).populate("cart.itemId", "name price"); // Populate cart with item details (optional)

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({ success: true, cart: user.cart });
    } catch (err) {
        console.error("Error fetching cart:", err.message);
        res.status(500).json({ success: false, message: "Server error", details: err.message });
    }
});

// POST route to add item to user's cart
router.post("/users/:userId/cart", async (req, res) => {
    const userId = req.params.userId; // Get the userId from the request parameters
    const { itemId, size, quantity = 1 } = req.body; // Destructure itemId, size, and quantity from the request body

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: "Invalid user ID format" });
    }

    // Validate itemId and size
    if (!itemId || !size) {
        return res.status(400).json({ success: false, message: "Item ID and size are required" });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Check if the item already exists in the cart
        const existingItemIndex = user.cart.findIndex(item => item.itemId.toString() === itemId && item.size === size);

        if (existingItemIndex > -1) {
            // Item already exists, update quantity
            user.cart[existingItemIndex].quantity += quantity;
        } else {
            // Add new item to the cart
            user.cart.push({ itemId, size, quantity });
        }

        // Save the updated user
        await user.save();

        res.json({ success: true, message: "Item added to cart successfully!", cart: user.cart });
    } catch (err) {
        console.error("Error adding item to cart:", err.message);
        res.status(500).json({ success: false, message: "Server error", details: err.message });
    }
});

// PUT route to update user address
router.put("/users/:userId/address", async (req, res) => {
    const userId = req.params.userId; // Get the userId from the request parameters
    const { address } = req.body; // Destructure the address from the request body

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: "Invalid user ID format" });
    }

    // Validate address (modify validation as per your requirements)
    if (!address || typeof address !== "string") {
        return res.status(400).json({ success: false, message: "Valid address is required" });
    }

    try {
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { address }, // Update the address
            { new: true } // Return the updated user
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: "User not found" }); // Handle user not found
        }

        res.json({ success: true, user: updatedUser }); // Return updated user details
    } catch (err) {
        console.error("Error updating user address:", err.message);
        res.status(500).json({ success: false, message: "Server error", details: err.message }); // Handle server errors
    }
});

export default router;
