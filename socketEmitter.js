/**
 * Socket Emitter Helper
 * 
 * Use this module in your backend API to easily broadcast events
 * to connected Socket.IO clients.
 * 
 * Usage:
 * const { emitNewComment, emitEditComment, emitDeleteComment } = require('./socketEmitter');
 * 
 * After saving to DB:
 * emitNewComment(gameId, fullComment);
 */

let io = null;

/**
 * Initialize with Socket.IO instance
 * Call this once during server startup
 */
function init(socketIO) {
  io = socketIO;
  console.log('[SocketEmitter] Initialized');
}

/**
 * Get room name for game
 */
function getGameRoomName(gameId) {
  return `game_${gameId}`;
}

/**
 * Get number of clients in room
 */
function getRoomSize(roomName) {
  if (!io) return 0;
  const room = io.sockets.adapter.rooms.get(roomName);
  return room ? room.size : 0;
}

/**
 * Emit new comment event to game room
 * @param {number} gameId - Game ID
 * @param {object} comment - Full comment object with user data
 * @returns {number} Number of recipients
 */
function emitNewComment(gameId, comment) {
  if (!io) {
    console.warn('[SocketEmitter] Not initialized. Call init(io) first.');
    return 0;
  }

  const roomName = getGameRoomName(gameId);
  const recipients = getRoomSize(roomName);

  io.to(roomName).emit('game_comment_new', comment);

  console.log(`[SocketEmitter] game_comment_new → ${roomName} (${recipients} clients)`);
  return recipients;
}

/**
 * Emit edit comment event to game room
 * @param {number} gameId - Game ID
 * @param {object} comment - Updated comment object
 * @returns {number} Number of recipients
 */
function emitEditComment(gameId, comment) {
  if (!io) {
    console.warn('[SocketEmitter] Not initialized. Call init(io) first.');
    return 0;
  }

  const roomName = getGameRoomName(gameId);
  const recipients = getRoomSize(roomName);

  io.to(roomName).emit('game_comment_edit', comment);

  console.log(`[SocketEmitter] game_comment_edit → ${roomName} (${recipients} clients)`);
  return recipients;
}

/**
 * Emit delete comment event to game room
 * @param {number} gameId - Game ID
 * @param {number} commentId - ID of deleted comment
 * @returns {number} Number of recipients
 */
function emitDeleteComment(gameId, commentId) {
  if (!io) {
    console.warn('[SocketEmitter] Not initialized. Call init(io) first.');
    return 0;
  }

  const roomName = getGameRoomName(gameId);
  const recipients = getRoomSize(roomName);

  io.to(roomName).emit('game_comment_delete', {
    id: commentId,
    gameId: gameId
  });

  console.log(`[SocketEmitter] game_comment_delete → ${roomName} (${recipients} clients)`);
  return recipients;
}

/**
 * Emit custom event to game room
 * @param {number} gameId - Game ID
 * @param {string} eventName - Event name
 * @param {any} data - Event data
 * @returns {number} Number of recipients
 */
function emitToGame(gameId, eventName, data) {
  if (!io) {
    console.warn('[SocketEmitter] Not initialized. Call init(io) first.');
    return 0;
  }

  const roomName = getGameRoomName(gameId);
  const recipients = getRoomSize(roomName);

  io.to(roomName).emit(eventName, data);

  console.log(`[SocketEmitter] ${eventName} → ${roomName} (${recipients} clients)`);
  return recipients;
}

/**
 * Emit to specific user by userId
 * @param {number} userId - User ID
 * @param {string} eventName - Event name
 * @param {any} data - Event data
 * @returns {number} Number of recipients (0 or 1)
 */
function emitToUser(userId, eventName, data) {
  if (!io) {
    console.warn('[SocketEmitter] Not initialized. Call init(io) first.');
    return 0;
  }

  const userRoom = `user_${userId}`;
  const recipients = getRoomSize(userRoom);

  io.to(userRoom).emit(eventName, data);

  console.log(`[SocketEmitter] ${eventName} → user_${userId} (${recipients} clients)`);
  return recipients;
}

/**
 * Check if Socket.IO is initialized
 * @returns {boolean}
 */
function isInitialized() {
  return io !== null;
}

/**
 * Get Socket.IO instance
 * @returns {object|null}
 */
function getIO() {
  return io;
}

module.exports = {
  init,
  emitNewComment,
  emitEditComment,
  emitDeleteComment,
  emitToGame,
  emitToUser,
  getGameRoomName,
  getRoomSize,
  isInitialized,
  getIO
};
