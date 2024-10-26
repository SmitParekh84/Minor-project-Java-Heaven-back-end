import express from 'express';

const router = express.Router();

let cart = [];

// Calculate subtotal
const calculateSubtotal = () => {
    return cart.reduce((total, coffee) => total + (coffee.price * coffee.quantity), 0);
};

// Add coffee to cart
router.post('/add', (req, res) => {
    const { id, name, price, quantity, size } = req.body;

    // Input validation
    if (!['small', 'medium', 'large'].includes(size)) {
        return res.status(400).json({ message: 'Invalid size. Size must be small, medium, or large.' });
    }
    if (!id || !name || typeof price !== 'number' || price <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ message: 'Invalid input. Ensure all fields are correctly filled.' });
    }

    const coffee = { id, name, price, quantity, size };
    cart.push(coffee);
    const subtotal = calculateSubtotal();
    res.status(201).json({ message: 'Coffee added to cart', cart, subtotal });
});

// Get all items in cart
router.get('/', (req, res) => {
    const subtotal = calculateSubtotal();
    res.status(200).json({ cart, subtotal });
});

// Remove coffee from cart
router.delete('/remove/:id', (req, res) => {
    const { id } = req.params;
    const originalLength = cart.length;
    cart = cart.filter(coffee => coffee.id !== id);
    
    if (cart.length === originalLength) {
        return res.status(404).json({ message: 'Coffee not found in cart' });
    }
    
    const subtotal = calculateSubtotal();
    res.status(200).json({ message: 'Coffee removed from cart', cart, subtotal });
});

// Update coffee quantity in cart
router.put('/update/:id', (req, res) => {
    const { id } = req.params;
    const { quantity, size } = req.body;

    if (size && !['small', 'medium', 'large'].includes(size)) {
        return res.status(400).json({ message: 'Invalid size. Size must be small, medium, or large.' });
    }

    if (quantity && (!Number.isInteger(quantity) || quantity <= 0)) {
        return res.status(400).json({ message: 'Quantity must be a positive integer.' });
    }

    const coffeeIndex = cart.findIndex(coffee => coffee.id === id);
    if (coffeeIndex === -1) {
        return res.status(404).json({ message: 'Coffee not found in cart' });
    }

    cart[coffeeIndex] = { ...cart[coffeeIndex], quantity, size: size || cart[coffeeIndex].size };
    const subtotal = calculateSubtotal();
    res.status(200).json({ message: 'Coffee quantity updated', cart, subtotal });
});

export default router;
