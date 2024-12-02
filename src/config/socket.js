const express = require('express');
const http = require("http");
const app = express();
const server = http.createServer(app);
const {Server}=require("socket.io");

const io = new Server(server);

// Cấu hình socket events
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Lắng nghe các sự kiện từ client
    socket.on('contractPaymentUpdate', (data) => {
        console.log('Received contract payment update:', data);
        // Xử lý logic cập nhật
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

module.exports = {
    app,
    server,
    io
};