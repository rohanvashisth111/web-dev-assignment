const express = require('express');
const router = express.Router();
const {
  createProduct,
  getProducts,
  getLowStockProducts,
  getCategorySummary,
  getProductById,
  updateProduct,
  adjustStock,
  deleteProduct
} = require('../controllers/productController');

// 1. Root collection routes
router.route('/')
  .post(createProduct)
  .get(getProducts);

// 2. Specific static aggregation & report routes (MUST be declared before /:id)
router.route('/low-stock')
  .get(getLowStockProducts);

router.route('/summary')
  .get(getCategorySummary);

// 3. Stock adjustment route
router.route('/:id/stock')
  .patch(adjustStock);

// 4. Single resource routes by ID
router.route('/:id')
  .get(getProductById)
  .put(updateProduct)
  .delete(deleteProduct);

module.exports = router;
