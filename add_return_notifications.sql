USE asset_management;

-- Add return date to asset_requests table
ALTER TABLE asset_requests ADD COLUMN expected_return_date DATE NULL;
ALTER TABLE asset_requests ADD COLUMN actual_return_date DATE NULL;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('info', 'warning', 'success', 'error') DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  related_asset_id INT NULL,
  related_request_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (related_asset_id) REFERENCES assets(id),
  FOREIGN KEY (related_request_id) REFERENCES asset_requests(id)
);

-- Add expected return date to assets table
ALTER TABLE assets ADD COLUMN expected_return_date DATE NULL;