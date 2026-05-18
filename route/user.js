import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = express.Router();

const validObjectId = (res, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ success: false, msg: 'Invalid user ID format' });
    return false;
  }
  return true;
};

const ownerOnly = (req, res, paramId) => {
  if (req.user.userId.toString() !== paramId.toString()) {
    res.status(403).json({ success: false, msg: 'Forbidden: cannot access another user\'s data' });
    return false;
  }
  return true;
};

// GET /api/users/:userId
router.get('/users/:userId', authenticate, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!validObjectId(res, userId)) return;
  if (!ownerOnly(req, res, userId)) return;

  const user = await User.findById(userId).select('-password');
  if (!user) return res.status(404).json({ success: false, msg: 'User not found' });

  res.json({ success: true, user });
}));

// GET /api/users/:userId/cart
router.get('/users/:userId/cart', authenticate, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!validObjectId(res, userId)) return;
  if (!ownerOnly(req, res, userId)) return;

  const user = await User.findById(userId).select('cart');
  if (!user) return res.status(404).json({ success: false, msg: 'User not found' });

  res.json({ success: true, cart: user.cart });
}));

// POST /api/users/:userId/cart
router.post('/users/:userId/cart', authenticate, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!validObjectId(res, userId)) return;
  if (!ownerOnly(req, res, userId)) return;

  const { itemId, size, quantity = 1 } = req.body;
  if (!itemId || !size) {
    return res.status(400).json({ success: false, msg: 'itemId and size are required' });
  }

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ success: false, msg: 'User not found' });

  const existingIdx = user.cart.findIndex(
    (item) => item.itemId.toString() === itemId && item.size === size
  );
  if (existingIdx > -1) {
    user.cart[existingIdx].quantity += quantity;
  } else {
    user.cart.push({ itemId, size, quantity });
  }

  await user.save();
  res.json({ success: true, msg: 'Item added to cart', cart: user.cart });
}));

// PUT /api/users/:userId/address
router.put('/users/:userId/address', authenticate, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!validObjectId(res, userId)) return;
  if (!ownerOnly(req, res, userId)) return;

  const { address } = req.body;
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ success: false, msg: 'Valid address is required' });
  }

  const updatedUser = await User.findByIdAndUpdate(userId, { address }, { new: true }).select('-password');
  if (!updatedUser) return res.status(404).json({ success: false, msg: 'User not found' });

  res.json({ success: true, user: updatedUser });
}));

// PUT /api/users/:userId — update profile (mobno, address)
router.put('/users/:userId', authenticate, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!validObjectId(res, userId)) return;
  if (!ownerOnly(req, res, userId)) return;

  const { mobno, address } = req.body;

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ success: false, msg: 'User not found' });

  if (mobno) user.mobno = mobno;
  if (address) user.address = address;

  await user.save();

  const newToken = jwt.sign(
    { userId: user._id, username: user.username, email: user.email, mobno: user.mobno, address: user.address },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.json({
    success: true,
    msg: 'Profile updated successfully',
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      mobno: user.mobno,
      address: user.address,
    },
    token: newToken,
  });
}));

// PUT /api/users/:id/password
router.put('/users/:id/password', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!validObjectId(res, id)) return;
  if (!ownerOnly(req, res, id)) return;

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, msg: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 10) {
    return res.status(400).json({ success: false, msg: 'New password must be at least 10 characters' });
  }

  const user = await User.findById(id);
  if (!user) return res.status(404).json({ success: false, msg: 'User not found' });

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) return res.status(400).json({ success: false, msg: 'Current password is incorrect' });

  user.password = await bcrypt.hash(newPassword, 10);
  // Invalidate all sessions after password change
  user.sessionId = null;
  await user.save();

  res.json({ success: true, msg: 'Password updated successfully. Please log in again.' });
}));

export default router;
