// src/firebase.js
const admin = require('firebase-admin');
const serviceAccount = require('../service/staynowapp1-firebase-adminsdk-mxmmo-778c905420.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL
});

console.log("Khởi tạo firebase sdk thành công");

const db = admin.database();
module.exports = db;
