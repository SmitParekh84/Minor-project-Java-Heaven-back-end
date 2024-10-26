// server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import session from "express-session";
import cors from "cors"; // Import the cors package
import helmet from "helmet"; // Import helmet for security
import morgan from "morgan"; // Import morgan for logging
import signupRoute from "./route/signup.js"; // Sign-up route
import itemRoute from "./route/item.js"; // Import item route
import orderRoute from "./route/order.js"; // Import order route
import authRoute from "./route/auth.js"; // Import auth route (for login/signup)
import forgotPasswordRoute from "./route/forgotPassword.js"; // Import forgot password route
import dashboardRoute from "./route/dashboard.js"; // Import dashboard route
import userRoute from "./route/user.js"; // Import the new user route
import revenueRoute from './route/revenue.js';

dotenv.config(); // Load environment variables

const app = express();

// Middleware for security
app.use(helmet());

// Middleware for logging
app.use(morgan("combined"));


// app.use(cors()); // Allow all origins temporarily (for debugging)
// Middleware to enable CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL, // Allow requests from your frontend
    methods: ["GET", "POST", "PUT", "DELETE"], // Allowed methods
    credentials: true, // Enable credentials if needed
  })
);

app.use((req, res, next) => {
  console.log('Request Origin:', req.headers.origin);
  next();
});


// Middleware to parse JSON requests
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "080402",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to true if using HTTPS
  })
);

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/api", authRoute);
app.use("/api", signupRoute); // Sign-up route
app.use("/api/items", itemRoute); // Item route
app.use("/api", orderRoute); // Order route
app.use("/api", forgotPasswordRoute); // Use forgot password route
app.use("/api", dashboardRoute); // Dashboard statistics route
app.use("/api", userRoute); // Use the user route
app.use('/api/revenue', revenueRoute);

// Handle undefined routes
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Define a simple GET route for a welcome message
app.get("/", (req, res) => {
  res.send("Welcome to the Coffee Shop Management System API");
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal Server Error", error: err.message });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("MongoDB connection closed.");
  process.exit(0);
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
