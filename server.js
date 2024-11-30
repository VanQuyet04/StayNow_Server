require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const config = require('./src/config/config')

const {app,server} = require('./src/config/socket')
const otpRoutes = require('./src/routes/allOtpRoutes')
const createOrderRoute = require('./src/routes/createOrderRoutes');
const callbackRoute = require('./src/routes/callbackRoutes');

app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/otp', otpRoutes)
app.use('/api', createOrderRoute);
app.use('/api', callbackRoute);

const port = config.PORT || 5000;
server.listen(port, () => {
    console.log(`Server đang chạy tại cổng ${port}`);
});
