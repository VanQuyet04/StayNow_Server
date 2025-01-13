// src/firebase.js
const fs = require('fs');
const admin = require('firebase-admin');
const config = require('../config/config')


// Đọc file json firebase trực tiếp
const serviceAccount = require('../../service/staynowapp1-firebase-adminsdk.json')

// Đọc file bí mật từ /etc/secrets
const serviceAccount = JSON.parse(
  fs.readFileSync('/etc/secrets/staynowapp1-firebase-adminsdk', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: config.FIREBASE_DB_URL
});

console.log("Khởi tạo firebase sdk thành công");

const db = admin.database();
const dbFirestore = admin.firestore();

module.exports = { db, dbFirestore }
