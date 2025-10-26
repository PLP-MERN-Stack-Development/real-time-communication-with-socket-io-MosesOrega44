import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Store connected users and messages
const users = new Map();
const messages = [];
const rooms = ['general', 'random', 'tech'];

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User joins with username
  socket.on('user_join', (username) => {
    users.set(socket.id, { username, id: socket.id, room: 'general' });
    socket.join('general');
    
    // Notify others
    socket.broadcast.emit('user_joined', username);
    socket.emit('room_list', rooms);
    
    // Send current users and messages
    socket.emit('users_online', Array.from(users.values()));
    socket.emit('message_history', messages.slice(-50));
  });

  // Handle messages
  socket.on('send_message', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const message = {
      id: Date.now().toString(),
      username: user.username,
      text: data.text,
      timestamp: new Date(),
      room: user.room
    };
    
    messages.push(message);
    
    // Send to room
    io.to(user.room).emit('new_message', message);
  });

  // Typing indicators
  socket.on('typing_start', () => {
    const user = users.get(socket.id);
    if (user) {
      socket.broadcast.to(user.room).emit('user_typing', user.username);
    }
  });

  socket.on('typing_stop', () => {
    const user = users.get(socket.id);
    if (user) {
      socket.broadcast.to(user.room).emit('user_stop_typing', user.username);
    }
  });

  // Room management
  socket.on('join_room', (roomName) => {
    const user = users.get(socket.id);
    if (!user) return;

    socket.leave(user.room);
    socket.join(roomName);
    user.room = roomName;

    socket.emit('room_changed', roomName);
    socket.to(roomName).emit('user_joined_room', {
      username: user.username,
      room: roomName
    });
  });

  // Private messages
  socket.on('send_private_message', (data) => {
    const fromUser = users.get(socket.id);
    const toUser = Array.from(users.values()).find(u => u.username === data.to);
    
    if (fromUser && toUser) {
      const privateMessage = {
        id: Date.now().toString(),
        from: fromUser.username,
        to: data.to,
        text: data.text,
        timestamp: new Date(),
        type: 'private'
      };

      socket.emit('new_private_message', privateMessage);
      socket.to(toUser.id).emit('new_private_message', privateMessage);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);
      socket.broadcast.emit('user_left', user.username);
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});