import express from "express";
import bcrypt from "bcrypt";
import User from "../models/User.js"; // Assuming User model is defined in this path
import Joi from "joi";

const router = express.Router();

// Validation schema for registration input
const userSchema = Joi.object({
  username: Joi.string().min(3).max(30).required().alphanum(), // Username validation
  mobno: Joi.string()
    .length(10)
    .pattern(/^[0-9]+$/)
    .required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

// Register a new user
router.post("/signup", async (req, res) => {
  const { username, mobno, email, password } = req.body;

  // Validate input data
  const { error } = userSchema.validate({ username, mobno, email, password });
  if (error) {
    return res.status(400).json({ success: false, message: error.details[0].message });
  }

  try {
    // Check if the user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(409).json({ success: false, message: "User already exists" });
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    user = new User({
      username, // Include username here
      mobno,
      email,
      password: hashedPassword, // Save the hashed password
    });

    // Save the new user to the database
    await user.save();

    res.status(201).json({ success: true, message: "User registered successfully" });
  } catch (err) {
    console.error("Error during user registration:", err.message);
    res.status(500).json({ success: false, message: "Server error", details: err.message });
  }
});

export default router;
