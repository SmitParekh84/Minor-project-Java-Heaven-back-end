import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import session from "express-session";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import hpp from "hpp";

import compression from "compression";
import signupRoute from "./route/signup.js";
import itemRoute from "./route/item.js";
import orderRoute from "./route/order.js";
import authRoute from "./route/auth.js";
import forgotPasswordRoute from "./route/forgotPassword.js";
import dashboardRoute from "./route/dashboard.js";
import userRoute from "./route/user.js";
import revenueRoute from './route/revenue.js';
import cartRoute from './route/cart.js';
import stockRoute from './route/stock.js'
dotenv.config();

const app = express();

// Security Headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));



// Enable CORS
app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));

// Logger
app.use(morgan("combined"));

// Body Parser
app.use(express.json());

// Input Sanitization
app.use(mongoSanitize());
app.use(xss());

// Prevent HTTP Parameter Pollution
app.use(hpp());

// Compression
app.use(compression());

// Session Management
app.use(
  session({
    secret: process.env.SESSION_SECRET || "080402",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true if using HTTPS
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
      maxAge: 1000 * 60 * 60 // 1 hour
    },
  })
);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI).then(() => {
  console.log("MongoDB connected");
}).catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/api", authRoute);
app.use("/api", signupRoute);
app.use("/api/items", itemRoute);
app.use("/api", orderRoute);
app.use("/api/stock", stockRoute);
app.use("/api", forgotPasswordRoute);
app.use("/api", dashboardRoute);
app.use("/api", userRoute);
app.use('/api/revenue', revenueRoute);
app.use("/api", cartRoute);
// Undefined Routes
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error Handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal Server Error", error: err.message });
});

// Graceful Shutdown
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("MongoDB connection closed.");
  process.exit(0);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
