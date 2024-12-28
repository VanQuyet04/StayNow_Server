// src/otp.js
const {db} = require('./firebase');  // Import Firebase database

const sendOtpEmail = require('./email')

const saveOtpToUserOtp = async (uid, email, otpCode, expiry) => {
    try {
        const userRef = db.ref(`UserOtp/${uid}`);
        await userRef.set({ email, otpCode, expiry});
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
const checkAndHandleOtp = async (uid, email) => {
    try {
        const userOtpRef = db.ref(`UserOtp/${uid}`);
        const snapshot = await userOtpRef.get();
        
        const otpCode = Math.floor(100000 + Math.random() * 900000);
        const otpExpiry = Date.now() + 10 * 60 * 1000;

        // Trường hợp 1: Không tìm thấy bản ghi
        if (!snapshot.exists()) {
            await saveOtpToUserOtp(uid, email, otpCode, otpExpiry);
            await sendOtpEmail(email, otpCode);
            return {
                status: 'created',
                message: 'Đã tạo và gửi OTP mới',
                otpExpiry
            };
        }

        const currentOtpData = snapshot.val();
        
        // Trường hợp 2: Tìm thấy nhưng đã hết hạn
        if (Date.now() > currentOtpData.expiry) {
            await updateOtpForUser(uid, otpCode, otpExpiry);
            await sendOtpEmail(email, otpCode);
            return {
                status: 'updated',
                message: 'OTP cũ đã hết hạn, đã cập nhật và gửi OTP mới',
                otpExpiry
            };
        }

        // Trường hợp 3: OTP vẫn còn hiệu lực
        return {
            status: 'existing',
            message: 'OTP hiện tại vẫn còn hiệu lực',
            otpExpiry: currentOtpData.expiry
        };

    } catch (error) {
        console.error('Lỗi trong quá trình kiểm tra và xử lý OTP:', error.message);
        throw new Error(error.message);
    }
};

// Kiểm tra OTP từ Realtime Database
const verifyOtpFromRealTime = async (uid, otpCode) => {
    try {
        const userOtpRef = db.ref(`UserOtp/${uid}`);
        const snapshot = await userOtpRef.get();

        if (!snapshot.exists()) {
            throw new Error('Không tìm thấy OTP cho UID này');
        }

        const otpData = snapshot.val();
        if (otpData.otpCode !== otpCode) {
            throw new Error('OTP không chính xác');
        }

        if (Date.now() > otpData.expiry) {
            throw new Error('OTP đã hết hạn');
        }

        await userOtpRef.remove();  // Xóa OTP sau khi xác thực thành công
        console.log('OTP đã được xác thực và xóa khỏi Realtime Database.');
        // Cập nhật trường daXacThuc trong bảng NguoiDung
        const userRef = db.ref(`NguoiDung/${uid}`);
        await userRef.update({ daXacThuc: true });
        return true;
    } catch (error) {
        console.error('Lỗi xác thực OTP từ Realtime Database:', error.message);
        throw new Error(error.message);
    }
};


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



module.exports = { saveOtpToUserOtp, verifyOtpFromRealTime, resendOtp,checkAndHandleOtp };
