import express from 'express';
import Order from '../models/Order.js'; // Adjust the import based on your actual Order model path
import User from '../models/User.js'; // Adjust the import based on your actual User model path
import Item from '../models/Item.js'; // Adjust the import based on your actual Item model path

const router = express.Router();

// Constants for better readability and maintainability
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// Add this function in your dashboard route to fetch daily and yearly data
const getAggregatedData = async () => {
    const dailyData = await Order.aggregate([
        { $match: { status: 'Delivered' } },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                totalOrders: { $sum: 1 },
                // totalUsers: { $sum: 1 },
                totalSales: { $sum: '$totalAmount' }
            }
        },
        { $sort: { '_id': 1 } } // Sort by date
    ]);

    const yearlyData = await Order.aggregate([
        { $match: { status: 'Delivered' } },
        {
            $group: {
                _id: { $year: "$createdAt" },
                totalOrders: { $sum: 1 },
                totalSales: { $sum: '$totalAmount' }
            }
        },
        { $sort: { '_id': 1 } } // Sort by year
    ]);

    // New aggregation for total users per month
    const usersPerMonth = await User.aggregate([
        {
            $group: {
                _id: { $month: '$createdAt' }, // Group by month
                totalUsers: { $sum: 1 } // Count users in each month
            }
        },
        { $sort: { '_id': 1 } } // Sort by month (1 to 12)
    ]);

    return { dailyData, yearlyData, usersPerMonth };
};

// Endpoint to get dashboard statistics
router.get('/dashboard', async (req, res) => {
    try {
        // Fetch total number of delivered orders
        const totalOrders = await Order.countDocuments({ status: 'Delivered' });
        console.log("Total Orders:", totalOrders);

        // Fetch total number of users
        const totalUsers = await User.countDocuments();
        console.log("Total Users:", totalUsers);

        // Fetch delivery data for pie chart
        const deliveryData = await Order.aggregate([
            { $match: { status: 'Delivered' } },
            {
                $group: {
                    _id: "$deliveryOption", // Group by delivery option (e.g., "hand", "home")
                    totalSales: { $sum: "$totalAmount" } // Sum sales for each option
                }
            },
            {
                $match: { _id: { $ne: null } } // Exclude null delivery options
            }
        ]);
        console.log("Delivery Data:", deliveryData);

        // Format delivery data for the frontend
        const formattedDeliveryData = deliveryData
            .filter(item => item._id !== null) // Ensure no null values
            .map(item => ({
                deliveryOption: item._id || 'Unknown', // Default to 'Unknown' if null
                totalSales: item.totalSales,
            }));


        // Fetch total sales for delivered orders only
        const totalSalesResult = await Order.aggregate([
            {
                $match: { status: 'Delivered' } // Only consider delivered orders
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$totalAmount' }
                }
            }
        ]);

        const totalSales = totalSalesResult[0]?.total || 0; // Safely access total
        console.log("Total Sales:", totalSales);

        // Fetch monthly order data based on the createdAt field for delivered orders
        const ordersPerMonth = await Order.aggregate([
            { $match: { status: 'Delivered' } },
            {
                $group: {
                    _id: { $month: '$createdAt' },
                    totalOrders: { $sum: 1 },
                    totalSales: { $sum: '$totalAmount' }
                }
            },
            { $sort: { '_id': 1 } }
        ]);
        console.log("Orders Per Month:", ordersPerMonth);

        // Format the data for the frontend
        const monthlyData = ordersPerMonth.map(monthData => ({
            month: MONTHS[monthData._id - 1],
            totalOrders: monthData.totalOrders,
            totalSales: monthData.totalSales
        }));

        // Send data in response
        res.status(200).json({
            status: 'success',
            data: {
                totalOrders,
                totalUsers,
                totalSales,
                formattedDeliveryData,
                monthlyData,
            }
        });
    } catch (err) {
        console.error("Error fetching dashboard data:", err.message);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});


export default router;
