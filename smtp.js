require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');

// Cấu hình và khởi tạo Express
const app = express();
app.use(bodyParser.json());

// Khởi tạo Firebase SDK
var admin = require("firebase-admin");
var serviceAccount = require('./service/staynowapp1-firebase-adminsdk-mxmmo-778c905420.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DB_URL
});
console.log("Khởi tạo firebase sdk thành công");
const db = admin.database();

// Hàm xác thực token
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

// Lưu OTP vào Firebase
const saveOtpToUserOtp = async (uid, email, otpCode, expiry) => {
    try {
        const userRef = db.ref(`UserOtp/${uid}`);
        await userRef.set({
            email,
            otpCode,
            expiry
        });
        console.log(`OTP đã được lưu thành công cho UID: ${uid}`);
    } catch (error) {
        console.error('Lỗi khi lưu OTP vào bảng userOtp:', error.message);
        throw new Error('Lỗi lưu OTP');
    }
};

// Hàm gửi email qua Gmail SMTP
const sendOtpEmail = async (toEmail, otpCode) => {
    // Tạo đối tượng transporter với Gmail SMTP
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.FROM_EMAIL, // Địa chỉ email người gửi
            pass: process.env.APP_PASSWORD, // Mật khẩu ứng dụng
        }
    });

    // Cấu hình email
    const mailOptions = {
        from: process.env.FROM_EMAIL,  // Địa chỉ email người gửi
        to: toEmail,                   // Địa chỉ email người nhận
        subject: 'OTP Verification',   // Tiêu đề email
        html: `<html><body><h1>Your OTP code is ${otpCode}</h1></body></html>` // Nội dung email
    };

    // Gửi email
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.response);
        return info;
    } catch (error) {
        console.log('Error sending email:', error);
        throw new Error('Gửi email không thành công');
    }
};

const updateOtpForUser = async (uid, otpCode, expiry) => {
    try {
        const userRef = db.ref(`UserOtp/${uid}`);
        await userRef.update({ otpCode, expiry });
        console.log(`OTP và thời gian hết hạn đã được cập nhật cho UID: ${uid}`);
    } catch (error) {
        console.error('Lỗi khi cập nhật OTP trong bảng userOtp:', error.message);
        throw new Error('Lỗi cập nhật OTP');
    }
};
const verifyOtpFromRealTime = async (uid, otpCode) => {
    try {
        const userOtpRef = db.ref(`UserOtp/${uid}`);
        const snapshot = await userOtpRef.get();

        if (!snapshot.exists()) {
            throw new Error('Không tìm thấy OTP cho UID này');
        }

        const otpData = snapshot.val();

        // Kiểm tra OTP và thời gian hết hạn
        if (otpData.otpCode !== otpCode) {
            throw new Error('OTP không chính xác');
        }

        if (Date.now() > otpData.expiry) {
            throw new Error('OTP đã hết hạn');
        }

        // Xóa OTP sau khi xác thực thành công
        await userOtpRef.remove();
        console.log('OTP đã được xác thực và xóa khỏi Realtime Database.');
        return true;
    } catch (error) {
        console.error('Lỗi xác thực OTP từ Realtime Database:', error.message);
        throw new Error(error.message);
    }
};
// API xác thực token người dùng
app.post('/verify-token', async (req, res) => {
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).json({ error: 'Thiếu idToken' });
    }

    try {
        // Xác minh token
        const decodedToken = await verifyToken(idToken);

        // Lấy email và uid từ token
        const userEmail = decodedToken.email;
        const userUid = decodedToken.uid;

        if (!userEmail || !userUid) {
            return res.status(400).json({ error: 'Không tìm thấy email hoặc uid trong token' });
        }

        console.log("Email xác thực:", userEmail);
        console.log("UID xác thực:", userUid);

        // Tạo OTP ngẫu nhiên và thời gian hết hạn (10 phút)
        const otpCode = Math.floor(100000 + Math.random() * 900000);
        const otpExpiry = Date.now() + 10 * 60 * 1000; // Thời gian hết hạn: 10 phút

        // Lưu OTP vào bảng userOtp
        await saveOtpToUserOtp(userUid, userEmail, otpCode, otpExpiry);

        // Gửi OTP qua email bằng Gmail SMTP
        const emailResult = await sendOtpEmail(userEmail, otpCode);

        // Trả về phản hồi thành công
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
app.post('/verify-otp', async (req, res) => {
    const { uid, otpCode } = req.body;

    if (!uid || !otpCode) {
        return res.status(400).json({ error: 'Thiếu UID hoặc OTP' });
    }

    try {
        // Xác thực OTP
        const result = await verifyOtpFromRealTime(uid, otpCode);

        res.json({
            message: 'OTP xác thực thành công!',
            uid,
            verified: result
        });
    } catch (error) {
        res.status(400).json({
            error: 'Xác thực OTP thất bại',
            details: error.message
        });
    }
});

const resendOtp = async (uid) => {
    try {
        // Lấy thông tin người dùng từ Firebase (đảm bảo rằng bạn có thông tin email của user)
        const userRef = db.ref(`UserOtp/${uid}`);
        const userSnapshot = await userRef.get();

        if (!userSnapshot.exists()) {
            throw new Error('Không tìm thấy người dùng với UID này');
        }

        const userEmail = userSnapshot.val().email;

        // Tạo OTP mới ngẫu nhiên và thời gian hết hạn (10 phút)
        const otpCode = Math.floor(100000 + Math.random() * 900000);
        const otpExpiry = Date.now() + 10 * 60 * 1000; // Thời gian hết hạn: 10 phút

        // Lưu OTP vào bảng UserOtp
        await updateOtpForUser(uid, otpCode, otpExpiry);

        // Gửi OTP mới qua email
        await sendOtpEmail(userEmail, otpCode);

        console.log(`OTP mới đã được gửi và lưu vào bảng UserOtp cho UID: ${uid}`);

        return { success: true, message: 'OTP mới đã được gửi thành công!' };
    } catch (error) {
        console.error('Lỗi khi gửi lại OTP:', error.message);
        throw new Error(error.message);
    }
};
app.post('/resend-otp', async (req, res) => {
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

// Cấu hình cổng và chạy ứng dụng
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
