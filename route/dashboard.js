import express from 'express';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { ORDER_STATUS } from '../constants/orderStatus.js';

const router = express.Router();

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// GET /api/dashboard — admin only
router.get('/dashboard', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const [
    totalOrders,
    totalPendingOrders,
    totalDeliveredOrders,
    totalUsers,
    bestSellingItems,
    totalItemsOrders,
    recentOrders,
    purchaseFrequency,
    totalItemsPending,
    deliveryData,
    totalSalesResult,
    ordersPerMonth,
    usersPerMonth,
    dailyData,
    yearlyData,
    deliveryOptionData,
  ] = await Promise.all([
    Order.countDocuments({ status: { $in: Object.values(ORDER_STATUS) } }),
    Order.countDocuments({ status: ORDER_STATUS.PENDING }),
    Order.countDocuments({ status: ORDER_STATUS.DELIVERED }),
    User.countDocuments(),
    Order.aggregate([
      { $match: { status: ORDER_STATUS.DELIVERED } },
      { $unwind: '$items' },
      { $group: { _id: '$items.productId', totalSold: { $sum: '$items.quantity' }, name: { $first: '$items.name' } } },
      { $sort: { totalSold: -1 } },
      { $limit: 30 },
    ]),
    Order.aggregate([
      { $match: { status: ORDER_STATUS.DELIVERED } },
      { $unwind: '$items' },
      { $group: { _id: null, totalItemsSold: { $sum: '$items.quantity' } } },
    ]),
    Order.find({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } })
      .sort({ createdAt: -1 })
      .limit(500),
    Order.aggregate([
      { $match: { status: ORDER_STATUS.DELIVERED } },
      { $group: { _id: '$userId', totalOrders: { $sum: 1 } } },
      { $match: { totalOrders: { $gt: 1 } } },
    ]),
    Order.aggregate([
      { $match: { status: ORDER_STATUS.PENDING } },
      { $unwind: '$items' },
      { $group: { _id: null, totalPending: { $sum: '$items.quantity' } } },
    ]),
    Order.aggregate([
      { $match: { status: ORDER_STATUS.DELIVERED } },
      { $group: { _id: '$deliveryOption', totalSales: { $sum: '$totalAmount' } } },
      { $match: { _id: { $ne: null } } },
    ]),
    Order.aggregate([
      { $match: { status: ORDER_STATUS.DELIVERED } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Order.aggregate([
      { $match: { status: ORDER_STATUS.DELIVERED } },
      { $group: { _id: { $month: '$createdAt' }, totalOrders: { $sum: 1 }, totalSales: { $sum: '$totalAmount' } } },
      { $sort: { _id: 1 } },
    ]),
    User.aggregate([
      { $group: { _id: { $month: '$createdAt' }, totalUsers: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { status: ORDER_STATUS.DELIVERED } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, totalOrders: { $sum: 1 }, totalSales: { $sum: '$totalAmount' } } },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { status: ORDER_STATUS.DELIVERED } },
      { $group: { _id: { $year: '$createdAt' }, totalOrders: { $sum: 1 }, totalSales: { $sum: '$totalAmount' } } },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { status: ORDER_STATUS.DELIVERED } },
      { $group: { _id: '$deliveryOption', totalOrders: { $sum: 1 }, totalSales: { $sum: '$totalAmount' } } },
    ]),
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalDeliveredOrders,
      totalPendingOrders,
      totalOrders,
      totalItemsOrders: totalItemsOrders[0]?.totalItemsSold || 0,
      recentOrders,
      purchaseFrequency,
      totalUsers,
      totalSales: totalSalesResult[0]?.total || 0,
      bestSellingItems,
      totalItemsPending: totalItemsPending[0]?.totalPending || 0,
      monthlyData: ordersPerMonth.map((m) => ({ month: MONTHS[m._id - 1], totalOrders: m.totalOrders, totalSales: m.totalSales })),
      monthlyUsers: usersPerMonth.map((u) => ({ month: MONTHS[u._id - 1], totalUsers: u.totalUsers })),
      dailyData,
      yearlyData,
      usersPerMonth,
      deliveryData: deliveryData.map((d) => ({ deliveryOption: d._id || 'Unknown', totalSales: d.totalSales })),
      deliveryOptionData: deliveryOptionData.map((d) => ({ deliveryOption: d._id, totalOrders: d.totalOrders, totalSales: d.totalSales })),
    },
  });
}));

export default router;
