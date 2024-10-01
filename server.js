import express from "express"
import mongoose from "mongoose"

const app = express()

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

mongoose.connection.on("connected", () => {
  console.log("MongoDB connected")
})

// Middleware to parse JSON requests
app.use(express.json())

// Start the server
const PORT = 5000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
