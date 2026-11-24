const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const Product = require('./models/Product');
const connectDB = require('./config/db');

const sampleProducts = [
  // 1. Electronics (4 items) - matches PDF Summary
  {
    name: 'Wireless Noise Cancelling Headphones',
    sku: 'ELEC-HP-001',
    category: 'Electronics',
    price: 4999,
    quantity: 9,
    reorderLevel: 5,
    supplier: 'Sony India'
  },
  {
    name: 'Mechanical Gaming Keyboard',
    sku: 'ELEC-KB-002',
    category: 'Electronics',
    price: 2999,
    quantity: 17,
    reorderLevel: 15,
    supplier: 'Logitech'
  },
  {
    name: '27-inch 4K Monitor',
    sku: 'ELEC-MN-003',
    category: 'Electronics',
    price: 12499,
    quantity: 10,
    reorderLevel: 12,
    supplier: 'Dell India' // Low stock (10 <= 12)
  },
  {
    name: 'Ergonomic Optical Mouse',
    sku: 'ELEC-MS-004',
    category: 'Electronics',
    price: 2049,
    quantity: 60,
    reorderLevel: 20,
    supplier: 'Logitech'
  },

  // 2. Apparel (2 items) - matches PDF Summary
  {
    name: "Men's Cotton Polo T-Shirt",
    sku: 'APPR-TS-101',
    category: 'Apparel',
    price: 799,
    quantity: 67,
    reorderLevel: 25,
    supplier: 'Allen Solly'
  },
  {
    name: 'Slim Fit Denim Jeans',
    sku: 'APPR-JN-102',
    category: 'Apparel',
    price: 1999,
    quantity: 11,
    reorderLevel: 15,
    supplier: 'Levi Strauss' // Low stock (11 <= 15)
  },

  // 3. Furniture (2 items) - includes Study Table from PDF Page 2 & 4
  {
    name: 'Study Table',
    sku: 'FURN-TB-012',
    category: 'Furniture',
    price: 3999,
    quantity: 2,
    reorderLevel: 4,
    supplier: 'IKEA India' // Low stock (2 <= 4)
  },
  {
    name: 'Ergonomic Office Chair',
    sku: 'FURN-CH-015',
    category: 'Furniture',
    price: 5499,
    quantity: 15,
    reorderLevel: 8,
    supplier: 'Featherlite'
  },

  // 4. Stationery (2 items) - includes Gel Pen Pack of 15 from PDF Page 3
  {
    name: 'Gel Pen Pack of 15',
    sku: 'STNY-PN-713',
    category: 'Stationery',
    price: 120,
    quantity: 40,
    reorderLevel: 20,
    supplier: 'Cello Pens'
  },
  {
    name: 'Spiral Notebook A4 Pack of 5',
    sku: 'STNY-NB-204',
    category: 'Stationery',
    price: 250,
    quantity: 8,
    reorderLevel: 10,
    supplier: 'Classmate' // Low stock (8 <= 10)
  },

  // 5. Books (2 items) - 5th category
  {
    name: 'JavaScript: The Definitive Guide',
    sku: 'BOOK-JS-501',
    category: 'Books',
    price: 1450,
    quantity: 25,
    reorderLevel: 10,
    supplier: "O'Reilly Media"
  },
  {
    name: 'Designing Data-Intensive Applications',
    sku: 'BOOK-DD-502',
    category: 'Books',
    price: 1850,
    quantity: 18,
    reorderLevel: 10,
    supplier: "O'Reilly Media"
  }
];

const seedData = async () => {
  try {
    await connectDB();

    console.log('[Seed] Clearing existing products...');
    await Product.deleteMany({});

    console.log('[Seed] Inserting 12 sample products...');
    const inserted = await Product.insertMany(sampleProducts);

    console.log(`[Seed] Successfully seeded ${inserted.length} products across 5 categories.`);
    console.log('[Seed] Summary of seeded data:');
    console.log(`  - Total Products: ${inserted.length}`);
    console.log(`  - Categories: Electronics (4), Apparel (2), Furniture (2), Stationery (2), Books (2)`);
    console.log(`  - Low Stock Items: 4 (ELEC-MN-003, APPR-JN-102, FURN-TB-012, STNY-NB-204)`);

    await mongoose.connection.close();
    console.log('[Seed] Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error(`[Seed Error] Seeding failed: ${error.message}`);
    process.exit(1);
  }
};

seedData();
