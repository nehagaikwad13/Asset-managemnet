const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 3000;

// Database functions
const getAssets = () => {
  return new Promise((resolve, reject) => {
    db.query('SELECT * FROM assets', (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes 
app.get('/', async (req, res) => {
  try {
    const assets = await getAssets();
    const stats = { total: assets.length, assigned: assets.filter(a => a.assigned).length, available: assets.filter(a => !a.assigned).length, reports: 12 };
    res.render('index', { stats, assets, showSidebar: true });
  } catch (err) {
    console.error(err);
    res.render('index', { stats: {total: 0, assigned: 0, available: 0, reports: 0}, assets: [], showSidebar: true });
  }
});

app.get('/add-product', (req, res) => {
  res.render('add-product');
});

app.post('/add-product', (req, res) => {
  const query = 'INSERT INTO assets (name, type, model, serial) VALUES (?, ?, ?, ?)';
  db.query(query, [req.body.name, req.body.type, req.body.model || 'N/A', req.body.serial], (err) => {
    if (err) console.error(err);
    res.redirect('/');
  });
});

app.get('/assign-product', async (req, res) => {
  try {
    const assets = await getAssets();
    const availableAssets = assets.filter(a => !a.assigned);
    res.render('assign-product', { assets: availableAssets });
  } catch (err) {
    console.error(err);
    res.render('assign-product', { assets: [] });
  }
});

app.post('/assign-product', (req, res) => {
  const assetId = parseInt(req.body.assetId);
  const query = 'UPDATE assets SET assigned = true, employee = ?, dateAssigned = ? WHERE id = ?';
  db.query(query, [req.body.employeeName, req.body.dateAssigned, assetId], (err) => {
    if (err) console.error(err);
    res.redirect('/view-database');
  });
});

// View all assets from database
app.get('/view-database', async (req, res) => {
  try {
    const assets = await getAssets(); // Get all assets from MySQL
    res.render('view-database', { assets });
  } catch (err) {
    console.error(err);
    res.render('view-database', { assets: [] }); // Show empty list if database fails
  }
});

// Show assigned assets that can be returned
app.get('/return-product', async (req, res) => {
  try {
    const assets = await getAssets(); // Get all assets from MySQL database
    const assignedAssets = assets.filter(a => a.assigned); // Keep only assets that are assigned to employees
    res.render('return-product', { assets: assignedAssets }); // Send assigned assets to return page
  } catch (err) {
    console.error('Error getting assets for return:', err);
    res.render('return-product', { assets: [] }); // Show empty list if database connection fails
  }
});

// Process asset return - mark as available
app.post('/return-product', (req, res) => {
  const assetId = parseInt(req.body.assetId); // Get asset ID from form
  // Update database: set assigned=false, returned=true, remove employee
  const query = 'UPDATE assets SET assigned = false, returned = true, employee = NULL WHERE id = ?';
  db.query(query, [assetId], (err) => {
    if (err) console.error('Error returning asset:', err);
    res.redirect('/view-database'); // Go back to database view
  });
});

// Generate reports from database data
app.get('/reports', async (req, res) => {
  try {
    const assets = await getAssets(); // Get all assets from MySQL database
    res.render('reports', { assets }); // Send all assets to reports page for analysis and charts
  } catch (err) {
    console.error('Error getting assets for reports:', err);
    res.render('reports', { assets: [] }); // Show empty reports if database connection fails
  }
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});