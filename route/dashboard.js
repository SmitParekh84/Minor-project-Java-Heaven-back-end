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
                totalUsers: { $sum: 1 },
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

        // Fetch total number of users
        const totalUsers = await User.countDocuments();

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

        // Fetch best-selling items from delivered orders only
        const bestSellingItems = await Order.aggregate([
            { $match: { status: 'Delivered' } }, // Only consider delivered orders
            { $unwind: '$items' }, // Flatten the items array
            {
                $group: {
                    _id: '$items.productId', // Group by productId
                    totalSold: { $sum: '$items.quantity' }, // Sum up the quantities sold
                    name: { $first: '$items.name' }, // Get the product name
                }
            },
            { $sort: { totalSold: -1 } }, // Sort by totalSold in descending order
            { $limit: 5 } // Limit to top 5 best-selling items
        ]);

        // Fetch monthly order data based on the createdAt field for delivered orders
        const ordersPerMonth = await Order.aggregate([
            { $match: { status: 'Delivered' } }, // Only consider delivered orders
            {
                $group: {
                    _id: { $month: '$createdAt' }, // Group by month
                    totalOrders: { $sum: 1 }, // Count orders in each month
                    totalUsers: { $sum: 1 }, // Count users in each month
                    totalSales: { $sum: '$totalAmount' } // Sum total sales in each month
                }
            },
            { $sort: { '_id': 1 } } // Sort by month (1 to 12)
        ]);

        // Format the data for the frontend
        const monthlyData = ordersPerMonth.map(monthData => ({
            month: MONTHS[monthData._id - 1], // Convert month number to name
            totalOrders: monthData.totalOrders,
            totalUsers: monthData.totalUsers,
            totalSales: monthData.totalSales
        }));

        // Fetch monthly user data based on the createdAt field
        const usersPerMonth = await User.aggregate([
            {
                $group: {
                    _id: { $month: '$createdAt' }, // Group by month
                    totalUsers: { $sum: 1 }, // Count users registered in each month
                }
            },
            { $sort: { '_id': 1 } } // Sort by month (1 to 12)
        ]);

        // Format the monthly user data
        const monthlyUsers = usersPerMonth.map(userData => ({
            month: MONTHS[userData._id - 1], // Convert month number to name
            totalUsers: userData.totalUsers
        }));

        const { dailyData, yearlyData } = await getAggregatedData();

        res.status(200).json({
            status: 'success',
            data: {
                totalOrders,
                totalUsers,
                totalSales,
                bestSellingItems,
                monthlyData, // Send the monthly order data to the frontend
                monthlyUsers, // Send the monthly user data to the frontend
                dailyData, // New daily data
                yearlyData, // New yearly data
                usersPerMonth,
            }
        });
    } catch (err) {
        console.error("Error fetching dashboard data:", err.message);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

export default router;
