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
                { username: { $regex: new RegExp(`^${identifier}$`, 'i') } }

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
            return res.status(200).json({
                msg: "User already logged in from another session.",
                conflict: true, // Indicate session conflict to the frontend
                userId: user._id.toString()
            });
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
            cartItems: user.cartItems,
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




// Route: /logout-other-sessions
// Logout from other sessions Route

router.post("/logout-other-sessions", async (req, res) => {
    // Get userId from the session
    const { userId } = req.body
    console.log("User ID:", userId);
    if (!userId) {
        return res.status(400).json({ msg: "User ID is required." });
    }

    try {
        // Find the user by ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ msg: "User not found." });
        }

        // Clear all session data for the user to ensure they are logged out everywhere
        user.sessionId = null; // This should work if you are not managing sessions with express-session
        await user.save();

        // Optionally clear server-side session if using express-session
        req.session.destroy(err => {
            if (err) {
                console.error("Failed to destroy session:", err);
                return res.status(500).json({ msg: "Error logging out from other sessions." });
            }
            res.status(200).json({ success: true, msg: "Logged out from other sessions." });
        });
    } catch (error) {
        console.error("Error logging out other sessions:", error);
        res.status(500).json({ success: false, msg: "An error occurred during logout from other sessions." });
    }
});

// Endpoint to get userId and sessionId
router.get("/session-info", async (req, res) => {
    try {
        // Check if the user is authenticated by checking the session
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ msg: "Unauthorized access" });
        }

        // Find the user by userId from the session
        const user = await User.findById(req.session.userId);

        // Check if user exists
        if (!user) {
            return res.status(404).json({ msg: "User not found" });
        }

        // Respond with userId and sessionId
        res.status(200).json({
            userId: user._id.toString(),
            sessionId: user.sessionId,
        });
    } catch (err) {
        console.error("Error fetching session info:", err.message);
        res.status(500).json({ msg: "Server error" });
    }
});




router.post("/logout", async (req, res) => {
    // Get userId from the request body
    // Get userId from the session
    const { userId } = req.body;



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

// Add new admin endpoint 
router.post("/admin/add", async (req, res) => {
    const { username, email, mobno, password } = req.body;

    if (!username || !email || !mobno || !password) {
        return res.status(400).json({ msg: "All fields are required." });
    }

    // Validate email and phone format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[0-9]{10}$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ msg: "Invalid email format." });
    }
    if (!phoneRegex.test(mobno)) {
        return res.status(400).json({ msg: "Invalid mobile number format. Must be 10 digits." });
    }
    if (password.length < 6) {
        return res.status(400).json({ msg: "Password must be at least 6 characters long." });
    }

    try {
        const existingAdminEmail = await User.findOne({ email });
        const existingAdminMobno = await User.findOne({ mobno });
        const existingAdminUserName = await User.findOne({ username });
        if (existingAdminEmail || existingAdminMobno || existingAdminUserName) {
            return res.status(400).json({ msg: "Admin with this username,mobile number,email already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newAdmin = new User({ username, email, mobno, password: hashedPassword, role: 'admin' });
        await newAdmin.save();

        res.status(201).json({ msg: "Admin added successfully.", admin: newAdmin });
    } catch (error) {
        console.error("Error adding new admin:", error);
        res.status(500).json({ msg: "Server error", error: error.message });
    }
});


// Admin login
router.post("/admin/login", loginLimiter, async (req, res) => {
    const { identifier, password } = req.body;

    // Validate input
    if (!identifier || !password) {
        return res.status(400).json({ msg: "Identifier and password are required" });
    }

    try {
        // Query to find the admin user by role and identifier
        const query = {
            $and: [
                { role: 'admin' },
                {
                    $or: [
                        { email: { $regex: new RegExp(`^${identifier}$`, 'i') } },
                        { mobno: { $regex: new RegExp(`^${identifier}$`, 'i') } },
                        { username: { $regex: new RegExp(`^${identifier}$`, 'i') } }
                    ]
                }
            ]
        };

        // Find the admin
        const admin = await User.findOne(query);
        if (!admin) {
            return res.status(400).json({ msg: "Invalid credentials." });
        }

        // Validate password
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(400).json({ msg: "Invalid credentials." });
        }

        // Check if the admin already has an active session
        if (admin.sessionId) {
            return res.status(200).json({
                msg: "Admin already logged in from another session.",
                conflict: true, // Indicate session conflict to the frontend
                userId: admin._id.toString()
            });
        }

        // Generate a session ID
        const sessionId = uuidv4(); // Create a new session ID

        // Save session data
        req.session.userId = admin._id.toString();
        req.session.username = admin.username; // Assign the admin's username here
        admin.sessionId = sessionId;
        await admin.save();

        // Generate a JWT
        const token = jwt.sign(
            {
                userId: admin._id,
                username: admin.username,
                email: admin.email,
                mobno: admin.mobno,
                role: admin.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Successful login
        res.status(200).json({
            msg: "Admin login successful.",
            sessionId,
            token,
            userId: req.session.userId,
            username: req.session.username,
            role: admin.role,
            admin: {
                _id: admin._id,
                username: admin.username,
                email: admin.email,
                role: admin.role,
                mobno: admin.mobno,
                address: admin.address
            },
        });
    } catch (error) {
        console.error("Error logging in admin:", error.message);
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

    // Validate email and phone format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[0-9]{10}$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ msg: "Invalid email format." });
    }
    if (!phoneRegex.test(mobno)) {
        return res.status(400).json({ msg: "Invalid mobile number format. Must be 10 digits." });
    }

    try {
        // Check if any other admin already exists with the same username, email, or mobno except the current admin
        const existingAdminEmail = await User.findOne({ email, _id: { $ne: adminId } });
        const existingAdminMobno = await User.findOne({ mobno, _id: { $ne: adminId } });
        const existingAdminUserName = await User.findOne({ username, _id: { $ne: adminId } });

        if (existingAdminEmail || existingAdminMobno || existingAdminUserName) {
            return res.status(400).json({ msg: "Admin with this username, mobile number, or email already exists." });
        }

        const updateData = { username, email, mobno };

        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ msg: "Password must be at least 6 characters long." });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            updateData.password = hashedPassword;
        }

        const updatedAdmin = await User.findByIdAndUpdate(adminId, updateData, { new: true });
        if (!updatedAdmin) {
            return res.status(404).json({ msg: "Admin not found." });
        }

        res.status(200).json({ msg: "Admin updated successfully.", admin: updatedAdmin });
    } catch (error) {
        console.error("Error updating admin:", error);
        res.status(500).json({ msg: "Server error", error: error.message });
    }
});

// Check if admin exists endpoint
router.post("/admin/check-exists", async (req, res) => {
    const { username, email, mobno } = req.body;
    try {
        const existingAdmin = await User.findOne({
            $or: [
                { username },
                { email },
                { mobno }
            ]
        });
        if (existingAdmin) {
            return res.status(200).json({ exists: true });
        }
        res.status(200).json({ exists: false });
    } catch (error) {
        console.error("Error checking if admin exists:", error);
        res.status(500).json({ msg: "Server error", error: error.message });
    }
});


// Delete an admin
router.delete("/admin/delete/:id", async (req, res) => {
    const adminId = req.params.id;

    try {
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
