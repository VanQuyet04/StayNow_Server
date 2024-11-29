// src/verifyToken.js
const admin = require('firebase-admin');

// Xác thực token người dùng
const verifyToken = async (idToken) => {
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        console.log('Token hợp lệ', decodedToken);
        return decodedToken;
    } catch (error) {
        console.log('Lỗi xác thực token', error.message);
        throw new Error('Xác thực token thất bại');
    }
};

module.exports = verifyToken;
