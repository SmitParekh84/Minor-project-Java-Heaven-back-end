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
