import express from "express"
import bcrypt from "bcrypt"
import User from "../models/User.js" // Assuming User model is defined in this path

const router = express.Router()

// Login a user
router.post("/login", async (req, res) => {
  const { email, password, mobno, username } = req.body

  // Validate that at least one identifier is provided
  if (!email && !mobno && !username) {
    return res
      .status(400)
      .json({ msg: "Email, mobile number, or username is required" })
  }

  try {
    // Create a query to find the user by email, mobile number, or username
    const query = email ? { email } : mobno ? { mobno } : { username } // Ensure at least one is set

    // Check if the user exists
    const user = await User.findOne(query)
    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials" })
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password) // Ensure you're comparing the hashed password
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials" })
    }

    res.status(200).json({ msg: "Login successful" })
  } catch (err) {
    console.error(err.message)
    res.status(500).send("Server error")
  }
})

export default router
