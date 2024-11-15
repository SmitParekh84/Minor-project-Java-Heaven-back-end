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


// New function to count delivered orders
const countDeliveredOrders = async () => {
    return await Order.countDocuments({ status: 'Delivered' });
};
// Endpoint to get dashboard statistics
// Endpoint to get dashboard statistics with differentiation for delivery options
router.get('/dashboard', async (req, res) => {
    try {
        // Fetch total number of delivered orders
        const totalOrders = await Order.countDocuments({
            status: { $in: ["Pending", "Delivered", "Cancelled"] }
        });
        const totalPendingOrders = await Order.countDocuments({ status: 'Pending' });
        const totalDeliveredOrders = await Order.countDocuments({ status: 'Delivered' })
        // Fetch total number of users
        const totalUsers = await User.countDocuments();
        console.log("Total Users:", totalUsers);
        const bestSellingItems = await Order.aggregate([
            {
                $match: { status: { $in: ["Delivered"] } } // Only consider orders with specific statuses
            },
            { $unwind: '$items' }, // Flatten the items array
            {
                $group: {
                    _id: '$items.productId', // Group by productId
                    totalSold: { $sum: '$items.quantity' }, // Sum up the quantities sold
                    name: { $first: '$items.name' }, // Get the product name
                }
            },
            { $sort: { totalSold: -1 } }, // Sort by totalSold in descending order
            { $limit: 30 } // Limit to top 5 best-selling items
        ]);
        // Calculate total items in Pending, Delivered, and Cancelled orders
        const totalItemsOrders = await Order.aggregate([
            {
                $match: { status: { $in: ["Delivered"] } } // Only consider orders with specific statuses
            },
            {
                $unwind: '$items' // Flatten the items array
            },
            {
                $group: {
                    _id: null, // Group all items together
                    totalItemsSold: { $sum: '$items.quantity' } // Sum up the quantities of all items sold in these orders
                }
            }
        ]);

        const totalItemsSold = totalItemsOrders[0]?.totalItemsSold || 0; // Safely access total sold items
        // Calculate total items sold across all orders
        const totalItemsPending = await Order.aggregate([
            {
                $match: { status: 'Pending' } // Only consider delivered orders
            },
            {
                $unwind: '$items' // Flatten the items array
            },
            {
                $group: {
                    _id: null, // Group all items together
                    totalPending: { $sum: '$items.quantity' }, // Sum up the quantities of all items sold
                }
            }
        ]);

        const totalPending = totalItemsPending[0]?.totalPending || 0; // Safely access total sold

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

        // Add aggregation based on delivery options
        const deliveryOptionData = await Order.aggregate([
            { $match: { status: 'Delivered' } }, // Only consider delivered orders
            {
                $group: {
                    _id: '$deliveryOption', // Group by deliveryOption field
                    totalOrders: { $sum: 1 }, // Count orders for each delivery option
                    totalSales: { $sum: '$totalAmount' } // Sum up sales for each delivery option
                }
            }
        ]);

        // Format the delivery option data
        const formattedDeliveryOptionData = deliveryOptionData.map(option => ({
            deliveryOption: option._id,
            totalOrders: option.totalOrders,
            totalSales: option.totalSales
        }));


        res.status(200).json({
            status: 'success',
            data: {
                totalDeliveredOrders: totalDeliveredOrders, // Include total delivered orders count
                totalPendingOrders,
                totalOrders,
                totalItemsOrders: totalItemsSold, // Add total items sold to response
                totalUsers,
                totalSales,
                bestSellingItems,
                totalItemsPending: totalPending, // Add total items sold to response
                monthlyData, // Send the monthly order data to the frontend
                monthlyUsers, // Send the monthly user data to the frontend
                dailyData, // New daily data
                yearlyData, // New yearly data
                usersPerMonth,
                deliveryOptionData: formattedDeliveryOptionData // Add delivery option data
            }
        });
    } catch (err) {
        console.error("Error fetching dashboard data:", err.message);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});


export default router;
