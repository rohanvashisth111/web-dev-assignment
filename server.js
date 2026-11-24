const express = require('express');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const connectDB = require('./config/db.js');
const productRoutes = require('./routes/productRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root welcome / health route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the Inventory and Data Management System REST API',
    endpoints: {
      products: '/api/products',
      lowStock: '/api/products/low-stock',
      summary: '/api/products/summary'
    }
  });
});

// API Routes
app.use('/api/products', productRoutes);

// Error Handling Middleware (must be registered after routes)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Start server only after database connection succeeds
const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      console.log(`[Server] Inventory API running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
    return server;
  } catch (error) {
    console.error(`[Server Error] Initialization failed: ${error.message}`);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
