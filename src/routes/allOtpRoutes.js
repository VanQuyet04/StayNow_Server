require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
// Import các module
const verifyToken = require('../routes/verifyToken');
const { saveOtpToUserOtp, verifyOtpFromRealTime, resendOtp } = require('../routes/otp');
const sendOtpEmail = require('../routes/email');

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

        // Kiểm tra OTP trong Realtime Database
        const userRef = db.ref(`UserOtp/${userUid}`);
        const snapshot = await userRef.get();

        if (snapshot.exists()) {
            const otpData = snapshot.val();

            // Nếu OTP chưa hết hạn
            if (Date.now() < otpData.expiry) {
                return res.status(200).json({
                    message: 'OTP hiện tại vẫn còn hiệu lực.',
                    otpExpiry: new Date(otpData.expiry).toISOString()
                });
            }

            // Nếu OTP đã hết hạn, cập nhật OTP mới
            const otpCode = Math.floor(100000 + Math.random() * 900000);
            const otpExpiry = Date.now() + 10 * 60 * 1000;

            await updateOtpForUser(userUid, otpCode, otpExpiry);
            const emailResult = await sendOtpEmail(userEmail, otpCode);

            return res.json({
                message: 'OTP đã hết hạn, OTP mới đã được gửi và lưu vào bảng userOtp!',
                uid: userUid,
                email: userEmail,
                otpExpiry: new Date(otpExpiry).toISOString(),
                emailResult
            });
        }

        // Nếu OTP chưa tồn tại
        const otpCode = Math.floor(100000 + Math.random() * 900000);
        const otpExpiry = Date.now() + 10 * 60 * 1000;

        await saveOtpToUserOtp(userUid, userEmail, otpCode, otpExpiry);
        const emailResult = await sendOtpEmail(userEmail, otpCode);

        res.json({
            message: 'Token hợp lệ, OTP đã được gửi và lưu vào bảng userOtp!',
            uid: userUid,
            email: userEmail,
            otpExpiry: new Date(otpExpiry).toISOString(),
            emailResult
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