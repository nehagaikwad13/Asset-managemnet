const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = 3000;

// Session middleware
app.use(session({
  secret: 'asset-management-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Serve static files
app.use('/qr-codes', express.static(path.join(__dirname, 'public/qr-codes')));

// Database functions
const getAssets = (departmentId = null) => {
  return new Promise((resolve, reject) => {
    const query = departmentId ? 'SELECT a.*, u.full_name as assigned_user FROM assets a LEFT JOIN users u ON a.assigned_to_user_id = u.id WHERE a.department_id = ?' : 'SELECT a.*, u.full_name as assigned_user FROM assets a LEFT JOIN users u ON a.assigned_to_user_id = u.id';
    const params = departmentId ? [departmentId] : [];
    db.query(query, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

const getDepartments = () => {
  return new Promise((resolve, reject) => {
    db.query('SELECT * FROM departments', (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  next();
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.session.user || !roles.includes(req.session.user.role)) {
      return res.status(403).send('Access denied');
    }
    next();
  };
};

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.get('/', async (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  try {
    const departments = await getDepartments();
    res.render('department-select', { departments });
  } catch (err) {
    console.error(err);
    res.render('department-select', { departments: [] });
  }
});

app.get('/dashboard', requireAuth, async (req, res) => {
  const user = req.session.user;
  console.log('Dashboard accessed by:', user.username, 'Role:', user.role);
  
  try {
    if (user.role === 'core_team') {
      const [assets, totalUsers, activeUsers, pendingRequests] = await Promise.all([
        getAssets(user.department_id),
        new Promise((resolve, reject) => {
          db.query('SELECT COUNT(*) as count FROM users WHERE department_id = ?', [user.department_id], (err, results) => {
            if (err) { console.error('Total users query error:', err); resolve(0); }
            else resolve(results[0]?.count || 0);
          });
        }),
        new Promise((resolve, reject) => {
          db.query('SELECT COUNT(DISTINCT user_id) as count FROM asset_requests WHERE DATE(request_date) = CURDATE()', [], (err, results) => {
            if (err) { console.error('Active users query error:', err); resolve(0); }
            else resolve(results[0]?.count || 0);
          });
        }),
        new Promise((resolve, reject) => {
          db.query('SELECT COUNT(*) as count FROM asset_requests WHERE status = "pending"', [], (err, results) => {
            if (err) { console.error('Pending requests query error:', err); resolve(0); }
            else resolve(results[0]?.count || 0);
          });
        })
      ]);
      const stats = { total: assets.length, assigned: assets.filter(a => a.assigned).length, available: assets.filter(a => !a.assigned).length, reports: 12 };
      res.render('admin-dashboard', { stats, assets, showSidebar: true, user, totalUsers, activeUsers, pendingRequests });
    } else if (user.role === 'manager') {
      const [pendingRequests, userHistory, assets] = await Promise.all([
        new Promise((resolve, reject) => {
          db.query(`SELECT ar.*, u.full_name as user_name, a.name as asset_name 
                   FROM asset_requests ar 
                   JOIN users u ON ar.user_id = u.id 
                   JOIN assets a ON ar.asset_id = a.id 
                   WHERE ar.status = 'pending' AND u.department_id = ?`, [user.department_id], (err, results) => {
            if (err) { console.error('Pending requests query error:', err); resolve([]); }
            else resolve(results || []);
          });
        }),
        new Promise((resolve, reject) => {
          db.query(`SELECT ar.*, u.full_name as user_name, a.name as asset_name 
                   FROM asset_requests ar 
                   JOIN users u ON ar.user_id = u.id 
                   JOIN assets a ON ar.asset_id = a.id 
                   WHERE u.department_id = ? ORDER BY ar.request_date DESC LIMIT 20`, [user.department_id], (err, results) => {
            if (err) { console.error('User history query error:', err); resolve([]); }
            else resolve(results || []);
          });
        }),
        getAssets(user.department_id)
      ]);
      const totalAssets = assets.length;
      const assignedAssets = assets.filter(a => a.assigned).length;
      const availableAssets = assets.filter(a => !a.assigned).length;
      res.render('manager-dashboard', { user, pendingRequests, userHistory, totalAssets, assignedAssets, availableAssets });
    } else {
      const [myAssets, availableAssets, pendingCount] = await Promise.all([
        new Promise((resolve, reject) => {
          db.query('SELECT * FROM assets WHERE assigned_to_user_id = ?', [user.id], (err, results) => {
            if (err) { console.error('My assets query error:', err); resolve([]); }
            else resolve(results || []);
          });
        }),
        new Promise((resolve, reject) => {
          db.query('SELECT * FROM assets WHERE assigned = false AND department_id = ?', [user.department_id], (err, results) => {
            if (err) { console.error('Available assets query error:', err); resolve([]); }
            else resolve(results || []);
          });
        }),
        new Promise((resolve, reject) => {
          db.query('SELECT COUNT(*) as count FROM asset_requests WHERE user_id = ? AND status = "pending"', [user.id], (err, results) => {
            if (err) { console.error('Pending count query error:', err); resolve(0); }
            else resolve(results[0]?.count || 0);
          });
        })
      ]);
      const totalRequests = await new Promise((resolve, reject) => {
        db.query('SELECT COUNT(*) as count FROM asset_requests WHERE user_id = ?', [user.id], (err, results) => {
          if (err) { console.error('Total requests query error:', err); resolve(0); }
          else resolve(results[0]?.count || 0);
        });
      });
      res.render('user-dashboard', { user, myAssets, availableAssets, pendingRequests: pendingCount, totalRequests });
    }
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

app.get('/add-product', requireAuth, requireRole(['core_team']), (req, res) => {
  res.render('add-product', { user: req.session.user });
});

app.post('/add-product', requireAuth, requireRole(['core_team']), async (req, res) => {
  console.log('Add product request body:', req.body);
  const { name, type, model, serial, product_category, requires_calibration, last_calibration_date, calibration_frequency_months, calibration_notes } = req.body;
  
  try {
    // Calculate next calibration date if needed
    let nextCalibrationDate = null;
    if (requires_calibration && last_calibration_date) {
      const lastDate = new Date(last_calibration_date);
      const frequency = parseInt(calibration_frequency_months) || 12;
      nextCalibrationDate = new Date(lastDate.setMonth(lastDate.getMonth() + frequency));
    }
    
    // First, try basic insert without new columns
    const query = `INSERT INTO assets (name, type, model, serial, department_id) VALUES (?, ?, ?, ?, ?)`;
    
    db.query(query, [name, type, model || 'N/A', serial, req.session.user.department_id], async (err, result) => {
      if (err) {
        console.error('Insert asset error:', err);
        return res.redirect('/add-product?error=Failed to add asset');
      }
      
      const assetId = result.insertId;
      console.log('Asset inserted with ID:', assetId);
      
      // Generate QR Code with mobile-friendly data
      const qrData = {
        id: assetId,
        name: name,
        type: type,
        serial: serial,
        url: `${req.protocol}://${req.get('host')}/asset/${assetId}`,
        mobile_url: `${req.protocol}://${req.get('host')}/qr-scan/${assetId}`
      };
      
      // For mobile scanning, use the mobile URL as primary
      const qrContent = `${req.protocol}://${req.get('host')}/qr-scan/${assetId}`;
      
      const qrCodePath = `public/qr-codes/asset-${assetId}.png`;
      console.log('Generating QR code at:', qrCodePath);
      
      try {
        // Create directory if it doesn't exist
        if (!fs.existsSync('public/qr-codes')) {
          fs.mkdirSync('public/qr-codes', { recursive: true });
          console.log('Created qr-codes directory');
        }
        
        // Generate QR code with mobile URL
        await QRCode.toFile(qrCodePath, qrContent);
        console.log('QR code generated successfully');
        
        // Try to update with additional fields if they exist
        const updateQuery = `UPDATE assets SET 
          product_category = ?, 
          requires_calibration = ?, 
          last_calibration_date = ?, 
          next_calibration_date = ?, 
          calibration_frequency_months = ?, 
          calibration_notes = ?,
          qr_code_path = ?
          WHERE id = ?`;
        
        db.query(updateQuery, [
          product_category || 'general',
          requires_calibration ? 1 : 0,
          last_calibration_date || null,
          nextCalibrationDate,
          calibration_frequency_months || 12,
          calibration_notes || null,
          qrCodePath,
          assetId
        ], (updateErr) => {
          if (updateErr) {
            console.log('Update error (columns may not exist):', updateErr.message);
            // Just update QR path if other columns don't exist
            db.query('UPDATE assets SET qr_code_path = ? WHERE id = ?', [qrCodePath, assetId], (qrErr) => {
              if (qrErr) console.error('QR path update error:', qrErr);
            });
          }
          console.log('Redirecting to asset:', assetId);
        res.redirect('/view-database?success=Asset added and QR code generated');
        });
      } catch (qrError) {
        console.error('QR generation error:', qrError);
        res.redirect(`/asset/${assetId}?error=Asset added but QR generation failed`);
      }
    });
  } catch (err) {
    console.error('Add product error:', err);
    res.redirect('/add-product?error=Server error');
  }
});

// Notification helper function
function createNotification(userIdOrRole, departmentId, title, message, type, assetId = null, requestId = null) {
  console.log('Creating notification:', { userIdOrRole, departmentId, title, message, type });
  
  if (typeof userIdOrRole === 'string') {
    // Send to all users with specific role in department
    const query = `INSERT INTO notifications (user_id, title, message, type, related_asset_id, related_request_id)
                   SELECT id, ?, ?, ?, ?, ? FROM users WHERE role = ? AND department_id = ?`;
    db.query(query, [title, message, type, assetId, requestId, userIdOrRole, departmentId], (err, result) => {
      if (err) {
        console.error('Notification creation error:', err);
      } else {
        console.log('Notification created for role:', userIdOrRole, 'Affected rows:', result.affectedRows);
      }
    });
  } else {
    // Send to specific user
    const query = 'INSERT INTO notifications (user_id, title, message, type, related_asset_id, related_request_id) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(query, [userIdOrRole, title, message, type, assetId, requestId], (err, result) => {
      if (err) {
        console.error('Notification creation error:', err);
      } else {
        console.log('Notification created for user:', userIdOrRole, 'Insert ID:', result.insertId);
      }
    });
  }
}

// Request system for users with return date
app.post('/request-asset', requireAuth, requireRole(['user']), (req, res) => {
  const { asset_id, expected_return_date } = req.body;
  const query = 'INSERT INTO asset_requests (user_id, asset_id, request_type, expected_return_date) VALUES (?, ?, "assign", ?)';
  
  db.query(query, [req.session.user.id, asset_id, expected_return_date], (err, result) => {
    if (err) {
      console.error(err);
      return res.redirect('/dashboard?error=Failed to submit request');
    }
    
    // Create notification for manager
    createNotification(
      'manager', 
      req.session.user.department_id,
      'New Asset Request',
      `${req.session.user.full_name} requested an asset with return date: ${new Date(expected_return_date).toLocaleDateString()}`,
      'info',
      asset_id,
      result.insertId
    );
    
    res.redirect('/dashboard?success=Asset request submitted');
  });
});

app.post('/request-return', requireAuth, requireRole(['user']), (req, res) => {
  const query = 'INSERT INTO asset_requests (user_id, asset_id, request_type) VALUES (?, ?, "return")';
  db.query(query, [req.session.user.id, req.body.asset_id], (err) => {
    if (err) console.error(err);
    res.redirect('/dashboard');
  });
});

// Manager approval system with notifications
app.post('/approve-request', requireAuth, requireRole(['manager']), (req, res) => {
  const { request_id, action } = req.body;
  const status = action === 'approve' ? 'approved' : 'rejected';
  
  db.query('SELECT ar.*, u.full_name FROM asset_requests ar JOIN users u ON ar.user_id = u.id WHERE ar.id = ?', [request_id], (err, requests) => {
    if (err || !requests.length) return res.redirect('/dashboard');
    
    const request = requests[0];
    
    if (action === 'approve') {
      if (request.request_type === 'assign') {
        // Update asset with expected return date
        db.query('UPDATE assets SET assigned = true, assigned_to_user_id = ?, dateAssigned = CURDATE(), expected_return_date = ? WHERE id = ?', 
                [request.user_id, request.expected_return_date, request.asset_id]);
        
        // Create success notification for user
        createNotification(
          request.user_id,
          null,
          'Asset Request Approved',
          `Your asset request has been approved. Expected return: ${new Date(request.expected_return_date).toLocaleDateString()}`,
          'success',
          request.asset_id,
          request_id
        );
      } else {
        db.query('UPDATE assets SET assigned = false, assigned_to_user_id = NULL, returned = true, expected_return_date = NULL WHERE id = ?', 
                [request.asset_id]);
        
        createNotification(
          request.user_id,
          null,
          'Return Request Approved',
          'Your asset return request has been approved.',
          'success',
          request.asset_id,
          request_id
        );
      }
    } else {
      // Create rejection notification
      createNotification(
        request.user_id,
        null,
        'Request Rejected',
        `Your ${request.request_type} request has been rejected.`,
        'error',
        request.asset_id,
        request_id
      );
    }
    
    db.query('UPDATE asset_requests SET status = ?, approved_by = ?, approved_date = NOW() WHERE id = ?', 
            [status, req.session.user.id, request_id], (err) => {
      if (err) console.error(err);
      res.redirect('/dashboard');
    });
  });
});

app.get('/view-database', requireAuth, async (req, res) => {
  try {
    const assets = await getAssets(req.session.user.department_id);
    res.render('view-database', { assets, user: req.session.user });
  } catch (err) {
    console.error(err);
    res.render('view-database', { assets: [], user: req.session.user });
  }
});

app.get('/return-product', requireAuth, requireRole(['core_team']), async (req, res) => {
  try {
    const assets = await getAssets(req.session.user.department_id);
    const assignedAssets = assets.filter(a => a.assigned);
    res.render('return-product', { assets: assignedAssets, user: req.session.user });
  } catch (err) {
    console.error(err);
    res.render('return-product', { assets: [], user: req.session.user });
  }
});

app.post('/return-product', requireAuth, requireRole(['core_team']), (req, res) => {
  const query = 'UPDATE assets SET assigned = false, returned = true, assigned_to_user_id = NULL WHERE id = ?';
  db.query(query, [req.body.assetId], (err) => {
    if (err) console.error(err);
    res.redirect('/view-database');
  });
});

app.get('/reports', requireAuth, requireRole(['core_team', 'manager']), async (req, res) => {
  try {
    const assets = await getAssets(req.session.user.department_id);
    res.render('reports', { assets, user: req.session.user });
  } catch (err) {
    console.error(err);
    res.render('reports', { assets: [], user: req.session.user });
  }
});

// Admin Routes
app.get('/admin/users', requireAuth, requireRole(['core_team']), async (req, res) => {
  try {
    const [users, departments] = await Promise.all([
      new Promise((resolve, reject) => {
        db.query(`SELECT u.*, d.name as department_name 
                 FROM users u 
                 JOIN departments d ON u.department_id = d.id 
                 ORDER BY u.full_name`, (err, results) => {
          if (err) reject(err); else resolve(results);
        });
      }),
      getDepartments()
    ]);
    res.render('admin-users', { users, departments, user: req.session.user, currentUser: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

app.post('/admin/users/add', requireAuth, requireRole(['core_team']), async (req, res) => {
  const { full_name, email, username, role, department_id, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query('INSERT INTO users (username, password, email, full_name, role, department_id) VALUES (?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, email, full_name, role, department_id], (err) => {
        if (err) {
          console.error('Add user error:', err);
          return res.redirect('/admin/users?error=Failed to add user');
        }
        res.redirect('/admin/users?success=User added successfully');
      });
  } catch (err) {
    console.error(err);
    res.redirect('/admin/users?error=Server error');
  }
});

app.post('/admin/users/reset-password', requireAuth, requireRole(['core_team']), async (req, res) => {
  const { userId } = req.body;
  try {
    const hashedPassword = await bcrypt.hash('password123', 10);
    db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId], (err) => {
      if (err) {
        console.error('Reset password error:', err);
        return res.status(500).json({ error: 'Failed to reset password' });
      }
      res.json({ success: true });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/admin/users/delete', requireAuth, requireRole(['core_team']), (req, res) => {
  const { userId } = req.body;
  db.query('DELETE FROM users WHERE id = ? AND id != ?', [userId, req.session.user.id], (err) => {
    if (err) {
      console.error('Delete user error:', err);
      return res.status(500).json({ error: 'Failed to delete user' });
    }
    res.json({ success: true });
  });
});

// Asset Detail Route
app.get('/asset/:id', async (req, res) => {
  const assetId = req.params.id;
  try {
    const asset = await new Promise((resolve, reject) => {
      // Try basic query first, then add columns if they exist
      db.query('SELECT * FROM assets WHERE id = ?', [assetId], (err, results) => {
        if (err) {
          console.error('Asset query error:', err);
          reject(err);
        } else {
          console.log('Asset found:', results[0]);
          resolve(results[0]);
        }
      });
    });
    
    if (!asset) {
      console.log('Asset not found for ID:', assetId);
      return res.status(404).send('Asset not found');
    }
    
    // Set default values for missing columns
    asset.product_category = asset.product_category || 'general';
    asset.requires_calibration = asset.requires_calibration || false;
    asset.assigned_user = asset.employee || 'Unknown';
    
    res.render('asset-detail', { asset, user: req.session.user });
  } catch (err) {
    console.error('Asset detail error:', err);
    res.status(500).send('Server error: ' + err.message);
  }
});

// Generate QR Code for existing asset
app.post('/generate-qr/:id', requireAuth, requireRole(['core_team']), async (req, res) => {
  const assetId = req.params.id;
  try {
    const asset = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM assets WHERE id = ?', [assetId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });
    
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    const qrContent = `${req.protocol}://${req.get('host')}/qr-scan/${asset.id}`;
    const qrCodePath = `public/qr-codes/asset-${asset.id}.png`;
    
    if (!fs.existsSync('public/qr-codes')) {
      fs.mkdirSync('public/qr-codes', { recursive: true });
    }
    
    await QRCode.toFile(qrCodePath, qrContent);
    
    db.query('UPDATE assets SET qr_code_path = ? WHERE id = ?', [qrCodePath, asset.id], (err) => {
      if (err) {
        console.error('QR path update error:', err);
        return res.status(500).json({ error: 'Failed to update QR path' });
      }
      res.json({ success: true });
    });
  } catch (err) {
    console.error('Generate QR error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/login', async (req, res) => {
  const deptId = req.query.dept;
  if (!deptId) return res.redirect('/');
  
  try {
    const dept = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM departments WHERE id = ?', [deptId], (err, results) => {
        if (err) reject(err); else resolve(results[0]);
      });
    });
    
    if (!dept) return res.redirect('/');
    
    res.render('login', { 
      departmentId: deptId, 
      departmentName: dept.name,
      error: req.query.error 
    });
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
});

app.post('/login', async (req, res) => {
  const { username, password, department } = req.body;
  
  try {
    const user = await new Promise((resolve, reject) => {
      db.query(`SELECT u.*, d.name as department_name 
               FROM users u 
               JOIN departments d ON u.department_id = d.id 
               WHERE u.username = ? AND u.department_id = ?`, 
               [username, department], (err, results) => {
        if (err) reject(err); else resolve(results[0]);
      });
    });
    
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.redirect(`/login?dept=${department}&error=Invalid credentials`);
    }
    
    req.session.user = user;
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.redirect(`/login?dept=${department}&error=Server error`);
  }
});

app.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const user = req.session.user;
  
  try {
    if (newPassword !== confirmPassword) {
      return res.redirect('/dashboard?error=Passwords do not match');
    }
    
    const dbUser = await new Promise((resolve, reject) => {
      db.query('SELECT password FROM users WHERE id = ?', [user.id], (err, results) => {
        if (err) reject(err); else resolve(results[0]);
      });
    });
    
    if (!await bcrypt.compare(currentPassword, dbUser.password)) {
      return res.redirect('/dashboard?error=Current password is incorrect');
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id], (err) => {
      if (err) {
        console.error('Password update error:', err);
        return res.redirect('/dashboard?error=Failed to update password');
      }
      res.redirect('/dashboard?success=Password updated successfully');
    });
  } catch (err) {
    console.error('Password change error:', err);
    res.redirect('/dashboard?error=Server error');
  }
});

app.get('/logout', (req, res) => {
  const departmentId = req.session.user?.department_id;
  req.session.destroy();
  
  if (departmentId) {
    res.redirect(`/login?dept=${departmentId}`);
  } else {
    res.redirect('/');
  }
});

// QR Scan routes (no auth required for mobile scanning)
app.get('/qr-scan/:id?', async (req, res) => {
  const assetId = req.params.id;
  res.render('qr-scan', { assetId });
});

// API endpoint to get asset data for QR scanning
app.get('/api/asset/:id', async (req, res) => {
  const assetId = req.params.id;
  try {
    const asset = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM assets WHERE id = ?', [assetId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });
    
    if (!asset) {
      return res.json({ success: false, error: 'Asset not found' });
    }
    
    res.json({ success: true, asset });
  } catch (err) {
    console.error('API asset error:', err);
    res.json({ success: false, error: 'Server error' });
  }
});

// Test notification route
app.get('/test-notification', requireAuth, (req, res) => {
  createNotification(
    req.session.user.id,
    null,
    'Test Notification',
    'This is a test notification to verify the system is working.',
    'info'
  );
  res.send('Test notification created! Check your notification bar.');
});

// Test route to check QR generation
app.get('/test-qr', requireAuth, requireRole(['core_team']), async (req, res) => {
  try {
    // Get the first asset
    const asset = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM assets LIMIT 1', (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });
    
    if (!asset) {
      return res.send('No assets found. Add an asset first.');
    }
    
    // Generate QR for this asset
    const qrData = {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      serial: asset.serial,
      url: `${req.protocol}://${req.get('host')}/asset/${asset.id}`
    };
    
    const qrCodePath = `public/qr-codes/asset-${asset.id}.png`;
    
    if (!fs.existsSync('public/qr-codes')) {
      fs.mkdirSync('public/qr-codes', { recursive: true });
    }
    
    await QRCode.toFile(qrCodePath, JSON.stringify(qrData));
    
    // Update asset with QR path
    db.query('UPDATE assets SET qr_code_path = ? WHERE id = ?', [qrCodePath, asset.id], (err) => {
      if (err) console.error('QR path update error:', err);
    });
    
    res.send(`
      <h2>QR Code Generated Successfully!</h2>
      <p>Asset: ${asset.name}</p>
      <img src="/qr-codes/asset-${asset.id}.png" alt="QR Code" style="max-width: 200px;">
      <br><br>
      <a href="/asset/${asset.id}">View Asset Details</a>
      <br>
      <a href="/view-database">Back to Database</a>
    `);
  } catch (err) {
    console.error('Test QR error:', err);
    res.send('Error: ' + err.message);
  }
});



// Notification API endpoints
app.get('/api/notifications', requireAuth, (req, res) => {
  const offset = parseInt(req.query.offset) || 0;
  const limit = 10;
  
  console.log('Fetching notifications for user:', req.session.user.id);
  
  const query = `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const countQuery = `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE`;
  
  db.query(query, [req.session.user.id, limit, offset], (err, notifications) => {
    if (err) {
      console.error('Notification fetch error:', err);
      return res.json({ success: false, error: err.message });
    }
    
    console.log('Found notifications:', notifications.length);
    
    db.query(countQuery, [req.session.user.id], (err, countResult) => {
      if (err) {
        console.error('Notification count error:', err);
        return res.json({ success: false, error: err.message });
      }
      
      const unreadCount = countResult[0]?.count || 0;
      console.log('Unread count:', unreadCount);
      
      res.json({
        success: true,
        notifications,
        unreadCount
      });
    });
  });
});

app.post('/api/notifications/read', requireAuth, (req, res) => {
  const { notificationId } = req.body;
  db.query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', 
          [notificationId, req.session.user.id], (err) => {
    if (err) return res.json({ success: false, error: err.message });
    res.json({ success: true });
  });
});

app.post('/api/notifications/read-all', requireAuth, (req, res) => {
  db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', 
          [req.session.user.id], (err) => {
    if (err) return res.json({ success: false, error: err.message });
    res.json({ success: true });
  });
});

// Check for overdue returns (run daily)
function checkOverdueReturns() {
  const fifteenDaysFromNow = new Date();
  fifteenDaysFromNow.setDate(fifteenDaysFromNow.getDate() + 15);
  
  const query = `SELECT a.*, u.full_name, u.id as user_id 
                FROM assets a 
                JOIN users u ON a.assigned_to_user_id = u.id 
                WHERE a.expected_return_date <= ? AND a.assigned = TRUE`;
  
  db.query(query, [fifteenDaysFromNow], (err, assets) => {
    if (err) {
      console.error('Overdue check error:', err);
      return;
    }
    
    assets.forEach(asset => {
      const daysUntilDue = Math.ceil((new Date(asset.expected_return_date) - new Date()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilDue <= 0) {
        // Overdue
        createNotification(
          asset.user_id,
          null,
          'Asset Return Overdue',
          `Asset "${asset.name}" was due for return on ${new Date(asset.expected_return_date).toLocaleDateString()}`,
          'error',
          asset.id
        );
      } else if (daysUntilDue <= 15) {
        // Due soon
        createNotification(
          asset.user_id,
          null,
          'Asset Return Reminder',
          `Asset "${asset.name}" is due for return in ${daysUntilDue} day(s)`,
          'warning',
          asset.id
        );
      }
    });
  });
}

// Run overdue check every 24 hours
setInterval(checkOverdueReturns, 24 * 60 * 60 * 1000);
// Run once on startup
setTimeout(checkOverdueReturns, 5000);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Test QR generation at: http://localhost:3000/test-qr');
  console.log('Notification system active');
});