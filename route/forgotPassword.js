// route/forgotPassword.js
import express from "express";
import User from "../models/User.js"; // Import User model
import nodemailer from "nodemailer"; // For sending email
import bcrypt from "bcrypt";
const router = express.Router();

// POST /forgot-password (Generate OTP and send email)
router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;

    try {
        // Find the user by email
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Generate a random OTP (6 digits)
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Update the user's resetOTP field with the generated OTP
        user.resetOTP = otp;
        await user.save();

        // Send OTP to user's email using nodemailer
        const transporter = nodemailer.createTransport({
            service: "Gmail",
            auth: {
                user: process.env.EMAIL_USER, // Your email from .env
                pass: process.env.EMAIL_PASS, // Your email password from .env
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: "Password Reset OTP",
            text: `Your OTP for password reset is: ${otp}`,
        };
        console.log(mailOptions);

        await transporter.sendMail(mailOptions);

        return res.status(200).json({ message: "OTP sent to email" });
    } catch (err) {
        console.error("Error during OTP generation:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
    }
});

// POST /verify-otp (Verify OTP and reset password)
router.post("/verify-otp", async (req, res) => {
    const { email, otp, newPassword, confirmPassword } = req.body;

    try {
        // Find the user by email
        const user = await User.findOne({ email });

        if (!user || user.resetOTP !== otp) {
            return res.status(400).json({ message: "Invalid OTP or email" });
        }

        // Check if newPassword and confirmPassword match
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: "Passwords do not match" });
        }

        // Update the user's password and clear the resetOTP field
        user.password = newPassword; // You should hash the password before saving
        user.resetOTP = null; // Clear the OTP after use
        await user.save();

        return res.status(200).json({ message: "Password successfully reset" });
    } catch (err) {
        console.error("Error during password reset:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
    }
});
router.post("/reset-password", async (req, res) => {
    const { otp, newPassword } = req.body;

    try {
        // Find the user by OTP
        const user = await User.findOne({ resetOTP: otp });

        if (!user) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        // Hash the new password before saving
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the user's password and clear the resetOTP field
        user.password = hashedPassword;
        user.resetOTP = null; // Clear the OTP after use
        await user.save();

        return res.status(200).json({ message: "Password successfully updated" });
    } catch (err) {
        console.error("Error during password update:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
    }
});
export default router;
