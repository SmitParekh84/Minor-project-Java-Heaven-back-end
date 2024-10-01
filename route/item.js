import express from "express"
import Item from "../models/Item.js"

const router = express.Router()

// Get all items or filter by category
router.get("/", async (req, res) => {
  const { category } = req.query // Get the category from query parameters

  try {
    let items

    // If a category is provided, filter items by category
    if (category) {
      items = await Item.find({ category })
      if (items.length === 0) {
        return res.status(404).json({ msg: "No items found for this category" })
      }
    } else {
      // If no category is provided, get all items
      items = await Item.find()
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

// Create a new item
router.post("/", async (req, res) => {
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
    res.status(201).json(newItem)
  } catch (err) {
    console.error(err.message)
    res.status(500).send("Server error")
  }
})

export default router
