require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const config = require('./src/config/config')
const otpRoutes = require('./src/routes/allOtpRoutes')

const app = express();
app.use(bodyParser.json());

app.use('/otp', otpRoutes)


const port = config.PORT || 5000;
app.listen(port, () => {
    console.log(`Server đang chạy tại cổng ${port}`);
});
