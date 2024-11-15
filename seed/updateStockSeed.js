import mongoose from "mongoose";
import Item from "../models/Item.js"; // Adjust path as needed
import Order from "../models/Order.js"; // Adjust path as needed
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Function to update stock from delivered orders
const updateStockFromOrders = async () => {
  try {
    // Fetch all delivered orders (or you can filter based on date, etc.)
    const deliveredOrders = await Order.aggregate([
      {
        $match: { status: "Delivered" }, // Only consider delivered orders
      },
      { $unwind: "$items" }, // Flatten the items array in orders
      {
        $group: {
          _id: "$items.productId", // Group by productId
          totalSold: { $sum: "$items.quantity" }, // Sum up quantities sold
        },
      },
    ]);

    // If no delivered orders, exit early
    if (!deliveredOrders.length) {
      console.log("No delivered orders found.");
      return;
    }

    // Loop through the delivered orders aggregation result
    for (const orderItem of deliveredOrders) {
      const { _id: productId, totalSold } = orderItem;

      // Find the item by productId in the Item model
      const item = await Item.findById(productId);
      if (item) {
        // Subtract the total sold quantity from the stock
        item.stock -= totalSold;

        // Ensure stock doesn't go negative
        if (item.stock < 0) {
          item.stock = 0;
        }

        // Save the updated item stock
        await item.save();
      } else {
        console.error(`Item with ID ${productId} not found.`);
      }
    }

    console.log("Stock updated successfully from delivered orders");
  } catch (err) {
    console.error("Error updating stock:", err);
  }
};

// Connect to the database and run the seed function
const runSeed = async () => {
  try {
    // MongoDB URI from environment variables
    const dbURI = process.env.MONGO_URI;

    await mongoose.connect(dbURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to the database");

    // Run the stock update function
    await updateStockFromOrders();

    // Close the connection after the operation
    mongoose.connection.close();
  } catch (err) {
    console.error("Error connecting to the database:", err);
  }
};

// Execute the script
runSeed();
