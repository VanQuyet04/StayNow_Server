require('dotenv').config(); 
const express = require('express');
const axios = require('axios'); 
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

//khởi tạo firebase sdk
var admin = require("firebase-admin");
var serviceAccount = require('./service/staynowapp1-firebase-adminsdk-mxmmo-778c905420.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL:process.env.FIREBASE_DB_URL
});
console.log("Khởi tạo firebase sdk thành công");
const db = admin.database();
// hàm xác thực token
const verifyToken = async (idToken) => {

    try {
        //kiểm tra token hợp lệ với firebase admin
        const decodedToken = await admin.auth().verifyIdToken(idToken)
        console.log('Token hợp lệ', decodedToken);
        return decodedToken

    } catch (error) {
        console.log('Lỗi xác thực token', error.message);
        throw new Error('Xác thực token thất bại')

    }
}
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
// hàm gửi otp đến mail người dùng
const sendOtpEmail = async (recipientEmail, otpCode) => {
    try {
        const url = 'https://api.brevo.com/v3/smtp/email';
        const apiKey = process.env.SENDINBLUE_API_KEY;

        const otpValidityMinutes = 10; // Thời hạn OTP: 10 phút

        const emailData = {
            sender: { email: process.env.FROM_EMAIL, name: process.env.FROM_NAME },
            to: [{ email: recipientEmail }],
            subject: process.env.SUBJECT || 'Xác thực tài khoản',
            htmlContent: `
                <h1>Xác thực tài khoản</h1>
                <p>Mã OTP của bạn là: <strong>${otpCode}</strong></p>
                <p>Mã này có hiệu lực trong <strong>${otpValidityMinutes} phút</strong>. Hãy sử dụng ngay!</p>
            `
        };

        const response = await axios.post(url, emailData, {
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey
            }
        });
        console.log('Email gửi thành công:', response.data);
        
        return response.data;
    } catch (error) {
        console.error('Lỗi khi gửi email:', error.response?.data || error.message);
        throw new Error(error.response?.data.message || 'Lỗi không xác định');
    }
};
//api xác thực token người dùng
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

        // Tạo OTP ngẫu nhiên và thời gian hết hạn (5 phút)
        const otpCode = Math.floor(100000 + Math.random() * 900000);
        const otpExpiry = Date.now() + 10 * 60 * 1000; // Thời gian hết hạn: 10 phút

        // Lưu OTP vào bảng userOtp
        await saveOtpToUserOtp(userUid, userEmail, otpCode, otpExpiry);

        // Gửi OTP qua email
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



const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});

