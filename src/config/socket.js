const express = require('express');
const http = require("http");
const app = express();
const server = http.createServer(app);
const {Server}=require("socket.io");

const io = new Server(server, {
    cors: {
        origin: "*", // Thay "*" bằng domain cụ thể nếu cần
        methods: ["GET", "POST"]
    }
});
// Cấu hình socket events
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

module.exports = {
    app,
    server,
    io
};