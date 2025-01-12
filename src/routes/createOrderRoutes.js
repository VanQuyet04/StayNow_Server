const express = require('express');
const axios = require('axios');
const CryptoJS = require('crypto-js');
const moment = require('moment');
const cron = require('node-cron')

const { dbFirestore } = require('./firebase');
const { checkAndDeleteExpireOrders, checkBillContractAndUpdateContracts, checkAndUpdateContractsStatus, checkAndUpdateExpiredContracts, checkAndUpdateExpiresSoonContracts, checkAndNotifyMonthlyInvoice, startContractMonitoring, monitorProcessingContracts } = require('./checkExpireOrder')

const router = express.Router();
const config = require('../config/config');
const { logger } = require('firebase-functions');

router.post('/create-order', async (req, res) => {
    try {
        const { amount, contractId, billId, items, typeBill } = req.body;

        const transID = Math.floor(Math.random() * 1000000);

        const order = {
            app_id: config.app_id,
            app_user: 'StayNow',
            app_trans_id: `${moment().format('YYMMDD')}_${transID}`,
            app_time: Date.now(),
            expire_duration_seconds: 900,
            amount: amount,
            item: items,
            description: `Payment for order #${transID}`,
            embed_data: JSON.stringify({}),
            bank_code: "zalopayapp",
            callback_url: config.callback_url,
        };

        const paymentTransaction = {
            idThanhToan: order.app_trans_id,
            appId: order.app_id,
            appTransId: order.app_trans_id,
            appTime: order.app_time,
            amount: order.amount,
            description: order.description,
            expireDurationSeconds: order.expire_duration_seconds,
            bankCode: order.bank_code,
            contractId: contractId,
            billId: billId,
            typeBill: typeBill,
            status: 'PENDING',
            createdAt: Date.now(),
        };

        const data = `${config.app_id}|${order.app_trans_id}|${order.app_user}|${order.amount}|${order.app_time}|${order.embed_data}|${order.item}`;
        order.mac = CryptoJS.HmacSHA256(data, config.key1).toString();

        const response = await axios.post(config.endpoint, null, { params: order });
        paymentTransaction.zpTransToken = response.data.zp_trans_token
        paymentTransaction.orderUrl = response.data.order_url

        // Lưu thông tin chi tiết thanh toán vào Firestore
        await dbFirestore.collection('ThanhToanHopDong').doc(order.app_trans_id).set(paymentTransaction);

        res.json({
            success: true,
            zalopay_response: response.data
        });
        console.log(response.data);


    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/create-order-service', async (req, res) => {
    try {
        const { amount, billId, items, typeBill } = req.body;

        const transID = Math.floor(Math.random() * 1000000);

        const order = {
            app_id: config.app_id,
            app_user: 'StayNow',
            app_trans_id: `${moment().format('YYMMDD')}_${transID}`,
            app_time: Date.now(),
            expire_duration_seconds: 900,
            amount: amount,
            item: items,
            description: `Payment for order #${transID}`,
            embed_data: JSON.stringify({}),
            bank_code: "zalopayapp",
            callback_url: config.callback_url_service,
        };

        const paymentTransaction = {
            idThanhToan: order.app_trans_id,
            appId: order.app_id,
            appTransId: order.app_trans_id,
            appTime: order.app_time,
            amount: order.amount,
            description: order.description,
            expireDurationSeconds: order.expire_duration_seconds,
            bankCode: order.bank_code,
            billId: billId,
            typeBill: typeBill,
            status: 'PENDING',
            createdAt: Date.now(),
        };

        const data = `${config.app_id}|${order.app_trans_id}|${order.app_user}|${order.amount}|${order.app_time}|${order.embed_data}|${order.item}`;
        order.mac = CryptoJS.HmacSHA256(data, config.key1).toString();

        const response = await axios.post(config.endpoint, null, { params: order });
        paymentTransaction.zpTransToken = response.data.zp_trans_token
        paymentTransaction.orderUrl = response.data.order_url

        // Lưu thông tin chi tiết thanh toán vào Firestore
        await dbFirestore.collection('ThanhToanDichVu').doc(order.app_trans_id).set(paymentTransaction);

        res.json({
            success: true,
            zalopay_response: response.data
        });
        console.log(response.data);


    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

cron.schedule('*/10 * * * *', checkAndDeleteExpireOrders);
cron.schedule('0 */1 * * *', checkBillContractAndUpdateContracts);
cron.schedule('0 */1 * * *', checkAndUpdateContractsStatus);
cron.schedule('0 */1 * * *', checkAndUpdateExpiredContracts);
cron.schedule('0 */1 * * *', checkAndUpdateExpiresSoonContracts);


//Hàm check full mỗi 10s
function checkTime() {
    cron.schedule('*/10 * * * * *', checkBillContractAndUpdateContracts);
    cron.schedule('*/10 * * * * *', checkAndUpdateContractsStatus);
    cron.schedule('*/10 * * * * *', checkAndUpdateExpiredContracts);
    cron.schedule('*/10 * * * * *', checkAndUpdateExpiresSoonContracts);
    cron.schedule('*/10 * * * * *', monitorProcessingContracts);


    startContractMonitoring()
    cron.schedule('*/10 * * * * *', async () => {
    try {
      await checkAndNotifyMonthlyInvoice();
      console.error(`[INFO] Đã chạy checkAndNotifyMonthlyInvoice`);
    } catch (error) {
      console.error(`[ERROR] Lỗi khi chạy checkAndNotifyMonthlyInvoice: ${error.message}`);
    }
  });
}


module.exports = router;
