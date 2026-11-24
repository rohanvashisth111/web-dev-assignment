const mongoose = require('mongoose');
const Product = require('../models/Product');

/**
 * @desc    Create a new product
 * @route   POST /api/products
 * @access  Public
 */
const createProduct = async (req, res, next) => {
  try {
    const { name, sku, category, price, quantity, reorderLevel, supplier } = req.body;

    // Validate required fields
    if (!name || !sku || !category || price === undefined || quantity === undefined || reorderLevel === undefined || !supplier) {
      return res.status(400).json({
        message: 'Please provide all required fields: name, sku, category, price, quantity, reorderLevel, supplier'
      });
    }

    // Validate numeric non-negative fields
    if (typeof price !== 'number' || price < 0) {
      return res.status(400).json({ message: 'Price must be a positive number or zero' });
    }
    if (typeof quantity !== 'number' || quantity < 0) {
      return res.status(400).json({ message: 'Quantity cannot be negative' });
    }
    if (typeof reorderLevel !== 'number' || reorderLevel < 0) {
      return res.status(400).json({ message: 'Reorder level cannot be negative' });
    }

    // Check for existing SKU
    const existingProduct = await Product.findOne({ sku: sku.toString().trim().toUpperCase() });
    if (existingProduct) {
      return res.status(400).json({
        message: `Duplicate SKU error: Product with SKU '${sku.toString().trim().toUpperCase()}' already exists`
      });
    }

    const product = new Product({
      name: name.trim(),
      sku: sku.toString().trim().toUpperCase(),
      category: category.trim(),
      price,
      quantity,
      reorderLevel,
      supplier: supplier.trim()
    });

    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all products with filtering, searching, sorting & pagination
 * @route   GET /api/products
 * @access  Public
 */
const getProducts = async (req, res, next) => {
  try {
    const {
      category,
      search,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 10
    } = req.query;

    const query = {};

    // Filter by Category
    if (category) {
      query.category = { $regex: new RegExp(`^${category.trim()}$`, 'i') };
    }

    // Search by Name or SKU
    if (search) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      query.$or = [{ name: searchRegex }, { sku: searchRegex }];
    }

    // Filter by minPrice & maxPrice
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) {
        const min = Number(minPrice);
        if (isNaN(min) || min < 0) {
          return res.status(400).json({ message: 'minPrice must be a non-negative number' });
        }
        query.price.$gte = min;
      }
      if (maxPrice !== undefined) {
        const max = Number(maxPrice);
        if (isNaN(max) || max < 0) {
          return res.status(400).json({ message: 'maxPrice must be a non-negative number' });
        }
        if (minPrice !== undefined && Number(minPrice) > max) {
          return res.status(400).json({ message: 'minPrice cannot be greater than maxPrice' });
        }
        query.price.$lte = max;
      }
    }

    // Validate Sorting Parameters
    const allowedSortFields = ['name', 'sku', 'category', 'price', 'quantity', 'reorderLevel', 'createdAt', 'updatedAt'];
    if (!allowedSortFields.includes(sortBy)) {
      return res.status(400).json({
        message: `Invalid sortBy parameter '${sortBy}'. Allowed fields: ${allowedSortFields.join(', ')}`
      });
    }

    const orderLower = sortOrder.toString().toLowerCase();
    let sortDirection;
    if (orderLower === 'asc' || orderLower === '1') {
      sortDirection = 1;
    } else if (orderLower === 'desc' || orderLower === '-1') {
      sortDirection = -1;
    } else {
      return res.status(400).json({
        message: "Invalid sortOrder parameter. Use 'asc' or 'desc'"
      });
    }

    // Validate Pagination Parameters
    const pageNum = Number(page);
    const limitNum = Number(limit);

    if (isNaN(pageNum) || !Number.isInteger(pageNum) || pageNum < 1) {
      return res.status(400).json({ message: 'page must be a positive integer starting from 1' });
    }
    if (isNaN(limitNum) || !Number.isInteger(limitNum) || limitNum < 1) {
      return res.status(400).json({ message: 'limit must be a positive integer greater than 0' });
    }

    const skip = (pageNum - 1) * limitNum;
    const total = await Product.countDocuments(query);
    const totalPages = Math.ceil(total / limitNum) || (total === 0 ? 0 : 1);

    const products = await Product.find(query)
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      total,
      page: pageNum,
      totalPages,
      count: products.length,
      products
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get low-stock products (quantity <= reorderLevel)
 * @route   GET /api/products/low-stock
 * @access  Public
 */
const getLowStockProducts = async (req, res, next) => {
  try {
    const lowStockItems = await Product.find({
      $expr: { $lte: ['$quantity', '$reorderLevel'] }
    }).sort({ quantity: 1 });

    res.status(200).json({
      count: lowStockItems.length,
      lowStockItems
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get category-wise inventory summary using MongoDB Aggregation
 * @route   GET /api/products/summary
 * @access  Public
 */
const getCategorySummary = async (req, res, next) => {
  try {
    const summary = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalStockValue: { $sum: { $multiply: ['$price', '$quantity'] } },
          avgPrice: { $avg: '$price' }
        }
      },
      {
        $project: {
          _id: 1,
          totalItems: 1,
          totalQuantity: 1,
          totalStockValue: { $round: ['$totalStockValue', 2] },
          avgPrice: { $round: ['$avgPrice', 2] }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.status(200).json({
      categories: summary.length,
      summary
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single product by ID
 * @route   GET /api/products/:id
 * @access  Public
 */
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: `Invalid product ID format: '${id}'` });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json(product);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update product details
 * @route   PUT /api/products/:id
 * @access  Public
 */
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: `Invalid product ID format: '${id}'` });
    }

    // Disallow negative values in updates
    if (req.body.price !== undefined && (typeof req.body.price !== 'number' || req.body.price < 0)) {
      return res.status(400).json({ message: 'Price must be a positive number or zero' });
    }
    if (req.body.quantity !== undefined && (typeof req.body.quantity !== 'number' || req.body.quantity < 0)) {
      return res.status(400).json({ message: 'Quantity cannot be negative' });
    }
    if (req.body.reorderLevel !== undefined && (typeof req.body.reorderLevel !== 'number' || req.body.reorderLevel < 0)) {
      return res.status(400).json({ message: 'Reorder level cannot be negative' });
    }

    // Check SKU conflict if sku is being updated
    if (req.body.sku) {
      const formattedSku = req.body.sku.toString().trim().toUpperCase();
      const duplicateProduct = await Product.findOne({ sku: formattedSku, _id: { $ne: id } });
      if (duplicateProduct) {
        return res.status(400).json({
          message: `Duplicate SKU error: Product with SKU '${formattedSku}' already exists`
        });
      }
      req.body.sku = formattedSku;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json(updatedProduct);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Adjust product stock level (increment / decrement)
 * @route   PATCH /api/products/:id/stock
 * @access  Public
 */
const adjustStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { change } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: `Invalid product ID format: '${id}'` });
    }

    if (change === undefined || change === null) {
      return res.status(400).json({ message: "The 'change' field is required in the request body" });
    }

    if (typeof change !== 'number' || isNaN(change)) {
      return res.status(400).json({ message: "The 'change' value must be a valid number" });
    }

    if (change === 0) {
      return res.status(400).json({ message: "Stock adjustment 'change' cannot be zero" });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const newQuantity = product.quantity + change;

    if (newQuantity < 0) {
      return res.status(400).json({
        message: `Insufficient stock: Current stock is ${product.quantity}, cannot reduce by ${Math.abs(change)}`
      });
    }

    product.quantity = newQuantity;
    await product.save();

    res.status(200).json({
      message: 'Stock updated',
      product
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete product
 * @route   DELETE /api/products/:id
 * @access  Public
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: `Invalid product ID format: '${id}'` });
    }

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json({
      message: 'Product deleted',
      id
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProduct,
  getProducts,
  getLowStockProducts,
  getCategorySummary,
  getProductById,
  updateProduct,
  adjustStock,
  deleteProduct
};
