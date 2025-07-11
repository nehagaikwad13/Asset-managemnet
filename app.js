const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 8080;

// Sample data
let assets = [
  { id: 1, name: 'Dell Laptop', type: 'Hardware', model: 'Latitude 5430', serial: 'DL5430-2023', assigned: true, employee: 'John Doe', dateAssigned: '2024-11-01', returned: false },
  { id: 2, name: 'Office Suite', type: 'Software', model: 'v2023', serial: 'SWOFF-333', assigned: false, employee: null, dateAssigned: null, returned: false }
];

let stats = { total: 145, assigned: 86, available: 59, reports: 12 };

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.get('/', (req, res) => {
  res.render('index', { stats, assets, showSidebar: true }); // or false, as needed
});

app.get('/add-product', (req, res) => {
  res.render('add-product');
});

app.post('/add-product', (req, res) => {
  const newAsset = {
    id: assets.length + 1,
    name: req.body.name,
    type: req.body.type,
    model: req.body.model || 'N/A',
    serial: req.body.serial,
    assigned: false,
    employee: null,
    dateAssigned: null,
    returned: false
  };
  assets.push(newAsset);
  res.redirect('/');
});

app.get('/assign-product', (req, res) => {
  res.render('assign-product', { assets: assets.filter(a => !a.assigned) });
});

app.post('/assign-product', (req, res) => {
  const assetId = parseInt(req.body.assetId);
  const asset = assets.find(a => a.id === assetId);
  if (asset) {
    asset.assigned = true;
    asset.employee = req.body.employeeName;
    asset.dateAssigned = req.body.dateAssigned;
  }
  res.redirect('/view-database');
});

app.get('/view-database', (req, res) => {
  res.render('view-database', { assets });
});

app.get('/return-product', (req, res) => {
  res.render('return-product', { assets: assets.filter(a => a.assigned) });
});

app.post('/return-product', (req, res) => {
  const assetId = parseInt(req.body.assetId);
  const asset = assets.find(a => a.id === assetId);
  if (asset) {
    asset.assigned = false;
    asset.returned = true;
    asset.employee = null;
  }
  res.redirect('/view-database');
});

app.get('/reports', (req, res) => {
  res.render('reports', { assets });
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});