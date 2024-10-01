import express from "express"
import Item from "../models/Item.js"
import { body, validationResult } from "express-validator" // Import express-validator

const router = express.Router()

// Get all items or filter by category
router.get("/", async (req, res) => {
  const { category } = req.query // Get the category from query parameters

  try {
    const query = category ? { category } : {} // Create a query based on the presence of a category
    const items = await Item.find(query) // Fetch items based on the query

    if (!items.length) {
      return res.status(404).json({
        msg: category ? "No items found for this category" : "No items found",
      })
    }

    res.status(200).json(items)
  } catch (err) {
    console.error(err.message)
    res.status(500).send("Server error")
  }
})

// Get an item by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params // Extract the ID from the URL parameters

  // Validate ID format
  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    return res.status(400).json({ msg: "Invalid item ID format" })
  }

  try {
    const item = await Item.findById(id) // Find item by ID
    if (!item) {
      return res.status(404).json({ msg: "Item not found" })
    }
    res.status(200).json(item)
  } catch (err) {
    console.error(err.message)
    res.status(500).send("Server error")
  }
})

// Create a new item with validation
router.post(
  "/",
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("price").isNumeric().withMessage("Price must be a number"),
    body("category").notEmpty().withMessage("Category is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() }) // Return errors if validation fails
    }

    const { name, description, price, category, isBestseller } = req.body

    try {
      const newItem = new Item({
        name,
        description,
        price,
        category,
        isBestseller,
      })

      await newItem.save()
      res.status(201).json(newItem) // Respond with the created item
    } catch (err) {
      console.error(err.message)
      res.status(500).send("Server error")
    }
  }
)

export default router
