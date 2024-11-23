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
    const otpValidityMinutes = 10; // Thời hạn OTP: 10 phút
    const mailOptions = {
        from: `"Stay Now" <${process.env.FROM_NAME}>`,
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
