USE asset_management;

-- Add some sample assets for testing
INSERT IGNORE INTO assets (name, type, model, serial, department_id) VALUES
('Dell Laptop', 'Laptop', 'Dell Inspiron 15', 'DL001', 1),
('HP Printer', 'Printer', 'HP LaserJet Pro', 'HP001', 1),
('iPhone 13', 'Mobile', 'Apple iPhone 13', 'IP001', 1),
('Office Chair', 'Furniture', 'Ergonomic Chair', 'OC001', 2),
('Monitor', 'Display', 'Samsung 24"', 'SM001', 1);