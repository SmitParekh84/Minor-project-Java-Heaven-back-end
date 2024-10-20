import mongoose from "mongoose"

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
    
  

})

// Ensure to use the model only if it hasn't been defined yet
const User = mongoose.models.User || mongoose.model("User", userSchema)

export default User
