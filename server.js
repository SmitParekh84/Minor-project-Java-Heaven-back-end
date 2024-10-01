import express from "express"
import mongoose from "mongoose"
import dotenv from "dotenv"
import cors from "cors" // Import the cors package
import loginRoute from "./route/login.js" // Login route
import signupRoute from "./route/signup.js" // Sign-up route
import itemRoute from "./route/item.js" // Import item route

dotenv.config()

const app = express()

// Middleware to enable CORS
app.use(
  cors({
    origin: "http://localhost:5173", // Allow requests from your frontend
    methods: ["GET", "POST", "PUT", "DELETE"], // Allowed methods
    credentials: true, // Enable credentials if needed (cookies, authorization headers)
  })
)

// Middleware to parse JSON requests
app.use(express.json())

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err))

// Routes
app.use("/api", loginRoute) // Login route
app.use("/api", signupRoute) // Sign-up route
app.use("/api/items", itemRoute)

// Handle undefined routes
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port http://localhost:${PORT}`)
})
