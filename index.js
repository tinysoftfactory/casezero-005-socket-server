const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(
    server,
    {connectionStateRecovery: {}}
);

io.on('connection', (socket) => {
  console.log(`New client connected ${socket.id}`);

  socket.on('joinRoom', (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined room: ${room}`);
  });

  socket.on('leaveRoom', (room) => {
    socket.leave(room);
    console.log(`User ${socket.id} left room: ${room}`);
  });

  socket.on('privateMessage', ({ to, message }) => {
    console.log(`Private message from ${socket.id} to ${to}: ${message}`);
    io.to(to).emit('privateMessage', message);
  });

  socket.on('message', ({ room, message }) => {
    console.log(`Message from ${socket.id} in room ${room}: ${message}`);
    io.to(room).emit('message', message);
  });

  socket.on('register', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} connected ${socket.id}`);
  });

  socket.on("disconnect", (reason, details) => {
    // the reason of the disconnection, for example "transport error"
    console.log(reason);

    if (details) {
      // the low-level reason of the disconnection, for example "xhr post error"
      console.log(details);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
