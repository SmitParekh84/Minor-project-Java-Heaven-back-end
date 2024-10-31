import mongoose from "mongoose"
// Define the schema for each cart item
const cartItemSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  category: {
    type: String,
  },
  description: {
    type: String,
  },
  imageUrl: {
    type: String,
  },
  isBestseller: {
    type: Boolean,
    default: false,
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
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true, // Ensure that this is marked as required
  },
  password: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true, // Ensure email is unique
  },
  role: {
    type: String,
    default: 'user', // or 'admin'
  },
  mobno: {
    type: String,
    required: true,
  },
  resetOTP: {
    type: String, // OTP for password reset
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  address: {
    type: String,
    required: false,
  },
  sessionId: { type: String, default: null },
  cartItems: [cartItemSchema],


});

// Ensure to use the model only if it hasn't been defined yet
const User = mongoose.models.User || mongoose.model("User", userSchema)

export default User
