# 🚀 Socket.IO Server - Ready to Use!

## ✅ Что сделано

Сервер полностью настроен для работы с React Native приложением:

- ✅ Socket.IO сервер
- ✅ Управление комнатами (rooms)
- ✅ HTTP API для broadcasting
- ✅ Вспомогательный модуль `socketEmitter.js`
- ✅ Примеры интеграции
- ✅ Автоматическое переподключение
- ✅ Поддержка CORS

---

## 🚀 Быстрый старт

### 1. Установить зависимости (если еще не установлены)

```bash
npm install
```

### 2. Запустить сервер

```bash
npm start
```

Вы увидите:
```
🚀 Socket.IO Server Started
📡 HTTP Server:    http://0.0.0.0:3000
🔌 Socket.IO:      http://0.0.0.0:3000
❤️  Health Check:   http://0.0.0.0:3000/health
```

### 3. Проверить работу

```bash
curl http://localhost:3000/health
```

---

## 📡 API Endpoints

Сервер предоставляет HTTP endpoints для отправки событий:

### POST /api/broadcast/game-comment/new

Отправить новый комментарий всем клиентам в комнате игры.

**Request:**
```json
{
  "gameId": 123,
  "comment": {
    "id": 456,
    "gameId": 123,
    "userId": 789,
    "text": "Hello!",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "user": {
      "id": 789,
      "username": "john_doe",
      "avatar": "https://example.com/avatar.jpg"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "gameId": 123,
  "room": "game_123",
  "recipients": 5,
  "event": "game_comment_new",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST /api/broadcast/game-comment/edit

Отправить обновленный комментарий.

**Request:**
```json
{
  "gameId": 123,
  "comment": {
    "id": 456,
    "text": "Updated text",
    "updatedAt": "2024-01-01T00:05:00.000Z"
  }
}
```

### POST /api/broadcast/game-comment/delete

Отправить событие удаления комментария.

**Request:**
```json
{
  "gameId": 123,
  "commentId": 456
}
```

---

## 🔧 Интеграция с бэкендом

### Вариант 1: Использование socketEmitter.js (РЕКОМЕНДУЕТСЯ)

#### Шаг 1: Инициализировать в main файле

В вашем `index.js` или `app.js`:

```javascript
const socketEmitter = require('./path/to/socketEmitter');
const { io } = require('./path/to/socket-server');

// После создания Socket.IO сервера
socketEmitter.init(io);
```

#### Шаг 2: Использовать в API endpoints

```javascript
const {emitNewComment, emitEditComment, emitDeleteComment} = require('socketEmitter');

// После создания комментария в БД
app.post('/api/game/:gameId/comment', async (req, res) => {
    const {gameId, userId, text} = req.body;

    // 1. Сохранить в БД
    const comment = await db.comments.create({gameId, userId, text});
    const user = await db.users.findById(userId);

    // 2. Подготовить полный объект
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

    // 3. ✅ Отправить через Socket.IO
    emitNewComment(gameId, fullComment);

    // 4. Вернуть ответ
    res.status(201).json(fullComment);
});

// После редактирования
app.put('/api/game/comment/:id', async (req, res) => {
    // ... обновить в БД ...
    emitEditComment(comment.gameId, updatedComment);
    res.json(updatedComment);
});

// После удаления
app.delete('/api/game/comment/:id', async (req, res) => {
    // ... удалить из БД ...
    emitDeleteComment(comment.gameId, commentId);
    res.status(204).send();
});
```

### Вариант 2: HTTP API (если Socket.IO отдельный сервис)

```javascript
// После создания комментария
await fetch('http://localhost:3000/api/broadcast/game-comment/new', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    gameId: gameId,
    comment: fullComment
  })
});
```

**Полные примеры:** См. файл `API_INTEGRATION_EXAMPLE.js`

---

## 🧪 Тестирование

### 1. Проверка здоровья сервера

```bash
curl http://localhost:3000/health
```

Ответ:
```json
{
  "status": "ok",
  "clients": 2,
  "rooms": 1,
  "uptime": 123.45,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. Проверка комнаты

```bash
curl http://localhost:3000/api/room/game_123
```

Ответ:
```json
{
  "room": "game_123",
  "clients": 2,
  "exists": true
}
```

### 3. Отправка тестового сообщения

```bash
curl -X POST http://localhost:3000/api/test/send-message \
  -H "Content-Type: application/json" \
  -d '{"gameId": 123, "message": "Test!"}'
```

### 4. Broadcast нового комментария

```bash
curl -X POST http://localhost:3000/api/broadcast/game-comment/new \
  -H "Content-Type: application/json" \
  -d '{
    "gameId": 123,
    "comment": {
      "id": 456,
      "gameId": 123,
      "userId": 789,
      "text": "Test comment",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "user": {
        "id": 789,
        "username": "test_user",
        "avatar": null
      }
    }
  }'
```

---

## 🎯 Как это работает

```
┌─────────────────────────────────┐
│  React Native App               │
│  (Client)                       │
└────────┬────────────────────────┘
         │
         │ socket.emit('joinRoom', 'game_123')
         ↓
┌─────────────────────────────────┐
│  Socket.IO Server               │
│  (index.js)                     │
│                                 │
│  • Принимает подключение       │
│  • Добавляет в room             │
│  • Слушает события              │
└────────┬────────────────────────┘
         ↑
         │ io.to('game_123').emit('game_comment_new', ...)
         │
┌─────────────────────────────────┐
│  Your Backend API               │
│                                 │
│  POST /api/comment              │
│  1. Save to DB ✅               │
│  2. emitNewComment() ✅         │
└─────────────────────────────────┘
```

---

## 📁 Структура файлов

```
socket-server/
├── index.js                     # Основной сервер Socket.IO
├── socketEmitter.js             # Вспомогательный модуль
├── API_INTEGRATION_EXAMPLE.js   # Примеры интеграции
├── package.json
├── .env.example
└── README_SERVER.md             # Этот файл
```

---

## ⚙️ Конфигурация

### .env файл

```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
```

### CORS

По умолчанию разрешены все источники (`origin: "*"`).

Для продакшена укажите конкретный домен в `index.js`:

```javascript
const io = socketIo(server, {
  cors: {
    origin: "https://your-domain.com",
    methods: ["GET", "POST"]
  }
});
```

---

## 🔥 Socket.IO Events

### Client → Server

| Event | Описание | Параметры |
|-------|----------|-----------|
| `joinRoom` | Присоединиться к комнате | `room` (string) |
| `leaveRoom` | Покинуть комнату | `room` (string) |
| `register` | Зарегистрировать пользователя | `userId` (number) |
| `message` | Отправить сообщение в комнату | `{room, message}` |

### Server → Client

| Event | Описание | Данные |
|-------|----------|--------|
| `game_comment_new` | Новый комментарий | `comment` object |
| `game_comment_edit` | Редактирование | `comment` object |
| `game_comment_delete` | Удаление | `{id, gameId}` |
| `message` | Generic сообщение | `{room, message}` |

---

## 🐛 Troubleshooting

### Сервер не запускается

**Ошибка:** `Error: listen EADDRINUSE`

**Решение:**
```bash
# Найти процесс на порту 3000
lsof -i :3000

# Убить процесс
kill -9 <PID>

# Или изменить порт в .env
PORT=3001
```

### Клиенты не получают сообщения

**Проверьте:**

1. Клиент присоединился к комнате?
   ```bash
   curl http://localhost:3000/api/room/game_123
   ```

2. События отправляются?
   - Смотрите логи сервера
   - Должно быть: `[Emit] game_comment_new to game_123 - X clients`

3. Правильный формат комнаты?
   - Должно быть: `game_${gameId}` (например, `game_123`)

### CORS ошибки

Если React Native не может подключиться:

1. Проверьте CORS настройки в `index.js`
2. Для разработки используйте `origin: "*"`
3. Для продакшена укажите конкретный домен

---

## 📊 Мониторинг

### Логи

Сервер выводит подробные логи:

```
[Socket.IO] Client connected: abc123 from 192.168.1.100
[Socket.IO] abc123 joined room: game_123 (2 clients)
[Emit] game_comment_new to game_123 - 2 clients
[Socket.IO] Client disconnected: abc123
```

### Health check

```bash
curl http://localhost:3000/health
```

### PM2 Monitoring (для продакшена)

```bash
pm2 start index.js --name socket-server
pm2 monit
pm2 logs socket-server
```

---

## 🚀 Деплой

### PM2 (рекомендуется)

```bash
npm install -g pm2

# Запустить
pm2 start index.js --name casezero-socket

# Автозапуск
pm2 save
pm2 startup

# Мониторинг
pm2 monit

# Логи
pm2 logs casezero-socket
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
```

```bash
docker build -t casezero-socket .
docker run -p 3000:3000 --env-file .env casezero-socket
```

---

## 📚 Документация

- **index.js** - Основной файл сервера с комментариями
- **socketEmitter.js** - Модуль с JSDoc документацией
- **API_INTEGRATION_EXAMPLE.js** - 4 варианта интеграции с примерами

---

## ✅ Чеклист готовности

- [x] Socket.IO сервер запускается
- [x] HTTP API endpoints работают
- [x] socketEmitter.js готов к использованию
- [x] Примеры интеграции написаны
- [x] Документация готова
- [ ] Интегрировано с вашим бэкендом API ← **Это нужно сделать**

---

## 🎉 Готово к использованию!

Сервер полностью настроен. Осталось только:

1. Добавить `emitNewComment()` в ваши API endpoints
2. Запустить сервер: `npm start`
3. Запустить React Native app
4. Наслаждаться real-time чатом! 🚀

**Следующий шаг:** Смотрите файл `API_INTEGRATION_EXAMPLE.js`
