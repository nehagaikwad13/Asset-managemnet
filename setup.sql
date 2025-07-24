CREATE DATABASE IF NOT EXISTS asset_management;
USE asset_management;

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table with roles and departments
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  role ENUM('core_team', 'manager', 'user') NOT NULL,
  department_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- Enhanced assets table
CREATE TABLE IF NOT EXISTS assets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  model VARCHAR(255),
  serial VARCHAR(255) UNIQUE,
  department_id INT NOT NULL,
  assigned BOOLEAN DEFAULT FALSE,
  assigned_to_user_id INT NULL,
  dateAssigned DATE,
  returned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (assigned_to_user_id) REFERENCES users(id)
);

-- Asset requests table
CREATE TABLE IF NOT EXISTS asset_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  asset_id INT NOT NULL,
  request_type ENUM('assign', 'return') NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_by INT NULL,
  approved_date TIMESTAMP NULL,
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (asset_id) REFERENCES assets(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- Insert sample departments
INSERT IGNORE INTO departments (name) VALUES ('IT'), ('HR');

-- Insert sample users (password: 'password123' hashed)
INSERT IGNORE INTO users (username, password, email, full_name, role, department_id) VALUES
('admin', '$2b$10$rOvHIKz8tF8YBxkzQjKvHOulaAWXiTNvuxNVpQs8yGWqJQfNvGzXe', 'admin@company.com', 'Admin User', 'core_team', 1),
('manager1', '$2b$10$rOvHIKz8tF8YBxkzQjKvHOulaAWXiTNvuxNVpQs8yGWqJQfNvGzXe', 'manager@company.com', 'IT Manager', 'manager', 1),
('user1', '$2b$10$rOvHIKz8tF8YBxkzQjKvHOulaAWXiTNvuxNVpQs8yGWqJQfNvGzXe', 'user1@company.com', 'John Doe', 'user', 1);