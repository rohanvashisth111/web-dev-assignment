const http = require('http');
const dotenv = require('dotenv');

dotenv.config();

const { app, startServer } = require('./server');

const request = (server, options, body = null) => {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const reqOptions = {
      hostname: '127.0.0.1',
      port: address.port,
      path: options.path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const runTests = async () => {
  console.log('\n==================================================');
  console.log('   INVENTORY API COMPREHENSIVE AUTOMATED TESTS    ');
  console.log('==================================================\n');

  let server;
  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  [PASS] ${description}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${description}`);
      failed++;
    }
  };

  try {
    // Start server on an ephemeral port or configured PORT
    server = await startServer();

    let createdId = null;

    // Test 1: Root Health Check
    console.log('\n--- 1. Server Health Check ---');
    const health = await request(server, { path: '/', method: 'GET' });
    assert(health.status === 200 && health.data.success === true, 'Root health endpoint returns 200 OK');

    // Test 2: Create Product (POST /api/products)
    console.log('\n--- 2. Create Product (POST /api/products) ---');
    const newProductPayload = {
      name: 'Gel Pen Pack of 20 (Test)',
      sku: 'TEST-PEN-999',
      category: 'Stationery',
      price: 150,
      quantity: 50,
      reorderLevel: 15,
      supplier: 'Cello Pens'
    };
    const postRes = await request(server, { path: '/api/products', method: 'POST' }, newProductPayload);
    assert(postRes.status === 201, 'POST /api/products returns HTTP 201');
    assert(postRes.data.sku === 'TEST-PEN-999', 'Returns created product with uppercase SKU');
    assert(postRes.data.stockValue === 7500, `Calculated stockValue is correct (expected 7500, got ${postRes.data.stockValue})`);
    assert(postRes.data.id || postRes.data._id, 'Returns product id');
    createdId = postRes.data._id || postRes.data.id;

    // Test 3: Duplicate SKU Prevention
    console.log('\n--- 3. Duplicate SKU Error Test ---');
    const dupRes = await request(server, { path: '/api/products', method: 'POST' }, newProductPayload);
    assert(dupRes.status === 400, 'Duplicate SKU returns HTTP 400 Bad Request');
    assert(dupRes.data.message.includes('Duplicate SKU error'), 'Returns informative duplicate SKU error message');

    // Test 4: Schema Validation (Missing required fields & Negative values)
    console.log('\n--- 4. Schema Validation Tests ---');
    const missingRes = await request(server, { path: '/api/products', method: 'POST' }, { name: 'Incomplete' });
    assert(missingRes.status === 400, 'Missing fields returns HTTP 400 Bad Request');

    const negPriceRes = await request(server, { path: '/api/products', method: 'POST' }, {
      name: 'Bad Price',
      sku: 'BAD-PRICE-001',
      category: 'Test',
      price: -50,
      quantity: 10,
      reorderLevel: 5,
      supplier: 'Tester'
    });
    assert(negPriceRes.status === 400, 'Negative price rejected with HTTP 400');

    // Test 5: Get All Products (GET /api/products)
    console.log('\n--- 5. Get All Products & Pagination ---');
    const getAllRes = await request(server, { path: '/api/products?page=1&limit=10', method: 'GET' });
    assert(getAllRes.status === 200, 'GET /api/products returns HTTP 200 OK');
    assert(getAllRes.data.total >= 13, `Total products count is >= 13 (got ${getAllRes.data.total})`);
    assert(getAllRes.data.page === 1, 'Page number is 1');
    assert(getAllRes.data.count <= 10, 'Limit restricts count to 10');
    assert(Array.isArray(getAllRes.data.products), 'products is an array');
    assert(getAllRes.data.products[0].stockValue !== undefined, 'Products include stockValue');

    // Test 6: Filtering by Category
    console.log('\n--- 6. Filter by Category ---');
    const catRes = await request(server, { path: '/api/products?category=Electronics', method: 'GET' });
    assert(catRes.status === 200, 'Category filter returns HTTP 200');
    assert(catRes.data.products.every(p => p.category.toLowerCase() === 'electronics'), 'All returned products match category');

    // Test 7: Search by Name or SKU
    console.log('\n--- 7. Search by Name & SKU ---');
    const searchNameRes = await request(server, { path: '/api/products?search=Keyboard', method: 'GET' });
    assert(searchNameRes.data.products.some(p => p.name.includes('Keyboard')), 'Search by name returns matching product');

    const searchSkuRes = await request(server, { path: '/api/products?search=TEST-PEN', method: 'GET' });
    assert(searchSkuRes.data.products.some(p => p.sku === 'TEST-PEN-999'), 'Search by SKU returns matching product');

    // Test 8: Price Range Filter
    console.log('\n--- 8. Price Range Filter (minPrice & maxPrice) ---');
    const priceRes = await request(server, { path: '/api/products?minPrice=1000&maxPrice=5000', method: 'GET' });
    assert(priceRes.status === 200, 'Price range filter returns HTTP 200');
    assert(priceRes.data.products.every(p => p.price >= 1000 && p.price <= 5000), 'All products are within price range');

    // Test 9: Sorting
    console.log('\n--- 9. Sorting (Price Ascending) ---');
    const sortAscRes = await request(server, { path: '/api/products?sortBy=price&sortOrder=asc&limit=20', method: 'GET' });
    const prices = sortAscRes.data.products.map(p => p.price);
    const isSortedAsc = prices.every((v, i) => i === 0 || v >= prices[i - 1]);
    assert(isSortedAsc, 'Products properly sorted by price ascending');

    // Test 10: Low-Stock Alert (GET /api/products/low-stock)
    console.log('\n--- 10. Low-Stock Report (GET /api/products/low-stock) ---');
    const lowStockRes = await request(server, { path: '/api/products/low-stock', method: 'GET' });
    assert(lowStockRes.status === 200, 'GET /api/products/low-stock returns HTTP 200');
    assert(lowStockRes.data.count >= 4, `Low stock count is >= 4 (got ${lowStockRes.data.count})`);
    assert(lowStockRes.data.lowStockItems.every(p => p.quantity <= p.reorderLevel), 'Every low-stock item has quantity <= reorderLevel');
    assert(lowStockRes.data.lowStockItems[0].stockValue !== undefined, 'Low stock items include stockValue');

    // Test 11: Category Summary Aggregation (GET /api/products/summary)
    console.log('\n--- 11. Category Summary Aggregation (GET /api/products/summary) ---');
    const summaryRes = await request(server, { path: '/api/products/summary', method: 'GET' });
    assert(summaryRes.status === 200, 'GET /api/products/summary returns HTTP 200');
    assert(summaryRes.data.categories >= 5, `Summary reports categories count (got ${summaryRes.data.categories})`);
    assert(Array.isArray(summaryRes.data.summary), 'Summary contains aggregation array');
    const elecCat = summaryRes.data.summary.find(c => c._id === 'Electronics');
    assert(elecCat !== undefined, 'Electronics category found in aggregation');
    assert(elecCat.totalItems === 4, `Electronics totalItems is 4 (got ${elecCat.totalItems})`);
    assert(elecCat.totalQuantity === 96, `Electronics totalQuantity is 96 (got ${elecCat.totalQuantity})`);
    assert(elecCat.totalStockValue === 343904, `Electronics totalStockValue matches PDF (expected 343904, got ${elecCat.totalStockValue})`);
    assert(elecCat.avgPrice === 5636.5, `Electronics avgPrice matches PDF (expected 5636.5, got ${elecCat.avgPrice})`);

    // Test 12: Get Single Product by ID (GET /api/products/:id)
    console.log('\n--- 12. Get Single Product (GET /api/products/:id) ---');
    const getSingleRes = await request(server, { path: `/api/products/${createdId}`, method: 'GET' });
    assert(getSingleRes.status === 200, 'GET /api/products/:id returns HTTP 200');
    assert(getSingleRes.data.name === 'Gel Pen Pack of 20 (Test)', 'Returns accurate product details');
    assert(getSingleRes.data.stockValue === 7500, 'Includes calculated stockValue');

    // Test 13: Update Product (PUT /api/products/:id)
    console.log('\n--- 13. Update Product (PUT /api/products/:id) ---');
    const updatePayload = {
      price: 180,
      quantity: 60
    };
    const putRes = await request(server, { path: `/api/products/${createdId}`, method: 'PUT' }, updatePayload);
    assert(putRes.status === 200, 'PUT /api/products/:id returns HTTP 200');
    assert(putRes.data.price === 180, 'Updated price reflected');
    assert(putRes.data.quantity === 60, 'Updated quantity reflected');
    assert(putRes.data.stockValue === 180 * 60, `Updated stockValue recalculated (expected 10800, got ${putRes.data.stockValue})`);

    // Test 14: Stock Increment (PATCH /api/products/:id/stock)
    console.log('\n--- 14. Stock Increment (PATCH /api/products/:id/stock) ---');
    const incRes = await request(server, { path: `/api/products/${createdId}/stock`, method: 'PATCH' }, { change: 10 });
    assert(incRes.status === 200, 'Stock increment returns HTTP 200');
    assert(incRes.data.message === 'Stock updated', 'Returns "Stock updated" message');
    assert(incRes.data.product.quantity === 70, `Quantity increased from 60 to 70 (got ${incRes.data.product.quantity})`);
    assert(incRes.data.product.stockValue === 70 * 180, 'Stock value dynamically updated');

    // Test 15: Stock Decrement (PATCH /api/products/:id/stock)
    console.log('\n--- 15. Stock Decrement (PATCH /api/products/:id/stock) ---');
    const decRes = await request(server, { path: `/api/products/${createdId}/stock`, method: 'PATCH' }, { change: -20 });
    assert(decRes.status === 200, 'Stock decrement returns HTTP 200');
    assert(decRes.data.product.quantity === 50, `Quantity decreased from 70 to 50 (got ${decRes.data.product.quantity})`);

    // Test 16: Negative Stock Rejection
    console.log('\n--- 16. Negative Stock Rejection ---');
    const negStockRes = await request(server, { path: `/api/products/${createdId}/stock`, method: 'PATCH' }, { change: -100 });
    assert(negStockRes.status === 400, 'Prevent negative stock returns HTTP 400 Bad Request');
    assert(negStockRes.data.message.includes('Insufficient stock'), 'Returns informative insufficient stock message');

    // Test 17: Zero Stock Adjustment Rejection
    console.log('\n--- 17. Zero Stock Adjustment Rejection ---');
    const zeroStockRes = await request(server, { path: `/api/products/${createdId}/stock`, method: 'PATCH' }, { change: 0 });
    assert(zeroStockRes.status === 400, 'Zero stock change returns HTTP 400 Bad Request');

    // Test 18: Invalid ID Formats
    console.log('\n--- 18. Invalid MongoDB ID Handling ---');
    const invalidIdRes = await request(server, { path: '/api/products/not-a-valid-id', method: 'GET' });
    assert(invalidIdRes.status === 400, 'Invalid ID returns HTTP 400 Bad Request');
    assert(invalidIdRes.data.message.includes('Invalid product ID format'), 'Returns clear invalid ID error message');

    // Test 19: Non-existent Product ID
    console.log('\n--- 19. Non-existent Product Handling ---');
    const notFoundId = '65f1a2b3c4d5e6f7a8b9c0d1';
    const notFoundRes = await request(server, { path: `/api/products/${notFoundId}`, method: 'GET' });
    assert(notFoundRes.status === 404, 'Non-existent product returns HTTP 404 Not Found');

    // Test 20: Delete Product (DELETE /api/products/:id)
    console.log('\n--- 20. Delete Product (DELETE /api/products/:id) ---');
    const delRes = await request(server, { path: `/api/products/${createdId}`, method: 'DELETE' });
    assert(delRes.status === 200, 'DELETE /api/products/:id returns HTTP 200');
    assert(delRes.data.message === 'Product deleted', 'Returns "Product deleted" message');
    assert(delRes.data.id === createdId.toString(), 'Returns deleted product id');

    // Test 21: Verify Deletion
    console.log('\n--- 21. Verify Product Deletion ---');
    const verifyDelRes = await request(server, { path: `/api/products/${createdId}`, method: 'GET' });
    assert(verifyDelRes.status === 404, 'Deleted product is no longer found (HTTP 404)');

    // Test 22: Unhandled Route 404
    console.log('\n--- 22. Unhandled Route 404 ---');
    const unhandledRes = await request(server, { path: '/api/non-existent-route', method: 'GET' });
    assert(unhandledRes.status === 404, 'Unhandled route returns HTTP 404 Not Found');

    console.log('\n==================================================');
    console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED   `);
    console.log('==================================================\n');

    server.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error(`[Test Runner Error] ${error.message}`);
    if (server) server.close();
    process.exit(1);
  }
};

runTests();
