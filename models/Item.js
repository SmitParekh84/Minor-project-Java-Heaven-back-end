import mongoose from "mongoose"

const ItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  category: {
    type: String,
    enum: ["Drinks", "Food", "Coffee At Home"], // Define the allowed categories
    required: true,
  },
  isBestseller: {
    type: Boolean,
    default: false, // Default to false
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

// Create the Item model
const Item = mongoose.model("Item", ItemSchema)

export default Item
