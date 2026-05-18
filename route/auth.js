import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000) || 60;
    res.status(429).json({ success: false, msg: `Too many login attempts. Retry after ${retryAfter}s.` });
  },
});

// Safe exact-match login query — never use user input in regex
const buildIdentifierQuery = (identifier) => ({
  $or: [
    { email: identifier.toLowerCase().trim() },
    { mobno: identifier.trim() },
    { username: identifier.trim() },
  ],
});

// POST /login
router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ success: false, msg: 'Identifier and password are required' });
  }

  const user = await User.findOne(buildIdentifierQuery(identifier));
  if (!user) {
    return res.status(400).json({ success: false, msg: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ success: false, msg: 'Invalid credentials' });
  }

  if (user.sessionId) {
    // Issue a short-lived override token so the client can force-logout the other session
    const overrideToken = jwt.sign(
      { userId: user._id.toString(), purpose: 'override_session' },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );
    return res.status(409).json({
      success: false,
      msg: 'User already logged in from another session.',
      conflict: true,
      overrideToken,
    });
  }

  const sessionId = uuidv4();
  req.session.userId = user._id.toString();
  req.session.username = user.username;
  user.sessionId = sessionId;
  await user.save();

  const token = jwt.sign(
    { userId: user._id, username: user.username, email: user.email, mobno: user.mobno, address: user.address },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.status(200).json({
    success: true,
    msg: 'Login successful',
    sessionId,
    token,
    cartItems: user.cartItems,
    userId: user._id.toString(),
    username: user.username,
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      mobno: user.mobno,
      address: user.address,
    },
  });
}));

// POST /logout-other-sessions
// Requires the overrideToken issued during the conflict response — no body userId accepted
router.post('/logout-other-sessions', asyncHandler(async (req, res) => {
  const { overrideToken } = req.body;

  if (!overrideToken) {
    return res.status(400).json({ success: false, msg: 'Override token is required.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(overrideToken, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, msg: 'Invalid or expired override token.' });
  }

  if (decoded.purpose !== 'override_session') {
    return res.status(401).json({ success: false, msg: 'Invalid token purpose.' });
  }

  const user = await User.findById(decoded.userId);
  if (!user) {
    return res.status(404).json({ success: false, msg: 'User not found.' });
  }

  // Clear the other session — the calling client is about to create a fresh one via /login
  user.sessionId = null;
  await user.save();

  res.status(200).json({ success: true, msg: 'Other session logged out. Please log in again.' });
}));

// GET /session-info
router.get('/session-info', asyncHandler(async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ success: false, msg: 'Unauthorized access' });
  }

  const user = await User.findById(req.session.userId).select('_id sessionId');
  if (!user) {
    return res.status(404).json({ success: false, msg: 'User not found' });
  }

  res.status(200).json({ userId: user._id.toString(), sessionId: user.sessionId });
}));

// POST /logout
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ success: false, msg: 'User not found.' });
  }

  user.sessionId = null;
  await user.save();

  await new Promise((resolve, reject) =>
    req.session.destroy((err) => (err ? reject(err) : resolve()))
  );

  res.status(200).json({
    success: true,
    msg: 'Logout successful.',
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      mobno: user.mobno,
      address: user.address,
    },
  });
}));

// POST /admin/add  — protected: only existing admins may create new admins
router.post('/admin/add', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { username, email, mobno, password } = req.body;

  if (!username || !email || !mobno || !password) {
    return res.status(400).json({ success: false, msg: 'All fields are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^[0-9]{10}$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, msg: 'Invalid email format.' });
  }
  if (!phoneRegex.test(mobno)) {
    return res.status(400).json({ success: false, msg: 'Invalid mobile number. Must be 10 digits.' });
  }
  if (password.length < 10) {
    return res.status(400).json({ success: false, msg: 'Password must be at least 10 characters.' });
  }

  const existing = await User.findOne({ $or: [{ email }, { mobno }, { username }] });
  if (existing) {
    return res.status(400).json({ success: false, msg: 'Username, email, or mobile already in use.' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newAdmin = new User({ username, email, mobno, password: hashedPassword, role: 'admin' });
  await newAdmin.save();

  res.status(201).json({
    success: true,
    msg: 'Admin added successfully.',
    admin: { _id: newAdmin._id, username: newAdmin.username, email: newAdmin.email },
  });
}));

// POST /admin/login
router.post('/admin/login', loginLimiter, asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ success: false, msg: 'Identifier and password are required' });
  }

  const query = { role: 'admin', ...buildIdentifierQuery(identifier) };
  // buildIdentifierQuery uses $or — combine with role filter correctly
  const admin = await User.findOne({
    role: 'admin',
    $or: [
      { email: identifier.toLowerCase().trim() },
      { mobno: identifier.trim() },
      { username: identifier.trim() },
    ],
  });

  if (!admin) {
    return res.status(400).json({ success: false, msg: 'Invalid credentials.' });
  }

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) {
    return res.status(400).json({ success: false, msg: 'Invalid credentials.' });
  }

  if (admin.sessionId) {
    const overrideToken = jwt.sign(
      { userId: admin._id.toString(), purpose: 'override_session' },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );
    return res.status(409).json({
      success: false,
      msg: 'Admin already logged in from another session.',
      conflict: true,
      overrideToken,
    });
  }

  const sessionId = uuidv4();
  req.session.userId = admin._id.toString();
  req.session.username = admin.username;
  admin.sessionId = sessionId;
  await admin.save();

  const token = jwt.sign(
    { userId: admin._id, username: admin.username, email: admin.email, mobno: admin.mobno, role: admin.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.status(200).json({
    success: true,
    msg: 'Admin login successful.',
    sessionId,
    token,
    userId: admin._id.toString(),
    username: admin.username,
    role: admin.role,
    admin: {
      _id: admin._id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      mobno: admin.mobno,
      address: admin.address,
    },
  });
}));

// GET /admin/list — protected
router.get('/admin/list', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const admins = await User.find({ role: 'admin' }).select('username email mobno');
  res.status(200).json({ success: true, admins });
}));

// PUT /admin/edit/:id — protected
router.put('/admin/edit/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { username, email, mobno, password } = req.body;
  const adminId = req.params.id;

  if (!username || !email || !mobno) {
    return res.status(400).json({ success: false, msg: 'Username, email, and mobile number are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^[0-9]{10}$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, msg: 'Invalid email format.' });
  }
  if (!phoneRegex.test(mobno)) {
    return res.status(400).json({ success: false, msg: 'Invalid mobile number. Must be 10 digits.' });
  }

  const conflict = await User.findOne({
    _id: { $ne: adminId },
    $or: [{ email }, { mobno }, { username }],
  });
  if (conflict) {
    return res.status(400).json({ success: false, msg: 'Username, email, or mobile already in use.' });
  }

  const updateData = { username, email, mobno };
  if (password) {
    if (password.length < 10) {
      return res.status(400).json({ success: false, msg: 'Password must be at least 10 characters.' });
    }
    updateData.password = await bcrypt.hash(password, 10);
  }

  const updatedAdmin = await User.findByIdAndUpdate(adminId, updateData, { new: true }).select('-password');
  if (!updatedAdmin) {
    return res.status(404).json({ success: false, msg: 'Admin not found.' });
  }

  res.status(200).json({ success: true, msg: 'Admin updated successfully.', admin: updatedAdmin });
}));

// POST /admin/check-exists — public helper (no sensitive data returned)
router.post('/admin/check-exists', asyncHandler(async (req, res) => {
  const { username, email, mobno } = req.body;
  const existing = await User.findOne({ $or: [{ username }, { email }, { mobno }] }).select('_id');
  res.status(200).json({ exists: !!existing });
}));

// DELETE /admin/delete/:id — protected
router.delete('/admin/delete/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const deleted = await User.findByIdAndDelete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, msg: 'Admin not found.' });
  }
  res.status(200).json({ success: true, msg: 'Admin deleted successfully.' });
}));

export default router;
