const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
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
app.use(express.static('public'));
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

app.post('/add-product', requireAuth, requireRole(['core_team']), (req, res) => {
  const query = 'INSERT INTO assets (name, type, model, serial, department_id) VALUES (?, ?, ?, ?, ?)';
  db.query(query, [req.body.name, req.body.type, req.body.model || 'N/A', req.body.serial, req.session.user.department_id], (err) => {
    if (err) console.error(err);
    res.redirect('/dashboard');
  });
});

// Request system for users
app.post('/request-asset', requireAuth, requireRole(['user']), (req, res) => {
  const query = 'INSERT INTO asset_requests (user_id, asset_id, request_type) VALUES (?, ?, "assign")';
  db.query(query, [req.session.user.id, req.body.asset_id], (err) => {
    if (err) console.error(err);
    res.redirect('/dashboard');
  });
});

app.post('/request-return', requireAuth, requireRole(['user']), (req, res) => {
  const query = 'INSERT INTO asset_requests (user_id, asset_id, request_type) VALUES (?, ?, "return")';
  db.query(query, [req.session.user.id, req.body.asset_id], (err) => {
    if (err) console.error(err);
    res.redirect('/dashboard');
  });
});

// Manager approval system
app.post('/approve-request', requireAuth, requireRole(['manager']), (req, res) => {
  const { request_id, action } = req.body;
  const status = action === 'approve' ? 'approved' : 'rejected';
  
  db.query('SELECT * FROM asset_requests WHERE id = ?', [request_id], (err, requests) => {
    if (err || !requests.length) return res.redirect('/dashboard');
    
    const request = requests[0];
    
    if (action === 'approve') {
      if (request.request_type === 'assign') {
        db.query('UPDATE assets SET assigned = true, assigned_to_user_id = ?, dateAssigned = CURDATE() WHERE id = ?', 
                [request.user_id, request.asset_id]);
      } else {
        db.query('UPDATE assets SET assigned = false, assigned_to_user_id = NULL, returned = true WHERE id = ?', 
                [request.asset_id]);
      }
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
  req.session.destroy();
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});