import express from 'express';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = express.Router();

// POST /api/users/cart — update cart; userId must match the authenticated token (IDOR prevention)
router.post('/users/cart', authenticate, asyncHandler(async (req, res) => {
  const { userId, cartItems } = req.body;

  if (!userId || !cartItems) {
    return res.status(400).json({ success: false, msg: 'userId and cartItems are required' });
  }

  // Prevent user A from writing to user B's cart
  if (req.user.userId.toString() !== userId.toString()) {
    return res.status(403).json({ success: false, msg: 'Forbidden: cannot modify another user\'s cart' });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ success: false, msg: 'User not found' });
  }

  user.cartItems = cartItems;
  await user.save();

  return res.status(200).json({ success: true, msg: 'Cart updated', cart: user.cartItems });
}));

// GET /api/users/cart/:userId — ownership enforced
router.get('/users/cart/:userId', authenticate, asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (req.user.userId.toString() !== userId.toString()) {
    return res.status(403).json({ success: false, msg: 'Forbidden: cannot read another user\'s cart' });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ success: false, msg: 'User not found' });
  }

  return res.status(200).json({ success: true, cart: user.cartItems });
}));

export default router;
