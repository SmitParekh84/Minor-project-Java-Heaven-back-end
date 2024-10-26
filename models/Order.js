// models/Order.js
import mongoose from "mongoose"

// Define the schema for Order
const OrderSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    items: [
      {
        productId: {
          type: String,
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        size: {
          type: String,
          required: true,
        },
        subtotal: {
          type: Number,
          required: true,
        },

      },
    ],
    status: {
      type: String,
      enum: ["Pending", "Delivered", "Cancelled"],
      default: "Pending",
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    deliveryOption: { // New field for delivery option
      type: String,
      enum: ["hand", "home"], // Define possible delivery options
      required: true,
    },
    address: { // New field for delivery address
      type: String,
      required: function () {
        return this.deliveryOption === 'home'; // Address is required only for home delivery
      },
    },
  },
  { timestamps: true }
) // Automatically add createdAt and updatedAt fields

// Create the Order model
const Order = mongoose.model("Order", OrderSchema)

// Export the model
export default Order
