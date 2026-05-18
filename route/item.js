import express from 'express';
import { body, validationResult } from 'express-validator';
import Item from '../models/Item.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = express.Router();

const validateItemId = (req, res, next) => {
  if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
    return res.status(400).json({ success: false, msg: 'Invalid item ID format' });
  }
  next();
};

const itemBodyValidators = [
  body('name').notEmpty().withMessage('Name is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('price').isNumeric().withMessage('Price must be a number'),
  body('category').notEmpty().withMessage('Category is required'),
  body('imageUrl').notEmpty().withMessage('Image URL is required'),
];

// GET /api/items — public
router.get('/', asyncHandler(async (req, res) => {
  const { category } = req.query;
  const query = category ? { category } : {};
  const items = await Item.find(query);

  if (!items.length) {
    return res.status(404).json({ success: false, msg: category ? 'No items found for this category' : 'No items found' });
  }

  res.status(200).json(items);
}));

// GET /api/items/uniq/categories — public
router.get('/uniq/categories', asyncHandler(async (req, res) => {
  const categories = await Item.distinct('category');
  res.status(200).json(categories);
}));

// GET /api/items/:id — public
router.get('/:id', validateItemId, asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) return res.status(404).json({ success: false, msg: 'Item not found' });
  res.status(200).json(item);
}));

// POST /api/items — admin only
router.post('/', authenticate, requireAdmin, itemBodyValidators, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { name, description, price, category, isBestseller, imageUrl } = req.body;
  const newItem = new Item({ name, description, price, category, isBestseller, imageUrl });
  await newItem.save();

  res.status(201).json(newItem);
}));

// PUT /api/items/:id — admin only
router.put('/:id', authenticate, requireAdmin, validateItemId, itemBodyValidators, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { name, description, price, category, isBestseller, imageUrl } = req.body;
  const updatedItem = await Item.findByIdAndUpdate(
    req.params.id,
    { name, description, price, category, isBestseller, imageUrl },
    { new: true }
  );

  if (!updatedItem) return res.status(404).json({ success: false, msg: 'Item not found' });
  res.status(200).json(updatedItem);
}));

// DELETE /api/items/:id — admin only
router.delete('/:id', authenticate, requireAdmin, validateItemId, asyncHandler(async (req, res) => {
  const deleted = await Item.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, msg: 'Item not found' });
  res.status(204).send();
}));

export default router;
