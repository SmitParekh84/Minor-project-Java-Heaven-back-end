import express from "express";
import bcrypt from "bcrypt";
import User from "../models/User.js"; // Assuming User model is defined in this path
import { v4 as uuidv4 } from "uuid"; // Import UUID for generating session IDs

const router = express.Router();

// Login a user
// auth.js
router.post("/login", async (req, res) => {
    const { email, password, mobno, username } = req.body;

    // Validate that at least one identifier is provided
    if (!email && !mobno && !username) {
        return res.status(400).json({ msg: "Email, mobile number, or username is required" });
    }

    try {
        // Create a query to find the user by email, mobile number, or username
        const query = email ? { email } : mobno ? { mobno } : { username };

        // Check if the user exists
        const user = await User.findOne(query);
        if (!user) {
            return res.status(400).json({ msg: "Invalid credentials" });
        }

        // Validate password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: "Invalid credentials" });
        }

        const sessionId = uuidv4(); // Generate a new session ID

        // Send session ID and user info (username and email)
        res.status(200).json({
            msg: "Login successful",
            sessionId,
            user: {
                username: user.username,
                email: user.email,
            },
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server error");
    }
});


// Logout user and destroy the session
router.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ msg: "Logout failed" });
        }
        res.status(200).json({ msg: "Logout successful" });
    });
});

export default router;
