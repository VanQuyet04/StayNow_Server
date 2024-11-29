const nodemailer = require('nodemailer');
const config=require('../config/config')

// Hàm gửi email qua Gmail SMTP
const sendOtpEmail = async (toEmail, otpCode) => {
    // Tạo đối tượng transporter với Gmail SMTP
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: config.FROM_EMAIL,
            pass: config.APP_PASSWORD,
        }
    });

    // Cấu hình email
    const otpValidityMinutes = 10; // Thời hạn OTP: 10 phút
    const mailOptions = {
        from: `"${config.FROM_NAME}" <noreply@staynow.com>`,
        to: toEmail,
        subject: 'OTP Verification',
        html: `
        <html>
            <body>
                <h4>Your OTP code is ${otpCode}</h4>
                <p>Mã này có hiệu lực trong <strong>${otpValidityMinutes} phút</strong>. Hãy sử dụng ngay!</p>            </body>
        </html>
    `
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


module.exports = sendOtpEmail;
