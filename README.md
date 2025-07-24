# Asset Management System

A comprehensive web-based asset management solution for tracking, assigning, and managing organizational assets.

## Overview

The Asset Management System is designed to help organizations efficiently track and manage their assets. It provides features for asset registration, assignment, return tracking, QR code generation, and reporting. The system supports different user roles with varying levels of access and permissions.

## Features

- **Asset Tracking**: Register, view, and manage all organizational assets
- **QR Code Integration**: Generate and scan QR codes for quick asset identification
- **Role-Based Access Control**: Different permissions for core team, managers, and regular users
- **Request System**: Users can request assets and returns with manager approval
- **Notifications**: Real-time notifications for requests, approvals, and upcoming returns
- **Department Management**: Organize assets and users by departments
- **Reporting**: Generate reports on asset usage, availability, and history
- **Calibration Tracking**: Track calibration requirements and schedules for applicable assets

## User Roles

1. **Core Team**
   - Add/remove assets and users
   - Generate QR codes
   - Access all reports and system features
   - Manage departments and system settings

2. **Manager**
   - Approve/reject asset requests
   - View department assets and reports
   - Monitor user activity within their department

3. **User**
   - Request assets with expected return dates
   - View assigned assets
   - Request returns
   - Scan QR codes to view asset details

## Technical Stack

- **Backend**: Node.js with Express.js
- **Frontend**: EJS templates with Tailwind CSS
- **Database**: MySQL
- **Authentication**: Session-based with bcrypt password hashing
- **QR Code**: QRCode library for generation and scanning

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up the database:
   ```
   mysql -u root -p < setup.sql
   ```
4. Start the application:
   ```
   node app.js
   ```
5. Access the application at `http://localhost:3000`

## Database Setup

The application uses MySQL with the following main tables:
- `departments`: Stores department information
- `users`: Stores user accounts with role-based permissions
- `assets`: Stores all asset information including assignment status
- `asset_requests`: Tracks asset assignment and return requests
- `notifications`: Stores user notifications

## Default Credentials

The system comes with sample users for testing:

| Username | Password    | Role       | Department |
|----------|-------------|------------|------------|
| admin    | password123 | core_team  | IT         |
| manager1 | password123 | manager    | IT         |
| user1    | password123 | user       | IT         |

## Key Workflows

### Asset Assignment Process
1. User requests an asset with expected return date
2. Manager receives notification and approves/rejects
3. Upon approval, asset is marked as assigned to the user
4. System tracks return date and sends reminders

### Asset Return Process
1. User initiates return request
2. Manager approves the return
3. Asset is marked as available again

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support or questions, please contact the development team.

