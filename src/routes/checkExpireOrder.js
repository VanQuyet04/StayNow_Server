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


module.exports = checkAndDeleteExpireOrders