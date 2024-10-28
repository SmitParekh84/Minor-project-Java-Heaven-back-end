// route/forgotPassword.js
import express from "express";
import User from "../models/User.js"; // Import User model
import nodemailer from "nodemailer"; // For sending email
import bcrypt from "bcrypt"; // For hashing passwords
import { body, validationResult } from "express-validator"; // For input validation
const router = express.Router();

// Function to create transporter for sending email
const createTransporter = () => {
    return nodemailer.createTransport({
        service: "Gmail",
        auth: {
            user: process.env.EMAIL_USER, // Your email from .env
            pass: process.env.EMAIL_PASS, // Your email password from .env
        },
    });
};

// POST /forgot-password (Generate OTP and send email)
router.post(
    "/forgot-password",
    body("email").isEmail().withMessage("Invalid email format"),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email } = req.body;

        try {
            // Find the user by email
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            // Generate a random OTP (6 digits)
            const otp = Math.floor(100000 + Math.random() * 900000).toString();

            // Update the user's resetOTP field and set expiration time (e.g., 10 minutes)
            user.resetOTP = otp;
            user.resetOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes expiration
            await user.save();

            // Send OTP to user's email
            const transporter = createTransporter();
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: user.email,
                subject: "Password Reset OTP",
                text: `Your OTP for password reset is: ${otp}`,
            };

            await transporter.sendMail(mailOptions);
            return res.status(200).json({ message: "OTP sent to email" });
        } catch (err) {
            console.error("Error during OTP generation:", err);
            return res.status(500).json({ error: "Server error", details: err.message });
        }
    }
);

// POST /verify-otp (Verify OTP and reset password)
router.post(
    "/verify-otp",
    body("email").isEmail().withMessage("Invalid email format"),
    body("otp").isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits"),
    body("newPassword").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    body("confirmPassword").exists().withMessage("Confirm password is required"),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, otp, newPassword, confirmPassword } = req.body;

        try {
            // Find the user by email
            const user = await User.findOne({ email });

            if (!user || user.resetOTP !== otp || Date.now() > user.resetOTPExpires) {
                return res.status(400).json({ message: "Invalid OTP or email, or OTP has expired" });
            }

            // Check if newPassword and confirmPassword match
            if (newPassword !== confirmPassword) {
                return res.status(400).json({ message: "Passwords do not match" });
            }

            // Hash the new password before saving
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update the user's password and clear the resetOTP field
            user.password = hashedPassword; // Save the hashed password
            user.resetOTP = null; // Clear the OTP after use
            user.resetOTPExpires = null; // Clear the expiration
            await user.save();

            return res.status(200).json({ message: "Password successfully reset" });
        } catch (err) {
            console.error("Error during password reset:", err);
            return res.status(500).json({ error: "Server error", details: err.message });
        }
    }
);

// POST /reset-password (Reset password directly with OTP)
router.post(
    "/reset-password",
    body("otp").isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits"),
    body("newPassword").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { otp, newPassword } = req.body;

        try {
            // Find the user by OTP
            const user = await User.findOne({ resetOTP: otp });

            if (!user || Date.now() > user.resetOTPExpires) {
                return res.status(400).json({ message: "Invalid OTP or OTP has expired" });
            }

            // Hash the new password before saving
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update the user's password and clear the resetOTP field
            user.password = hashedPassword;
            user.resetOTP = null; // Clear the OTP after use
            user.resetOTPExpires = null; // Clear the expiration
            await user.save();

            return res.status(200).json({ message: "Password successfully updated" });
        } catch (err) {
            console.error("Error during password update:", err);
            return res.status(500).json({ error: "Server error", details: err.message });
        }
    }
);

export default router;
