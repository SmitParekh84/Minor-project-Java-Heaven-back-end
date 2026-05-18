import express from 'express';
import Order from '../models/Order.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { ORDER_STATUS } from '../constants/orderStatus.js';

const router = express.Router();

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// GET /api/revenue — admin only; fixed query uses status field (not isDelivered which doesn't exist)
router.get('/', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const [monthlySalesData, deliveryRevenueData] = await Promise.all([
    Order.aggregate([
      { $match: { status: ORDER_STATUS.DELIVERED } },
      { $group: { _id: { $month: '$createdAt' }, totalSales: { $sum: '$totalAmount' } } },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { status: ORDER_STATUS.DELIVERED } },
      { $group: { _id: '$deliveryOption', totalSales: { $sum: '$totalAmount' } } },
    ]),
  ]);

  const revenueData = monthlySalesData.map((m) => ({
    month: MONTHS[m._id - 1],
    totalSales: m.totalSales,
  }));

  const totalRevenue = revenueData.reduce((acc, item) => acc + item.totalSales, 0);

  res.json({
    success: true,
    data: {
      totalRevenue,
      revenueData,
      deliveryData: deliveryRevenueData.map((d) => ({ deliveryType: d._id, totalSales: d.totalSales })),
    },
  });
}));

export default router;
