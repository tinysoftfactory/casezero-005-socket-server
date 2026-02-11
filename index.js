require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);

// Socket.IO server configuration
const io = socketIo(server, {
  connectionStateRecovery: {},
  cors: {
    origin: "*", // В продакшене укажите конкретный домен
    methods: ["GET", "POST"]
  }
});

// Store connected clients info
const connectedClients = new Map(); // socketId -> clientInfo

/**
 * Helper: Get room name for game
 */
function getGameRoomName(gameId) {
  return `game_${gameId}`;
}

/**
 * Helper: Get number of clients in room
 */
function getRoomSize(roomName) {
  const room = io.sockets.adapter.rooms.get(roomName);
  return room ? room.size : 0;
}

/**
 * Emit event to specific game room
 * This function is exported and can be called from your API endpoints
 */
function emitToGame(gameId, eventName, data) {
  const roomName = getGameRoomName(gameId);
  const clientCount = getRoomSize(roomName);
  
  io.to(roomName).emit(eventName, data);
  
  console.log(`[Emit] ${eventName} to ${roomName} - ${clientCount} clients`);
  return clientCount;
}

// ============================================================================
// Socket.IO Event Handlers
// ============================================================================

io.on('connection', (socket) => {
  const clientInfo = {
    id: socket.id,
    connectedAt: new Date(),
    ip: socket.handshake.address,
    rooms: new Set()
  };
  
  connectedClients.set(socket.id, clientInfo);
  
  console.log(`[Socket.IO] Client connected: ${socket.id} from ${clientInfo.ip}`);

  // ============================================================================
  // JOIN ROOM - Client subscribes to game updates
  // ============================================================================
  socket.on('joinRoom', (room) => {
    socket.join(room);
    clientInfo.rooms.add(room);
    
    const roomSize = getRoomSize(room);
    console.log(`[Socket.IO] ${socket.id} joined room: ${room} (${roomSize} clients)`);
    
    // Confirm subscription
    socket.emit('message', {
      room: room,
      message: {
        type: 'subscribed',
        status: 'success',
        room: room
      }
    });
  });

  // ============================================================================
  // LEAVE ROOM - Client unsubscribes from game updates
  // ============================================================================
  socket.on('leaveRoom', (room) => {
    socket.leave(room);
    clientInfo.rooms.delete(room);
    
    const roomSize = getRoomSize(room);
    console.log(`[Socket.IO] ${socket.id} left room: ${room} (${roomSize} clients remaining)`);
  });

  // ============================================================================
  // REGISTER - Register user for private messages
  // ============================================================================
  socket.on('register', (userId) => {
    const userRoom = `user_${userId}`;
    socket.join(userRoom);
    clientInfo.userId = userId;
    clientInfo.rooms.add(userRoom);
    
    console.log(`[Socket.IO] User ${userId} registered with socket ${socket.id}`);
  });

  // ============================================================================
  // BROADCAST PLAYERS UPDATED - Notify all clients in game room to refresh player list
  // (e.g. after join, exit, block, unblock, game deleted)
  // ============================================================================
  socket.on('broadcast_players_updated', ({ gameId }) => {
    if (!gameId) {
      console.warn('[Socket.IO] broadcast_players_updated: missing gameId');
      return;
    }
    const roomName = getGameRoomName(gameId);
    const recipientCount = getRoomSize(roomName);
    io.to(roomName).emit('game_players_updated', { gameId });
    console.log(`[Socket.IO] broadcast_players_updated → ${roomName} (${recipientCount} clients)`);
  });

  // ============================================================================
  // BROADCAST COMMENT - Client sends new comment, server broadcasts to room
  // So all other clients (and sender via echo) get real-time update
  // ============================================================================
  socket.on('broadcast_comment_new', ({ gameId, comment }) => {
    if (!gameId || !comment) {
      console.warn('[Socket.IO] broadcast_comment_new: missing gameId or comment');
      return;
    }
    const roomName = getGameRoomName(gameId);
    // Only broadcast if sender is in the room
    if (!clientInfo.rooms.has(roomName)) {
      console.warn(`[Socket.IO] Socket ${socket.id} not in room ${roomName}, ignoring broadcast`);
      return;
    }
    const recipientCount = getRoomSize(roomName);
    io.to(roomName).emit('game_comment_new', comment);
    console.log(`[Socket.IO] broadcast_comment_new → ${roomName} (${recipientCount} clients)`);
  });

  // ============================================================================
  // MESSAGE - Send message to room
  // ============================================================================
  socket.on('message', ({ room, message }) => {
    console.log(`[Socket.IO] Message from ${socket.id} to room ${room}`);
    io.to(room).emit('message', {
      room: room,
      message: message,
      from: socket.id
    });
  });

  // ============================================================================
  // PRIVATE MESSAGE - Send message to specific user
  // ============================================================================
  socket.on('privateMessage', ({ to, message }) => {
    console.log(`[Socket.IO] Private message from ${socket.id} to ${to}`);
    io.to(to).emit('privateMessage', {
      message: message,
      from: socket.id
    });
  });

  // ============================================================================
  // DISCONNECT
  // ============================================================================
  socket.on('disconnect', (reason, details) => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    console.log(`[Socket.IO] Reason: ${reason}`);
    
    if (details) {
      console.log(`[Socket.IO] Details:`, details);
    }
    
    connectedClients.delete(socket.id);
  });

  // ============================================================================
  // ERROR
  // ============================================================================
  socket.on('error', (error) => {
    console.error(`[Socket.IO] Error from ${socket.id}:`, error);
  });
});

// ============================================================================
// HTTP API - For your backend to call after DB operations
// ============================================================================

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    clients: connectedClients.size,
    rooms: io.sockets.adapter.rooms.size,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Get room info
app.get('/api/room/:roomName', (req, res) => {
  const { roomName } = req.params;
  const size = getRoomSize(roomName);
  
  res.json({
    room: roomName,
    clients: size,
    exists: size > 0
  });
});

// ============================================================================
// BROADCAST ENDPOINTS - Call these from your backend API
// ============================================================================

/**
 * Broadcast new comment
 * POST /api/broadcast/game-comment/new
 * Body: { gameId: number, comment: object }
 */
app.post('/api/broadcast/game-comment/new', (req, res) => {
  const { gameId, comment } = req.body;

  if (!gameId || !comment) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['gameId', 'comment']
    });
  }

  // Validate comment has required fields
  if (!comment.id || !comment.text) {
    return res.status(400).json({ 
      error: 'Comment must have id and text fields' 
    });
  }

  const roomName = getGameRoomName(gameId);
  
  // Emit to Socket.IO room
  const recipientCount = emitToGame(gameId, 'game_comment_new', comment);

  res.json({ 
    success: true, 
    gameId,
    room: roomName,
    recipients: recipientCount,
    event: 'game_comment_new',
    timestamp: new Date().toISOString()
  });
});

/**
 * Broadcast comment edit
 * POST /api/broadcast/game-comment/edit
 * Body: { gameId: number, comment: object }
 */
app.post('/api/broadcast/game-comment/edit', (req, res) => {
  const { gameId, comment } = req.body;

  if (!gameId || !comment) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['gameId', 'comment']
    });
  }

  if (!comment.id) {
    return res.status(400).json({ 
      error: 'Comment must have id field' 
    });
  }

  const roomName = getGameRoomName(gameId);
  const recipientCount = emitToGame(gameId, 'game_comment_edit', comment);

  res.json({ 
    success: true, 
    gameId,
    room: roomName,
    recipients: recipientCount,
    event: 'game_comment_edit',
    timestamp: new Date().toISOString()
  });
});

/**
 * Broadcast comment delete
 * POST /api/broadcast/game-comment/delete
 * Body: { gameId: number, commentId: number }
 */
app.post('/api/broadcast/game-comment/delete', (req, res) => {
  const { gameId, commentId } = req.body;

  if (!gameId || !commentId) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['gameId', 'commentId']
    });
  }

  const roomName = getGameRoomName(gameId);
  const recipientCount = emitToGame(gameId, 'game_comment_delete', {
    id: commentId,
    gameId: gameId
  });

  res.json({ 
    success: true, 
    gameId,
    commentId,
    room: roomName,
    recipients: recipientCount,
    event: 'game_comment_delete',
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// Test endpoint - Send test message to room
// ============================================================================
app.post('/api/test/send-message', (req, res) => {
  const { gameId, message } = req.body;
  
  if (!gameId) {
    return res.status(400).json({ error: 'gameId is required' });
  }

  const roomName = getGameRoomName(gameId);
  const testMessage = message || 'Test message from server';
  
  io.to(roomName).emit('message', {
    room: roomName,
    message: testMessage,
    type: 'test'
  });

  res.json({
    success: true,
    room: roomName,
    recipients: getRoomSize(roomName),
    message: testMessage
  });
});

// ============================================================================
// Export for use in other files (optional)
// ============================================================================
module.exports = { io, emitToGame, getGameRoomName };

// ============================================================================
// Server startup
// ============================================================================

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log('='.repeat(80));
  console.log(`🚀 Socket.IO Server Started`);
  console.log('='.repeat(80));
  console.log(`📡 HTTP Server:    http://${HOST}:${PORT}`);
  console.log(`🔌 Socket.IO:      http://${HOST}:${PORT} (auto-upgrade to WebSocket)`);
  console.log(`❤️  Health Check:   http://${HOST}:${PORT}/health`);
  console.log('='.repeat(80));
  console.log(`📝 API Endpoints for Broadcasting:`);
  console.log(`   POST /api/broadcast/game-comment/new    - Broadcast new comment`);
  console.log(`   POST /api/broadcast/game-comment/edit   - Broadcast edit`);
  console.log(`   POST /api/broadcast/game-comment/delete - Broadcast delete`);
  console.log(`   POST /api/test/send-message             - Test message`);
  console.log('='.repeat(80));
  console.log(`⚙️  Environment:    ${process.env.NODE_ENV || 'development'}`);
  console.log(`🕐 Started at:     ${new Date().toISOString()}`);
  console.log('='.repeat(80));
  console.log(`\n✅ Server ready! React Native app can connect to: http://${HOST}:${PORT}`);
  console.log(`\n💡 Tip: Use http://localhost:${PORT}/health to check server status\n`);
});
