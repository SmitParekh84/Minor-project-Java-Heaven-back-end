import express from "express";
import bcrypt from "bcrypt";
import User from "../models/User.js"; // Assuming User model is defined in this path
import { v4 as uuidv4 } from "uuid"; // Import UUID for generating session IDs
import { body, validationResult } from "express-validator"; // For input validation
import jwt from 'jsonwebtoken';
import rateLimit from "express-rate-limit";
const router = express.Router();




const loginLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 login attempts per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers

    handler: (req, res) => {
        const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000) || 60; // Default to 60 seconds if undefined

        res.status(429).json({
            msg: `Too many login attempts. Please try again after ${retryAfter} seconds.`
        });
    }
});


// Login Route
router.post("/login", loginLimiter, async (req, res) => {
    const { identifier, password } = req.body;

    // Validate input
    if (!identifier || !password) {
        return res.status(400).json({ msg: "Identifier and password are required" });
    }

    try {
        // Query to find the user
        const query = {
            $or: [
                { email: { $regex: new RegExp(`^${identifier}$`, 'i') } },
                { mobno: { $regex: new RegExp(`^${identifier}$`, 'i') } },
                { username: { $regex: new RegExp(`^${identifier}$`, 'i') } },
                { address: { $regex: new RegExp(`^${identifier}$`, 'i') } }
            ]
        };

        // Find the user
        const user = await User.findOne(query);
        if (!user) {
            return res.status(400).json({ msg: "Invalid credentials" });
        }

        // Validate password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: "Invalid credentials" });
        }

        // Check if the user already has an active session
        if (user.sessionId) {
            return res.status(403).json({ msg: "User already logged in from another session." });
        }

        const sessionId = uuidv4(); // Generate session ID

        // Save session data
        req.session.userId = user._id.toString();
        req.session.username = user.username;
        user.sessionId = sessionId; 
        await user.save();

        // Generate a JWT
        const token = jwt.sign(
            {
                userId: user._id,
                username: user.username,
                email: user.email,
                mobno: user.mobno,
                address: user.address
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Respond with session and token data
        res.status(200).json({
            msg: "Login successful",
            sessionId,
            token,
            userId: req.session.userId, // Explicitly send back userId
            username: req.session.username,
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                mobno: user.mobno,
                address: user.address
            },
        });
    } catch (err) {
        console.error("Error logging in user:", err.message);
        res.status(500).json({ msg: "Server error" });
    }
});


router.post("/logout", async (req, res) => {
    // Get userId from the request body
    const { userId } = req.body;
    console.log("User ID:", userId);

    // If no userId is provided, return an error
    if (!userId) {
        return res.status(400).json({ msg: "No active session found." });
    }

    try {
        // Find the user by userId in the database
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ msg: "User not found." });
        }

        // Clear session ID in the database
        user.sessionId = null;
        await user.save();

        // Prepare user information to send in response
        const userInfo = {
            _id: user._id,
            username: user.username,
            email: user.email,
            mobno: user.mobno,
            address: user.address,
        };

        // Destroy the session on the server
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ msg: "Failed to logout." });
            }
            res.status(200).json({ msg: "Logout successful.", user: userInfo });
        });
    } catch (err) {
        console.error("Error during logout:", err);
        res.status(500).json({ msg: "Server error." });
    }
});




// Admin registration endpoint
router.post("/admin/add", [
    body('username').notEmpty().withMessage("Username is required."),
    body('password').notEmpty().withMessage("Password is required."),
    body('mobno').notEmpty().isNumeric().withMessage("Mobile number is required."),
    body('email').notEmpty().isEmail().withMessage("Valid email is required."),
], async (req, res) => {
    const { username, password, mobno, email } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        // Check if a user with the same username already exists
        const existingUser = await User.findOne({ username });

        if (existingUser) {
            // If the existing user is already an admin, return an error
            if (existingUser.role === 'admin') {
                return res.status(400).json({ msg: "Admin already exists." });
            }

            // If the existing user is not an admin, update their role to 'admin'
            existingUser.role = 'admin';
            existingUser.password = await bcrypt.hash(password, 10); // Update password if needed
            existingUser.mobno = mobno; // Update mobile number if needed
            existingUser.email = email; // Update email if needed

            await existingUser.save();

            return res.status(200).json({ msg: "User has been updated to admin." });
        }

        // If no user exists with the given username, create a new admin user
        const hashedPassword = await bcrypt.hash(password, 10);

        const newAdmin = new User({
            username,
            password: hashedPassword,
            mobno,
            email,
            role: 'admin',
        });

        await newAdmin.save();

        res.status(201).json({ msg: "Admin added successfully." });
    } catch (error) {
        console.error("Error adding admin:", error);
        res.status(500).json({ msg: "Server error", error: error.message });
    }
});

// Admin login
router.post("/admin/login", [
    body('username').notEmpty().withMessage("Username is Required."),
    body('password').notEmpty().withMessage("Password is required."),
], async (req, res) => {
    const { username, password } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        // Find the admin by username
        const admin = await User.findOne({ username, role: 'admin' });
        if (!admin) {
            return res.status(400).json({ msg: "Invalid credentials." });
        }

        // Validate password
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(400).json({ msg: "Invalid credentials." });
        }

        // Generate a session ID
        const sessionId = uuidv4(); // Create a new session ID

        // Successful login
        res.status(200).json({
            msg: "Login successful.",
            sessionId,
            admin: {
                username: admin.username,
                email: admin.email,
                role: admin.role
            },
        });
    } catch (error) {
        console.error("Error logging in admin:", error);
        res.status(500).json({ msg: "Server error", error: error.message });
    }
});

// Fetch all admins
router.get("/admin/list", async (req, res) => {
    try {
        const admins = await User.find({ role: 'admin' }, 'username email mobno'); // Only fetch required fields
        res.status(200).json({ admins });
    } catch (error) {
        console.error("Error fetching admin list:", error);
        res.status(500).json({ msg: "Server error", error: error.message });
    }
});

// Edit admin details
router.put("/admin/edit/:id", async (req, res) => {
    const { username, email, mobno, password } = req.body;
    const adminId = req.params.id;

    // Validate required fields
    if (!username || !email || !mobno) {
        return res.status(400).json({ msg: "Username, email, and mobile number are required." });
    }

    try {
        const updateData = { username, email, mobno };

        // If password is provided, hash it
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateData.password = hashedPassword;
        }

        const updatedAdmin = await User.findByIdAndUpdate(adminId, updateData, { new: true });
        if (!updatedAdmin) {
            return res.status(404).json({ msg: "Admin not found." });
        }

        res.status(200).json({ msg: "Admin updated successfully." });
    } catch (error) {
        console.error("Error updating admin:", error);
        res.status(500).json({ msg: "Server error", error: error.message });
    }
});

// Delete an admin
router.delete("/admin/delete/:id", async (req, res) => {
    const adminId = req.params.id;

    try {
        // Find the admin by ID and remove it
        const deletedAdmin = await User.findByIdAndDelete(adminId);

        if (!deletedAdmin) {
            return res.status(404).json({ msg: "Admin not found." });
        }

        res.status(200).json({ msg: "Admin deleted successfully." });
    } catch (error) {
        console.error("Error deleting admin:", error);
        res.status(500).json({ msg: "Server error", error: error.message });
    }
});

export default router;
