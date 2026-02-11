/**
 * API Integration Examples
 *
 * This file shows how to integrate Socket.IO broadcasting
 * into your backend API endpoints.
 */

// ============================================================================
// ВАРИАНТ 1: Использование socketEmitter (РЕКОМЕНДУЕМЫЙ)
// ============================================================================

const { emitNewComment, emitEditComment, emitDeleteComment } = require('socketEmitter');

// В вашем main файле (index.js или app.js):
// const socketEmitter = require('./socketEmitter');
// socketEmitter.init(io); // инициализировать один раз при старте

/**
 * Example: Create comment endpoint
 */
async function createCommentAPI(req, res) {
  const { gameId, userId, text } = req.body;

  try {
    // 1. Сохранить в БД
    const comment = await db.comments.create({
      gameId,
      userId,
      text,
      createdAt: new Date()
    });

    // 2. Получить данные пользователя
    const user = await db.users.findById(userId);

    // 3. Подготовить полный объект
    const fullComment = {
      id: comment.id,
      gameId: comment.gameId,
      userId: comment.userId,
      text: comment.text,
      createdAt: comment.createdAt,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar
      }
    };

    // 4. ✅ Отправить через Socket.IO
    emitNewComment(gameId, fullComment);

    // 5. Вернуть ответ
    res.status(201).json(fullComment);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
}

/**
 * Example: Edit comment endpoint
 */
async function editCommentAPI(req, res) {
  const { id } = req.params;
  const { text, userId } = req.body;

  try {
    // 1. Получить существующий комментарий
    const existingComment = await db.comments.findById(id);

    if (!existingComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // 2. Проверить права
    if (existingComment.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // 3. Обновить в БД
    const updatedComment = await db.comments.update(id, {
      text,
      updatedAt: new Date()
    });

    // 4. Получить данные пользователя
    const user = await db.users.findById(userId);

    // 5. Подготовить полный объект
    const fullComment = {
      ...updatedComment,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar
      }
    };

    // 6. ✅ Отправить через Socket.IO
    emitEditComment(existingComment.gameId, fullComment);

    // 7. Вернуть ответ
    res.json(fullComment);
  } catch (error) {
    console.error('Error editing comment:', error);
    res.status(500).json({ error: 'Failed to edit comment' });
  }
}

/**
 * Example: Delete comment endpoint
 */
async function deleteCommentAPI(req, res) {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    // 1. Получить комментарий
    const comment = await db.comments.findById(id);

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // 2. Проверить права
    if (comment.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // 3. Удалить из БД
    await db.comments.delete(id);

    // 4. ✅ Отправить через Socket.IO
    emitDeleteComment(comment.gameId, id);

    // 5. Вернуть ответ
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
}

// ============================================================================
// ВАРИАНТ 2: Прямой HTTP запрос к Socket.IO серверу
// ============================================================================

/**
 * If Socket.IO runs as separate microservice
 */
async function createCommentWithHTTP(req, res) {
  const { gameId, userId, text } = req.body;

  try {
    // 1. Сохранить в БД
    const comment = await db.comments.create({ gameId, userId, text });
    const user = await db.users.findById(userId);

    const fullComment = {
      id: comment.id,
      gameId: comment.gameId,
      userId: comment.userId,
      text: comment.text,
      createdAt: comment.createdAt,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar
      }
    };

    // 2. ✅ Отправить через HTTP API
    await fetch('http://localhost:3000/api/broadcast/game-comment/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameId: gameId,
        comment: fullComment
      })
    });

    // 3. Вернуть ответ
    res.status(201).json(fullComment);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
}

// ============================================================================
// ВАРИАНТ 3: Middleware для автоматической отправки
// ============================================================================

/**
 * Middleware: автоматически отправляет события после ответа
 */
function socketBroadcastMiddleware(req, res, next) {
  // Сохраняем оригинальный json метод
  const originalJson = res.json.bind(res);

  // Переопределяем json метод
  res.json = function(data) {
    // Отправляем ответ клиенту
    originalJson(data);

    // После отправки ответа - broadcast через Socket.IO
    if (res.locals.socketBroadcast) {
      const { eventType, gameId, data: broadcastData } = res.locals.socketBroadcast;

      switch (eventType) {
        case 'new':
          emitNewComment(gameId, broadcastData);
          break;
        case 'edit':
          emitEditComment(gameId, broadcastData);
          break;
        case 'delete':
          emitDeleteComment(gameId, broadcastData);
          break;
      }
    }
  };

  next();
}

// Использование middleware:
async function createCommentWithMiddleware(req, res) {
  const { gameId, userId, text } = req.body;

  try {
    const comment = await db.comments.create({ gameId, userId, text });
    const user = await db.users.findById(userId);

    const fullComment = {
      id: comment.id,
      gameId: comment.gameId,
      userId: comment.userId,
      text: comment.text,
      createdAt: comment.createdAt,
      user: { id: user.id, username: user.username, avatar: user.avatar }
    };

    // Установить данные для broadcast
    res.locals.socketBroadcast = {
      eventType: 'new',
      gameId: gameId,
      data: fullComment
    };

    // Middleware автоматически отправит через Socket.IO
    res.status(201).json(fullComment);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
}

// ============================================================================
// ВАРИАНТ 4: Service Layer Pattern
// ============================================================================

/**
 * Comment Service - содержит всю бизнес-логику
 */
class CommentService {
  async createComment(gameId, userId, text) {
    // 1. Сохранить в БД
    const comment = await db.comments.create({ gameId, userId, text, createdAt: new Date() });

    // 2. Получить пользователя
    const user = await db.users.findById(userId);

    // 3. Полный объект
    const fullComment = {
      id: comment.id,
      gameId: comment.gameId,
      userId: comment.userId,
      text: comment.text,
      createdAt: comment.createdAt,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar
      }
    };

    // 4. ✅ Broadcast
    emitNewComment(gameId, fullComment);

    return fullComment;
  }

  async editComment(commentId, userId, text) {
    const existing = await db.comments.findById(commentId);

    if (!existing) {
      throw new Error('Comment not found');
    }

    if (existing.userId !== userId) {
      throw new Error('Not authorized');
    }

    const updated = await db.comments.update(commentId, { text, updatedAt: new Date() });
    const user = await db.users.findById(userId);

    const fullComment = {
      ...updated,
      user: { id: user.id, username: user.username, avatar: user.avatar }
    };

    // ✅ Broadcast
    emitEditComment(existing.gameId, fullComment);

    return fullComment;
  }

  async deleteComment(commentId, userId) {
    const comment = await db.comments.findById(commentId);

    if (!comment) {
      throw new Error('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new Error('Not authorized');
    }

    await db.comments.delete(commentId);

    // ✅ Broadcast
    emitDeleteComment(comment.gameId, commentId);

    return true;
  }
}

// Использование:
const commentService = new CommentService();

async function createCommentWithService(req, res) {
  try {
    const fullComment = await commentService.createComment(
      req.body.gameId,
      req.body.userId,
      req.body.text
    );
    res.status(201).json(fullComment);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================================================
// Express Router Setup
// ============================================================================

function setupCommentRoutes(app) {
  const express = require('express');
  const router = express.Router();

  // Использовать middleware для всех routes (опционально)
  // router.use(socketBroadcastMiddleware);

  router.post('/game/:gameId/comments', createCommentAPI);
  router.put('/game/comments/:id', editCommentAPI);
  router.delete('/game/comments/:id', deleteCommentAPI);

  app.use('/api', router);
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Варианты функций
  createCommentAPI,
  editCommentAPI,
  deleteCommentAPI,
  createCommentWithHTTP,
  createCommentWithMiddleware,

  // Service
  CommentService,

  // Middleware
  socketBroadcastMiddleware,

  // Setup
  setupCommentRoutes
};

// ============================================================================
// Резюме: Какой вариант выбрать?
// ============================================================================

/**
 * 1. ВАРИАНТ 1 (socketEmitter) - РЕКОМЕНДУЕТСЯ ✅
 *    - Простой в использовании
 *    - Не требует HTTP запросов
 *    - Легко тестировать
 *    - Лучшая производительность
 *
 * 2. ВАРИАНТ 2 (HTTP API) - Если Socket.IO отдельный сервис
 *    - Микросервисная архитектура
 *    - Socket.IO изолирован
 *    - Дополнительные HTTP запросы
 *
 * 3. ВАРИАНТ 3 (Middleware) - Для автоматизации
 *    - Меньше кода в endpoints
 *    - Централизованная логика
 *    - Сложнее для понимания
 *
 * 4. ВАРИАНТ 4 (Service Layer) - Для крупных проектов
 *    - Чистая архитектура
 *    - Легко тестировать
 *    - Переиспользуемая логика
 */
