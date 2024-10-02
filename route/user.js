// route/user.js
import express from "express";
import User from "../models/User.js"; // Adjust the import path if necessary

const router = express.Router();

// GET route to fetch user by ID
router.get("/users/:userId", async (req, res) => {
    try {
        const userId = req.params.userId; // Get the userId from the request parameters
        const user = await User.findById(userId); // Find the user in the database

        if (!user) {
            return res.status(404).json({ message: "User not found" }); // Handle user not found
        }

        res.json(user); // Return user details
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message }); // Handle server errors
    }
});

export default router;
