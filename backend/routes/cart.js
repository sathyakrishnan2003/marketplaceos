const express = require('express');
const { authenticateAndLoadUser } = require('../middleware/auth');
const { getCart, addToCart, removeFromCart } = require('../controllers/cartController');

const router = express.Router();
router.use(authenticateAndLoadUser);
router.get('/', getCart);
router.post('/', addToCart);
router.delete('/:productId', removeFromCart);

module.exports = router;
