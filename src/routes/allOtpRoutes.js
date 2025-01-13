require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
// Import các module
const verifyToken = require('../routes/verifyToken');
const {verifyOtpFromRealTime, resendOtp,checkAndHandleOtp } = require('../routes/otp');
const router = express.Router()

router.post('/verify-token', async (req, res) => {
    const { idToken } = req.body;
    if (!idToken) {
        return res.status(400).json({ error: 'Thiếu idToken' });
    }

    try {
        const decodedToken = await verifyToken(idToken);
        const userEmail = decodedToken.email;
        const userUid = decodedToken.uid;

        if (!userEmail || !userUid) {
            return res.status(400).json({ error: 'Không tìm thấy email hoặc uid trong token' });
        }

        console.log("Email xác thực:", userEmail);
        console.log("UID xác thực:", userUid);

        const result = await checkAndHandleOtp(userUid, userEmail);

        res.json({
            message: result.message,
            uid: userUid,
            email: userEmail,
            otpExpiry: new Date(result.otpExpiry).toISOString(),
            status: result.status
        });
    } catch (error) {
        res.status(401).json({ error: 'Token không hợp lệ', details: error.message });
    }
});

router.post('/verify-otp', async (req, res) => {
    const { uid, otpCode } = req.body;

    if (!uid || !otpCode) {
        return res.status(400).json({ error: 'Thiếu UID hoặc OTP' });
    }

    try {
        const result = await verifyOtpFromRealTime(uid, otpCode);
        res.json({ message: 'OTP xác thực thành công!', uid, verified: result });
    } catch (error) {
        res.status(400).json({ error: 'Xác thực OTP thất bại', details: error.message });
    }
});

router.post('/resend-otp', async (req, res) => {
    const { uid } = req.body;

    if (!uid) {
        return res.status(400).json({ error: 'Thiếu UID' });
    }

    try {
        // Gửi lại OTP
        const result = await resendOtp(uid);

        res.json({
            message: result.message,
            uid
        });
    } catch (error) {
        res.status(400).json({
            error: 'Gửi lại OTP thất bại',
            details: error.message
        });
    }
});

module.exports = router