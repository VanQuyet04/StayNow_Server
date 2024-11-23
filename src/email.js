const nodemailer = require('nodemailer');

// Hàm gửi email qua Gmail SMTP
const sendOtpEmail = async (toEmail, otpCode) => {
    // Tạo đối tượng transporter với Gmail SMTP
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.FROM_EMAIL, 
            pass: process.env.APP_PASSWORD, 
        }
    });

    // Cấu hình email
    const mailOptions = {
        from:process.env.FROM_NAME,  // Địa chỉ email người gửi
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


module.exports = sendOtpEmail;
