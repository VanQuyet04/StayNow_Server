const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Điều chỉnh origin cụ thể của bạn
        methods: ["GET", "POST"]
    }
});

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