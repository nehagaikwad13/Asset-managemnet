USE asset_management;

-- Add calibration fields to assets table
ALTER TABLE assets ADD COLUMN product_category VARCHAR(50) DEFAULT 'general';
ALTER TABLE assets ADD COLUMN requires_calibration BOOLEAN DEFAULT FALSE;
ALTER TABLE assets ADD COLUMN last_calibration_date DATE NULL;
ALTER TABLE assets ADD COLUMN next_calibration_date DATE NULL;
ALTER TABLE assets ADD COLUMN calibration_frequency_months INT DEFAULT 12;
ALTER TABLE assets ADD COLUMN calibration_notes TEXT NULL;
ALTER TABLE assets ADD COLUMN qr_code_path VARCHAR(255) NULL;

select * from assets 
