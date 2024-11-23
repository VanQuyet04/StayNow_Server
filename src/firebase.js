// src/firebase.js
const fs = require('fs');
const admin = require('firebase-admin');

// const serviceAccount = require('../service/staynowapp1-firebase-adminsdk.json');
// Đọc file bí mật từ /etc/secrets
const serviceAccount = JSON.parse(
  fs.readFileSync('/etc/secrets/firebase-admin-sdk.txt', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL
});

console.log("Khởi tạo firebase sdk thành công");

const db = admin.database();
module.exports = db;
