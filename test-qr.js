const QRCode = require('qrcode');
const fs = require('fs');

// Test QR code generation
async function testQR() {
  try {
    const testData = {
      id: 999,
      name: 'Test Asset',
      type: 'Test',
      url: 'http://localhost:3000/asset/999'
    };
    
    if (!fs.existsSync('public/qr-codes')) {
      fs.mkdirSync('public/qr-codes', { recursive: true });
    }
    
    await QRCode.toFile('public/qr-codes/test-qr.png', JSON.stringify(testData));
    console.log('Test QR code generated successfully!');
    
    // Also generate as data URL
    const dataUrl = await QRCode.toDataURL(JSON.stringify(testData));
    console.log('QR Data URL generated:', dataUrl.substring(0, 50) + '...');
    
  } catch (error) {
    console.error('QR generation failed:', error);
  }
}

testQR();