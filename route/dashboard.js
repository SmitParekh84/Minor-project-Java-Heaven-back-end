import express from 'express';
import Order from '../models/Order.js'; // Adjust the import based on your actual Order model path
import User from '../models/User.js'; // Adjust the import based on your actual User model path
import Item from '../models/Item.js'; // Adjust the import based on your actual Item model path

const router = express.Router();

// Endpoint to get dashboard statistics
router.get('/dashboard', async (req, res) => {
    try {
        // Fetch total number of orders
        const totalOrders = await Order.countDocuments();

        // Fetch total number of users
        const totalUsers = await User.countDocuments();

        // Fetch total sales
        const totalSales = await Order.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: '$totalAmount' }
                }
            }
        ]);

        // Fetch best-selling items
        // Fetch best-selling items
        const bestSellingItems = await Order.aggregate([
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

        // Log the result to debug
        console.log(bestSellingItems); // Debugging line


        res.json({
            totalOrders,
            totalUsers,
            totalSales: totalSales[0]?.total || 0, // Get the total sales value
            bestSellingItems
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
