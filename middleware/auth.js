import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, msg: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Verify session is still active in DB — this makes logout actually invalidate tokens
    const user = await User.findById(decoded.userId).select('sessionId role');
    if (!user || !user.sessionId) {
      return res.status(401).json({ success: false, msg: 'Session expired or logged out' });
    }
    req.user = { ...decoded, role: user.role };
    next();
  } catch {
    return res.status(401).json({ success: false, msg: 'Invalid or expired token' });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, msg: 'Admin access required' });
  }
  next();
};
