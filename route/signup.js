import express from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import User from '../models/User.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = express.Router();

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ success: false, msg: 'Too many signup attempts. Please try again later.' });
  },
});

const userSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  mobno: Joi.string()
    .pattern(/^\+\d{1,3}-\d{10}$/)
    .required()
    .messages({
      'string.pattern.base': 'Mobile number must be formatted as +<country_code>-<10 digits>.',
    }),
  email: Joi.string().email().required(),
  password: Joi.string().min(10).required().messages({
    'string.min': 'Password must be at least 10 characters long.',
  }),
});

router.post('/signup', signupLimiter, asyncHandler(async (req, res) => {
  const { username, mobno, email, password } = req.body;

  const { error } = userSchema.validate({ username, mobno, email, password });
  if (error) {
    return res.status(400).json({ success: false, msg: error.details[0].message });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ success: false, msg: 'User already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ username, mobno, email, password: hashedPassword });
  await user.save();

  res.status(201).json({ success: true, msg: 'User registered successfully' });
}));

export default router;
