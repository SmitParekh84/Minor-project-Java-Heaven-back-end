import express from 'express';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = express.Router();

const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ success: false, msg: 'Too many OTP requests. Please wait 15 minutes.' });
  },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ success: false, msg: 'Too many OTP attempts. Please request a new OTP.' });
  },
});

const createTransporter = () =>
  nodemailer.createTransport({
    service: 'Gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

// POST /api/forgot-password
router.post(
  '/forgot-password',
  otpRequestLimiter,
  body('email').isEmail().withMessage('Invalid email format'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email } = req.body;
    const user = await User.findOne({ email });

    // Return same response whether user exists or not (prevents user enumeration)
    if (!user) {
      return res.status(200).json({ success: true, msg: 'If that email is registered, an OTP has been sent.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);

    user.resetOTP = hashedOtp;
    user.resetOTPExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Password Reset OTP',
      text: `Your OTP for password reset is: ${otp}. It expires in 10 minutes.`,
    });

    return res.status(200).json({ success: true, msg: 'If that email is registered, an OTP has been sent.' });
  })
);

// POST /api/verify-otp
router.post(
  '/verify-otp',
  otpVerifyLimiter,
  body('email').isEmail().withMessage('Invalid email format'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  body('newPassword').isLength({ min: 10 }).withMessage('Password must be at least 10 characters'),
  body('confirmPassword').exists().withMessage('Confirm password is required'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, otp, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, msg: 'Passwords do not match' });
    }

    const user = await User.findOne({ email });
    if (!user || !user.resetOTP || !user.resetOTPExpires) {
      return res.status(400).json({ success: false, msg: 'Invalid request or OTP expired' });
    }

    if (Date.now() > user.resetOTPExpires.getTime()) {
      return res.status(400).json({ success: false, msg: 'OTP has expired' });
    }

    const isValidOtp = await bcrypt.compare(otp, user.resetOTP);
    if (!isValidOtp) {
      return res.status(400).json({ success: false, msg: 'Invalid OTP' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetOTP = null;
    user.resetOTPExpires = null;
    // Invalidate all active sessions after password reset
    user.sessionId = null;
    await user.save();

    return res.status(200).json({ success: true, msg: 'Password successfully reset. Please log in again.' });
  })
);

export default router;
