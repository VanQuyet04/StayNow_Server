const { dbFirestore} = require('./firebase');

const checkAndDeleteExpireOrders = async () => {

    const now = Date.now()
    const snapshot = await dbFirestore.collection('PaymentTransaction')
        .where('status', '==', 'PENDING')
        .get();

    snapshot.forEach(async (doc) => {
        const data = doc.data();
        const isExpired = data.app_time + data.expire_duration_seconds * 1000 < now

        if (isExpired) {
            console.log(`Deleting expired order : ${doc.id}`);
            await dbFirestore.collection('PaymentTransaction').doc(doc.id).delete();

        }

    })

}

async function checkAndUpdateContracts() {
    const now = new Date();
    const contractsRef = db.collection('HopDong');
    
    const snapshot = await contractsRef.where('hoaDonHopDong.trangThai', '==', 'PENDING').get();
  
    snapshot.forEach(doc => {
      const contract = doc.data();
      const invoiceDate = contract.hoaDonHopDong.ngayLap.toDate(); // Lấy ngày lập hóa đơn từ hoaDonHopDong
  
      const diffTime = Math.abs(now - invoiceDate); // Tính sự khác biệt thời gian
      const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24)); // Chuyển đổi thành số ngày
  
      if (diffDays > 3) {
        // Cập nhật trạng thái của hoaDonHopDong
        contractsRef.doc(doc.id).update({
          'hoaDonHopDong.trangThai': 'EXPIRED'
        });
        console.log(`Hợp đồng ${doc.id} đã hết hạn và được cập nhật trạng thái EXPIRED.`);
      }
    });
  }

module.exports = {checkAndDeleteExpireOrders,checkAndUpdateContracts}