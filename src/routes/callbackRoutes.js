const express = require('express');

const {io}= require('../config/socket')

const CryptoJS = require('crypto-js');
const router = express.Router();
const config = require('../config/config');
const { dbFireStore } = require('./firebase');

io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('disconnect', () => {
        console.log('Client disconnected');

    });

})

router.post('/callback', async (req, res) => {
    const callbackData = req.body;
    const dataStr = callbackData.data; // Dữ liệu từ Zalopay
    const reqMac = callbackData.mac; // MAC từ Zalopay

    console.log(callbackData);

    // Tính toán MAC từ dữ liệu nhận được
    const calculatedMac = CryptoJS.HmacSHA256(dataStr, config.key2).toString();
    //so sánh mac
    if (reqMac !== calculatedMac) {
        console.log("MAC không hợp lệ");
        return res.status(400).json({ return_code: -1, return_message: "mac not equal" });
    }

    try {

        // Nếu MAC hợp lệ, xử lý dữ liệu
        const dataJson = JSON.parse(dataStr); // Giải mã dữ liệu
        console.log("Thông tin thanh toán:", dataJson);
        const app_trans_id = dataJson.app_trans_id

        //Tìm hóa đơn gốc từ transactionId
        const paymentTransRef = await dbFireStore.collection('PaymentTransaction')
            .doc(app_trans_id)
            .get();

        if (!paymentTransRef.exits) {
            console.error("Không tìm thấy giao dịch tương ứng")
            return res.status(400).json({ return_code, return_message: "Transaction not found" })
        }

        const originalTrans = paymentTransRef.data();

        //cập nhật status cho originalTrans
        if (originalTrans.contractId) {
            await dbFireStore
                .collection('HopDong')
                .doc(originalTrans.contractId)
                .update({
                    'hoaDonHopDong.status': 'PAIR',
                    updatedAt: new Date()
                });
        }
        
        io.emit('contractPaymentUpdate', {
            contractId: originalTrans.contractId,
            status: 'PAID'
        });

        //Tạo đối tượng lưu thông tin thanh toán từ callback
        const paymentTransaction = {
            zp_trans_id: dataJson.zp_trans_id,
            server_time: dataJson.server_time,
            channel: dataJson.channel,
            merchant_user_id: dataJson.merchant_user_id,
            zp_user_id: dataJson.zp_user_id,
            status: 'PAIR',
            updateAt: new Date()
        }

        await dbFireStore.collection('PaymentTransaction')
            .doc(app_trans_id)
            .set(paymentTransaction, { merge: true });

        console.log("Thanh toán thành công:", app_trans_id);


        // Phản hồi lại Zalopay
        return res.status(200).json({ return_code: 1, return_message: "Success" });

    } catch (error) {
        console.error("Lỗi xử lí callback:", error)
        return res.status(500).json({ return_code: -1, return_message: "Internal server error" })
    }

});

module.exports = router;
