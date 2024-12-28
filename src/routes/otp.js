// src/otp.js
const { db } = require('./firebase');  // Import Firebase database
const sendOtpEmail = require('./email')
const moment = require('moment');
require('moment/locale/vi'); 

// config lock verify otp
const MAX_OTP_ATTEMPTS = 6;
const LOCK_DURATION = 4 * 60 * 60 * 1000;

const saveOtpToUserOtp = async (uid, email, otpCode, expiry) => {
    try {
        const userRef = db.ref(`UserOtp/${uid}`);
        await userRef.set({
            email, otpCode, expiry, attempts: 0,
            lockUntil: 0
        })
        console.log(`OTP đã được lưu thành công cho UID: ${uid}`);
    } catch (error) {
        console.error('Lỗi khi lưu OTP vào bảng userOtp:', error.message);
        throw new Error('Lỗi lưu OTP');
    }
};

const updateOtpForUser = async (uid, otpCode, expiry) => {
    try {
        const userRef = db.ref(`UserOtp/${uid}`);
        await userRef.update({
            otpCode, expiry, attempts: 0,
            lockUntil: 0
        });
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

const checkOtpAttempts = async (uid, otpData, otpCode) => {
    const currentTime = Date.now();

    // Kiểm tra khóa tài khoản
    if (otpData.lockUntil > currentTime) {
        // Nếu tài khoản bị khóa, trả về lỗi
        throw {
            code: 403,
            message: `Bạn đã nhập sai quá 55 lần. Tài khoản đã bị khóa tạm thời.`
        };
    }

    // Kiểm tra OTP nhập vào có chính xác không
    if (otpData.otpCode !== otpCode) {  // Sử dụng otpCode được truyền vào từ client
        let newAttempts = otpData.attempts + 1;

        if (newAttempts >= MAX_OTP_ATTEMPTS) {
            const lockUntil = currentTime + LOCK_DURATION;
            await db.ref(`UserOtp/${uid}`).update({
                attempts: newAttempts,
                lockUntil: lockUntil
            });

            // Tài khoản bị khóa
            throw {
                code: 403,
                message: `Bạn đã nhập sai quá ${MAX_OTP_ATTEMPTS} lần. Tài khoản đã bị khóa tạm thời.`
            };
        } else {
            await db.ref(`UserOtp/${uid}`).update({
                attempts: newAttempts
            });

            // OTP không chính xác
            throw {
                code: 400,
                message: `OTP chưa đúng.Bạn còn ${MAX_OTP_ATTEMPTS-newAttempts} lần thử`
            };
        }
    }

    return otpData;
};

//xác thực otp
const verifyOtpFromRealTime = async (uid, otpCode) => {
    try {
        const userOtpRef = db.ref(`UserOtp/${uid}`);
        const snapshot = await userOtpRef.get();

        if (!snapshot.exists()) {
            throw new Error('Không tìm thấy OTP cho UID này');
        }

        const otpData = snapshot.val();

        // Gọi hàm kiểm tra số lần nhập sai và khóa tài khoản
        await checkOtpAttempts(uid, otpData, otpCode);

        const currentTime = Date.now();

        // Kiểm tra OTP đã hết hạn chưa
        if (currentTime > otpData.expiry) {
            throw new Error('OTP đã hết hạn');
        }

        // Nếu OTP đúng và chưa hết hạn, xóa OTP và cập nhật trạng thái
        await userOtpRef.remove();
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
        const userRef = db.ref(`UserOtp/${uid}`);
        const userSnapshot = await userRef.get();

        if (!userSnapshot.exists()) {
            throw new Error('Không tìm thấy người dùng với UID này');
        }

        const userData = userSnapshot.val();
        const { email: userEmail, lockUntil } = userData;

        const currentTime = Date.now();

        // Kiểm tra xem tài khoản có bị khóa hay không
        if (lockUntil && lockUntil > currentTime) {
            const unlockTime = moment(lockUntil).locale('vi').format('DD/MM/YYYY, HH:mm:ss');
            throw new Error(`Tài khoản của bạn đang bị tạm khóa. Hãy thử lại vào lúc ${unlockTime}.`);
        }

        // Nếu tài khoản không bị khóa hoặc thời gian khóa đã hết, tạo OTP mới
        const otpCode = Math.floor(100000 + Math.random() * 900000);
        const otpExpiry = currentTime + 10 * 60 * 1000; 

        await userRef.update({
            otpCode,
            otpExpiry,
            attempts: 0, 
            lockUntil: 0, 
        });

        // Gửi OTP mới qua email
        await sendOtpEmail(userEmail, otpCode);

        console.log(`OTP mới đã được gửi và lưu vào bảng UserOtp cho UID: ${uid}`);

        return { success: true, message: 'OTP mới đã được gửi thành công!' };
    } catch (error) {
        console.error('Lỗi khi gửi lại OTP:', error.message);
        throw new Error(error.message);
    }
};



module.exports = { saveOtpToUserOtp, verifyOtpFromRealTime, resendOtp, checkAndHandleOtp };
