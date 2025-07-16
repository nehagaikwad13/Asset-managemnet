USE asset_management;

-- Check if department_id column exists, if not add it
ALTER TABLE assets ADD COLUMN department_id INT NOT NULL DEFAULT 1;

-- Add foreign key constraint if it doesn't exist
ALTER TABLE assets ADD CONSTRAINT fk_assets_department 
FOREIGN KEY (department_id) REFERENCES departments(id);

-- Check if assigned_to_user_id column exists, if not add it
ALTER TABLE assets ADD COLUMN assigned_to_user_id INT NULL;

-- Add foreign key constraint for user assignment
ALTER TABLE assets ADD CONSTRAINT fk_assets_user 
FOREIGN KEY (assigned_to_user_id) REFERENCES users(id);

-- Now insert sample data
INSERT IGNORE INTO assets (name, type, model, serial, department_id) VALUES
('Dell Laptop', 'Laptop', 'Dell Inspiron 15', 'DL001', 1),
('HP Printer', 'Printer', 'HP LaserJet Pro', 'HP001', 1),
('iPhone 13', 'Mobile', 'Apple iPhone 13', 'IP001', 1),
('Office Chair', 'Furniture', 'Ergonomic Chair', 'OC001', 2),
('Monitor', 'Display', 'Samsung 24"', 'SM001', 1);