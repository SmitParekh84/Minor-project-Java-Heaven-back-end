// src/routes/revenue.js
import express from 'express';
import Order from '../models/Order.js';

const router = express.Router();

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
];

router.get('/', async (req, res) => {
    try {
        const monthlySalesData = await Order.aggregate([
            { $match: { isDelivered: true } },
            { $group: { _id: { $month: '$createdAt' }, totalSales: { $sum: '$totalAmount' } } },
            { $sort: { '_id': 1 } }
        ]);

        const formattedData = monthlySalesData.map(monthData => ({
            month: MONTHS[monthData._id - 1],
            totalSales: monthData.totalSales
        }));

        const totalRevenue = formattedData.reduce((acc, item) => acc + item.totalSales, 0);

        // Additional aggregation for revenue by delivery type
        const deliveryRevenueData = await Order.aggregate([
            { $match: { isDelivered: true } },
            { $group: { _id: '$deliveryOption', totalSales: { $sum: '$totalAmount' } } }
        ]);

        const formattedDeliveryData = deliveryRevenueData.map(data => ({
            deliveryType: data._id,
            totalSales: data.totalSales
        }));

        res.json({
            status: 'success',
            data: {
                totalRevenue,
                revenueData: formattedData,
                deliveryData: formattedDeliveryData,  // Added for pie chart
            },
        });
    } catch (err) {
        console.error("Error fetching revenue data:", err.message);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

export default router;
