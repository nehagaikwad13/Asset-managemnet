const mysql = require('mysql2');

// Create connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Neha@012004',
  database: 'asset_management'
});

// Connect to database
db.connect((err) => {
  if (err) {
    console.log('Database connection failed, using sample data');
  } else {
    console.log('Connected to MySQL database');
  }
});

module.exports = db;