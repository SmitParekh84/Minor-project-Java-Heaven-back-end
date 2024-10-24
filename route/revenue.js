// src/routes/revenue.js
import express from 'express';
import Order from '../models/Order.js'; // Adjust the import based on your actual Order model path

const router = express.Router();

// Constants for better readability and maintainability
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
];

// Endpoint to get revenue data
router.get('/', async (req, res) => {
    try {
        // Fetch monthly sales data
        const monthlySalesData = await Order.aggregate([
            {
                $group: {
                    _id: { $month: '$createdAt' }, // Group by month
                    totalSales: { $sum: '$totalAmount' } // Sum total sales in each month
                }
            },
            { $sort: { '_id': 1 } } // Sort by month (1 to 12)
        ]);

        // Format the data for the frontend
        const formattedData = monthlySalesData.map(monthData => ({
            month: MONTHS[monthData._id - 1], // Convert month number to name
            totalSales: monthData.totalSales
        }));

        // Calculate total revenue from the formatted data
        const totalRevenue = formattedData.reduce((acc, item) => acc + item.totalSales, 0);

        // Respond with the revenue data
        res.json({
            status: 'success',
            data: {
                totalRevenue,
                revenueData: formattedData,
            },
        });
    } catch (err) {
        console.error("Error fetching revenue data:", err.message);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});


export default router;
