import mongoose from "mongoose"
import dotenv from "dotenv"
import Item from "./models/Item.js" // Adjust the path based on your structure

dotenv.config()

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB connected")

    // Sample data for coffee shop items
    const items = [
      {
        name: "Espresso",
        description:
          "A strong coffee brewed by forcing hot water through finely-ground coffee beans.",
        price: 3.0,
        category: "Drinks",
        isBestseller: true,
      },
      {
        name: "Cappuccino",
        description:
          "Coffee mixed with steamed milk and topped with foamed milk.",
        price: 4.0,
        category: "Drinks",
        isBestseller: false,
      },
      {
        name: "Croissant",
        description: "A flaky, buttery pastry perfect for breakfast.",
        price: 2.5,
        category: "Food",
        isBestseller: false,
      },
      {
        name: "Cheesecake",
        description: "A creamy dessert made with cheese, eggs, and sugar.",
        price: 5.0,
        category: "Food",
        isBestseller: true,
      },
      {
        name: "Coffee Beans (1 kg)",
        description: "High-quality coffee beans for brewing at home.",
        price: 15.0,
        category: "Coffee At Home",
        isBestseller: true,
      },
      {
        name: "French Press",
        description: "A coffee maker for brewing coffee with a rich flavor.",
        price: 25.0,
        category: "Coffee At Home",
        isBestseller: false,
      },
    ]

    // Insert sample data into the database
    Item.insertMany(items)
      .then(() => {
        console.log("Sample data inserted")
        mongoose.connection.close() // Close the connection after inserting
      })
      .catch((err) => {
        console.error("Error inserting sample data:", err)
        mongoose.connection.close()
      })
  })
  .catch((err) => console.error("MongoDB connection error:", err))
