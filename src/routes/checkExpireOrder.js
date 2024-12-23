const { log } = require('firebase-functions/logger');
const { dbFirestore, db } = require('./firebase');
const checkAndDeleteExpireOrders = async () => {

  const now = Date.now()
  const snapshot = await dbFirestore.collection('ThanhToanHopDong')
    .where('status', '==', 'PENDING')
    .get();

  snapshot.forEach(async (doc) => {
    const data = doc.data();
    const isExpired = data.app_time + data.expire_duration_seconds * 1000 < now

    if (isExpired) {
      console.log(`Deleting expired order : ${doc.id}`);
      await dbFirestore.collection('ThanhToanHopDong').doc(doc.id).delete();

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

// kiểm tra nếu quá hạn hợp đồng thì tự chuyển đổi trạng thái qua EXPIRE
async function checkAndUpdateExpiredContracts() {
  const contractsRef = db.collection('HopDong');
  const currentDate = new Date(); // Lấy ngày hiện tại

  try {
    const snapshot = await contractsRef.get();

    for (const doc of snapshot.docs) {
      const contract = doc.data();
      const contractId = doc.id;

      // Lấy ngày kết thúc và chuyển đổi thành Date object
      const ngayKetThuc = contract.ngayKetThuc; // Giả sử 'ngayKetThuc' là string dạng 'dd/MM/yyyy'
      const [day, month, year] = ngayKetThuc.split('/').map(Number); // Chuyển đổi định dạng
      const endDate = new Date(year, month - 1, day);

      // Kiểm tra nếu ngày kết thúc đã qua và trạng thái chưa là EXPIRED
      if (endDate < currentDate && contract.trangThai !== 'EXPIRED') {
        await contractsRef.doc(contractId).update({
          trangThai: 'EXPIRED',
        });
        console.log(`Hợp đồng ${contractId} đã được cập nhật trạng thái thành EXPIRED.`);
      }
    }
  } catch (error) {
    console.error('Lỗi khi kiểm tra và cập nhật trạng thái hợp đồng:', error);
  }
}

async function checkAndUpdateExpiresSoonContracts() {
  log('Checking and updating contracts that are about to expire...');
  const contractsRef = db.collection('HopDong');
  const currentDate = new Date(); // Ngày hiện tại
  const threeDaysInMs = 3 * 24 * 60 * 60 * 1000; // Số mili giây trong 3 ngày

  try {
    const snapshot = await contractsRef.get();

    for (const doc of snapshot.docs) {
      const contract = doc.data();
      const contractId = doc.id;

      // Lấy ngày kết thúc và chuyển đổi thành Date object
      const ngayKetThuc = contract.ngayKetThuc; // Giả sử 'ngayKetThuc' là string dạng 'dd/MM/yyyy'
      const [day, month, year] = ngayKetThuc.split('/').map(Number); // Chuyển đổi định dạng
      const endDate = new Date(year, month - 1, day);

      // Tính thời gian còn lại đến ngày kết thúc
      const diffTime = endDate - currentDate;

      // Nếu còn đúng 3 ngày hoặc ít hơn nhưng trạng thái chưa là EXPIRESOON
      if (diffTime <= threeDaysInMs && diffTime > 0 && contract.trangThai !== 'EXPIRESOON') {
        // Cập nhật trạng thái hợp đồng
        await contractsRef.doc(contractId).update({
          trangThai: 'EXPIRESOON',
        });

        // Tạo thông báo mới
        const notification = {
          title: 'Hợp đồng sắp hết hạn!!!',
          message: `Hợp đồng phòng ${contract.thongtinphong.tenPhong} sắp hết hạn vào ngày ${ngayKetThuc}.`,
          time: currentDate.toTimeString().split(' ')[0], // Lấy thời gian hiện tại (giờ phút giây)
          date: currentDate.toLocaleDateString('vi-VN'), // Lấy ngày hiện tại
          timestamp: Date.now(), // Timestamp hiện tại
          mapLink: '', // Bạn có thể thêm đường dẫn bản đồ nếu cần
        };

        // Gửi thông báo cho cả người thuê và chủ trọ
        const userIds = [contract.nguoiThue.maNguoiDung, contract.chuNha.maNguoiDung];
        for (const userId of userIds) {
          const ref = db.ref(`ThongBao/${userId}`);
          await ref.push(notification);
        }

        console.log(`Hợp đồng ${contractId} đã được cập nhật trạng thái thành EXPIRESOON và thông báo đã được gửi.`);

      }
    }
  } catch (error) {
    console.error('Lỗi khi kiểm tra và cập nhật trạng thái hợp đồng sắp hết hạn:', error);
  }
}







// hàm kiểm tra và gửi thông báo hóa đơn hàng tháng
const checkAndNotifyMonthlyInvoice = async () => {
  const contractsRef = dbFirestore.collection('HopDong'); // Sử dụng dbFirestore
  const currentDate = new Date();
  console.log(`[INFO] Bắt đầu kiểm tra hóa đơn lúc ${currentDate.toISOString()}`);

  try {
    const snapshot = await contractsRef
      .where('trangThai', '==', 'ACTIVE') // Lấy các hợp đồng đang hoạt động
      .get();

    console.log(`[INFO] Đã lấy được ${snapshot.docs.length} hợp đồng.`);

    for (const doc of snapshot.docs) {
      const contract = doc.data();
      const contractId = doc.id;

      console.log(`[DEBUG] Đang kiểm tra hợp đồng ${contractId}`);

      // Hàm để chuyển đổi Date thành định dạng dd/mm/yyyy
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Tháng tính từ 0, nên phải cộng thêm 1
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

      const [startDay, startMonth, startYear] = contract.ngayBatDau.split('/').map(Number);
      const [endDay, endMonth, endYear] = contract.ngayKetThuc.split('/').map(Number);
      const ngayBatDau = new Date(startYear, startMonth - 1, startDay);
      const ngayKetThuc = new Date(endYear, endMonth - 1, endDay);
      const ngayThanhToanHangThang = parseInt(contract.ngayThanhToan);

      console.log(`[DEBUG] Ngày bắt đầu: ${formatDate(ngayBatDau)}, Ngày kết thúc: ${formatDate(ngayKetThuc)}, Ngày thanh toán: ${ngayThanhToanHangThang}`);

      if (currentDate >= ngayKetThuc) {
        console.log(`[INFO] Hợp đồng ${contractId} đã kết thúc, bỏ qua.`);
        continue;
      }

      // Xác định ngày thanh toán hóa đơn đầu tiên
      const firstInvoiceDate = new Date(
        ngayBatDau.getFullYear(),
        ngayBatDau.getMonth() + 1, // Tháng tiếp theo sau tháng đầu tiên
        ngayThanhToanHangThang
      );

      const currentMonthInvoiceDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        ngayThanhToanHangThang
      );

      console.log(`[DEBUG] Ngày hóa đơn tháng đầu tiên: ${firstInvoiceDate}, Ngày hóa đơn hiện tại: ${currentMonthInvoiceDate}`);

      // Gửi thông báo cho tháng cuối cùng
      if (
        currentDate.getMonth() === ngayKetThuc.getMonth() &&
        currentDate.getFullYear() === ngayKetThuc.getFullYear() &&
        currentDate.toDateString() === ngayKetThuc.toDateString()
      ) {
        const notification = {
          title: 'Tạo hóa đơn tháng cuối cùng',
          message: `Hợp đồng phòng ${contract.thongtinphong.tenPhong} sẽ kết thúc vào ngày ${contract.ngayKetThuc}. Vui lòng tạo hóa đơn.`,
          contractId: contractId,
          timestamp: Date.now(),
        };

        const ref = db.ref(`ThongBao/${contract.maNguoiDung}`);
        await ref.push(notification);

        console.log(`[INFO] Thông báo tháng cuối đã được gửi cho hợp đồng ${contractId}.`);
        continue;
      }


      console.log(`................................................`);
      console.log(`[INFO] ngày hôm nay ${currentDate.toDateString()}.`);
      console.log(`[INFO] ngày hóa đơn tháng hiện tại ${currentMonthInvoiceDate.toDateString()}.`);


      // Gửi thông báo cho các tháng bình thường
      if (
        currentDate.toDateString() === currentMonthInvoiceDate.toDateString() &&
        currentDate >= firstInvoiceDate &&
        currentDate < ngayKetThuc

        
      ) {
        const notification = {
          title: 'Tạo hóa đơn hàng tháng',
          message: `Hóa đơn tháng mới cho phòng ${contract.thongtinphong.tenPhong} cần được tạo.`,
          typeNotification: `invoiceCreation`, 
          timestamp: Date.now(),
          idModel: contractId
        };
      
        const ref = db.ref(`ThongBao/${contract.chuNha.maNguoiDung}`);
        await ref.push(notification);

        console.log(`[INFO] Thông báo hóa đơn hàng tháng đã được gửi cho hợp đồng ${contractId}.`);
      }
    }

    console.log(`[INFO] Hoàn thành kiểm tra hóa đơn lúc ${new Date().toISOString()}`);
  } catch (error) {
    console.error(`[ERROR] Lỗi khi kiểm tra và gửi thông báo hóa đơn: ${error.message}`);
  }
}


// Hàm thiết lập giám sát các hợp đồng PENDING
function setupContractMonitoring() {
  try {
    // Tạo query để lắng nghe các hợp đồng ở trạng thái PENDING
    const contractQuery = dbFirestore.collection('HopDong')
      .where('trangThai', '==', 'PENDING');

    // Thiết lập listener
    const unsubscribe = contractQuery.onSnapshot(async (snapshot) => {
      console.log(`Có ${snapshot.docChanges().length} Hợp đồng mới được tạo ra `);

      if (snapshot.docChanges().length > 0) {
        // Lọc các hợp đồng có hóa đơn đã thanh toán
        const paidContracts = snapshot.docChanges()
          .filter(change => {
            const docData = change.doc.data();
            return (
              (change.type === 'added' || change.type === 'modified') && 
              docData.hoaDonHopDong && 
              docData.hoaDonHopDong.trangThai === 'PAID' 
            );
          })
          .map(change => change.doc);

        if (paidContracts.length > 0) {
          console.log(`Phát hiện ${paidContracts.length} hóa đơn hợp đồng mới cần xử lý`);
          await distributeNewContractsToStaff(paidContracts);
        }
      }
    }, (error) => {
      console.error('Lỗi khi theo dõi hợp đồng:', error);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Lỗi khi thiết lập theo dõi hợp đồng:', error);
  }
}

// Hàm phân phối hợp đồng cho nhân viên
async function distributeNewContractsToStaff(newContracts) {
  try {
    // Lấy danh sách nhân viên từ Realtime Database
    const staffSnapshot = await db.ref('NguoiDung')
      .orderByChild('loai_taikhoan')
      .equalTo('NhanVien')
      .once('value');

    const staffList = [];
    staffSnapshot.forEach((childSnapshot) => {
      const staff={
        id: childSnapshot.key,
        ...childSnapshot.val()
      };
      // Chỉ thêm nhân viên có trạng_thai_taikhoan là "HoatDong"
      if (staff.trang_thaitaikhoan === 'HoatDong') {
        staffList.push(staff);
      }
    });
    // Kiểm tra nếu danh sách nhân viên trống
    if (staffList.length === 0) {
      throw new Error('Không có nhân viên nào để phân chia công việc.');
    }

    // Lấy thông tin lần phân chia cuối cùng từ Firestore
    const lastDistributionQuery = await dbFirestore.collection('PhanChiaCV')
      .orderBy('thoigian', 'desc')
      .limit(1)
      .get();

    // Xác định nhân viên tiếp theo
    let lastStaffIndex = -1;
    if (!lastDistributionQuery.empty) {
      const lastDistribution = lastDistributionQuery.docs[0].data();
      lastStaffIndex = staffList.findIndex(staff => staff.id === lastDistribution.idNhanVien);
    }

    // Duyệt qua các hợp đồng mới
    for (const contractDoc of newContracts) {
      const contract = contractDoc.data();
      const contractId = contractDoc.id;

      // Xác định nhân viên tiếp theo
      lastStaffIndex = (lastStaffIndex + 1) % staffList.length;
      const selectedStaff = staffList[lastStaffIndex];

      // Lưu thông tin phân công vào Firestore (PhanChiaCV)
      const phanChiaCVRef = dbFirestore.collection('PhanChiaCV').doc();
      await phanChiaCVRef.set({
        idNhanVien: selectedStaff.id,
        idHopDong: contractId,
        thoigian: Date.now(),
        trangThai: 'PROCESSING'
      });

      // Cập nhật trạng thái hợp đồng trong HopDong collection
      await dbFirestore.collection('HopDong').doc(contractId).update({
        trangThai: 'PROCESSING'
      });

      console.log(`Hợp đồng ${contractId} đã được phân cho nhân viên ${selectedStaff.id}`);
    }

  } catch (error) {
    console.error('Lỗi khi phân chia hợp đồng cho nhân viên:', error);
  }
}

// Hàm giám sát các hợp đồng đang được xử lý
function monitorProcessingContracts() {
  try {
    // Tạo query để lắng nghe các hợp đồng ở trạng thái PROCESSING
    const processingContractsQuery = dbFirestore.collection('PhanChiaCV')
      .where('trangThai', '==', 'PROCESSING')
      // .where('thoigian', '<=', Date.now() - processingTimeLimit);
    // Thiết lập listener
    const unsubscribe = processingContractsQuery.onSnapshot(async (snapshot) => {
      console.log(`Có ${snapshot.docChanges().length} công việc đang được xử lý`);
      for (const change of snapshot.docChanges()) {
        const assignment = change.doc.data();
        const currentTime = Date.now();
        const assignmentTime = assignment.thoigian;
        //chuyển sang 5'
        // const processingTimeLimit = 20 * 1000;
        const processingTimeLimit = 5 * 60 * 1000; // 5 phút

        // Nếu vượt quá thời gian xử lý
        if (currentTime - assignmentTime > processingTimeLimit) {
          await redistributeContract(
            assignment, 
            change.doc.id, 
            assignment.idHopDong
          );
        }
        //log thời gian còn lại của công việc này
        else {
          const remainingTime = Math.floor((processingTimeLimit - (currentTime - assignmentTime)) / 1000);
          console.log(`Công việc ${change.doc.id} còn lại ${remainingTime} giây để xử lý`);
        }
      }
    }, (error) => {
      console.error('Lỗi khi theo dõi các hợp đồng đang xử lý:', error);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Lỗi khi thiết lập giám sát các hợp đồng đang xử lý:', error);
  }
}



async function redistributeContract(currentAssignment, assignmentId, contractId) {
  try {
    // Lấy danh sách nhân viên trước khi bắt đầu transaction
    const staffSnapshot = await db.ref('NguoiDung')
      .orderByChild('loai_taikhoan')
      .equalTo('NhanVien')
      .once('value');

      const staffList = [];
      staffSnapshot.forEach((childSnapshot) => {
        const staff={
          id: childSnapshot.key,
          ...childSnapshot.val()
        };
        // Chỉ thêm nhân viên có trạng_thai_taikhoan là "HoatDong"
        if (staff.trang_thaitaikhoan === 'HoatDong') {
          staffList.push(staff);
        }
      });

    // Kiểm tra nếu không có nhân viên
    if (staffList.length === 0) {
      throw new Error('Không có nhân viên nào để phân chia công việc.');
    }

    // Sử dụng transaction để đảm bảo tính nhất quán
    return await dbFirestore.runTransaction(async (transaction) => {
      const assignmentRef = dbFirestore.collection('PhanChiaCV').doc(assignmentId);
      const assignmentDoc = await transaction.get(assignmentRef);
      
      // Kiểm tra trạng thái
      if (!assignmentDoc.exists || assignmentDoc.data().trangThai !== 'PROCESSING') {
        console.log(`Công việc ${assignmentId} không thể phân phối lại`);
        return null;
      }

      // Tìm vị trí nhân viên hiện tại
      const currentStaffIndex = staffList.findIndex(staff => staff.id === currentAssignment.idNhanVien);
      
      // Chọn nhân viên tiếp theo
      const nextStaffIndex = (currentStaffIndex + 1) % staffList.length;
      const selectedStaff = staffList[nextStaffIndex];

      // Cập nhật trạng thái công việc cũ sang AutoCancel
      transaction.update(assignmentRef, {
        trangThai: 'AUTOCANCEL',
        lyDoHuy: 'Nhân viên không hoàn thành công việc trong thời gian quy định'
      });

      // Tạo tham chiếu mới cho công việc
      const newAssignmentRef = dbFirestore.collection('PhanChiaCV').doc();
      
      // Thêm công việc mới bằng transaction
      transaction.create(newAssignmentRef, {
        idNhanVien: selectedStaff.id,
        idHopDong: contractId,
        thoigian: Date.now(),
        trangThai: 'PROCESSING',
        lyDoChuyenCongViec: 'Công việc được chuyển từ nhân viên cũ do vượt quá thời gian xử lý'
      });

      // Cập nhật trạng thái hợp đồng
      const contractRef = dbFirestore.collection('HopDong').doc(contractId);
      transaction.update(contractRef, {
        trangThai: 'PROCESSING'
      });

      console.log(`Hợp đồng ${contractId} đã được chuyển từ ${currentAssignment.idNhanVien} sang ${selectedStaff.id}`);

      return {
        oldAssignmentId: assignmentId,
        newAssignmentId: newAssignmentRef.id,
        newStaffId: selectedStaff.id
      };
    });

  } catch (error) {
    console.error('Lỗi khi phân phối lại hợp đồng:', error);
    throw error;
  }
}

// Hàm khởi động giám sát
function startContractMonitoring() {
  // Thiết lập listener
  const unsubscribe = setupContractMonitoring();
  return unsubscribe;
}


module.exports = { checkAndDeleteExpireOrders, checkBillContractAndUpdateContracts, checkAndUpdateContractsStatus, checkAndUpdateExpiredContracts, checkAndUpdateExpiresSoonContracts, checkAndNotifyMonthlyInvoice,startContractMonitoring,monitorProcessingContracts }