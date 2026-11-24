const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true
    },
    sku: {
      type: String,
      required: [true, 'Product SKU is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be a positive number or zero']
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative']
    },
    reorderLevel: {
      type: Number,
      required: [true, 'Reorder level is required'],
      min: [0, 'Reorder level cannot be negative']
    },
    supplier: {
      type: String,
      required: [true, 'Supplier is required'],
      trim: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual field for calculated stockValue (price * quantity)
productSchema.virtual('stockValue').get(function () {
  const price = typeof this.price === 'number' ? this.price : 0;
  const quantity = typeof this.quantity === 'number' ? this.quantity : 0;
  return Math.round(price * quantity * 100) / 100;
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
