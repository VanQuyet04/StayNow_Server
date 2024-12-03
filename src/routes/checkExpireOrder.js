const { dbFirestore } = require('./firebase');

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

//kiểm tra trạng thái của hóa đơn hợp đồng nếu chờ quá lâu mà chưa thanh toán sẽ cho trạng thái HD quá hạn
async function checkBillContractAndUpdateContracts() {
  const now = new Date();
  const contractsRef = db.collection('HopDong');

  const snapshot = await contractsRef.where('hoaDonHopDong.trangThai', '==', 'PENDING').get();

  // Dùng vòng lặp for...of thay vì forEach để hỗ trợ async/await
  for (const doc of snapshot.docs) {
    const contract = doc.data();
    const invoiceDate = contract.hoaDonHopDong.ngayLap.toDate(); // Lấy ngày lập hóa đơn từ hoaDonHopDong

    const diffTime = Math.abs(now - invoiceDate); // Tính sự khác biệt thời gian
    const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24)); // Chuyển đổi thành số ngày

    if (diffDays > 3) {
      // Cập nhật trạng thái của hoaDonHopDong thành EXPIRED
      await contractsRef.doc(doc.id).update({
        'hoaDonHopDong.trangThai': 'EXPIRED'
      });
      console.log(`Hợp đồng ${doc.id} đã hết hạn và được cập nhật trạng thái EXPIRED.`);

      // Lấy maPhong từ hợp đồng
      const maPhong = contract.maPhong;

      // Cập nhật Trang_thai_phong thành false trong PhongTro
      const roomRef = db.collection('PhongTro').doc(maPhong);
      await roomRef.update({
        Trang_thai_phong: false
      });
      console.log(`Phòng ${maPhong} đã được cập nhật trạng thái Trang_thai_phong thành false.`);
    }
  }
}

//kiểm tra trạng thái của hợp đồng mà quá hạn hoặc bị hủy thì sẽ update trạng thái phòng thành false
async function checkAndUpdateContractsStatus() {
  const contractsRef = db.collection('HopDong');

  const snapshot = await contractsRef.where('hoaDonHopDong.trangThai', 'in', ['EXPIRED', 'TERMINATED']).get();

  // Dùng vòng lặp for...of để hỗ trợ async/await
  for (const doc of snapshot.docs) {
    const contract = doc.data();

    const maPhong = contract.maPhong;

    // Kiểm tra và cập nhật trạng thái của hợp đồng trong HopDong
    if (contract.hoaDonHopDong.trangThai === 'EXPIRED' || contract.hoaDonHopDong.trangThai === 'TERMINATED') {

      // Cập nhật trạng thái của phòng (PhongTro) thành false
      const roomRef = db.collection('PhongTro').doc(maPhong);
      await roomRef.update({
        Trang_thaiphong: false
      });
      console.log(`Phòng ${maPhong} đã được cập nhật trạng thái Trang_thaiphong thành false.`);
    }
  }
}



module.exports = { checkAndDeleteExpireOrders, checkBillContractAndUpdateContracts, checkAndUpdateContractsStatus }