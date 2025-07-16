USE asset_management;

-- Update passwords with properly hashed versions
UPDATE users SET password = '$2b$10$sh8Hgz5n/pbENOyfwiYu8OVo8WAzvzbHNhaF.cIObQhwMGC7Ia2HG' WHERE username = 'admin';
UPDATE users SET password = '$2b$10$tM611RvOPjE84DxI8l15Vu0A6O1xsMq1mZyqmPfmgO.mh8OhPowFu' WHERE username = 'manager1';
UPDATE users SET password = '$2b$10$J9T/mnoWmpirHy.fsS/vRe9rmh7w..zu6tSSbTuUKj2ZXfrUgOzDq' WHERE username = 'user1';