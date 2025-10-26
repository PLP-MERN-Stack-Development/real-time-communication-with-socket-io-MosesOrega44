import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

export default function App() {
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentRoom, setCurrentRoom] = useState('general');
  const [rooms, setRooms] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [privateRecipient, setPrivateRecipient] = useState('');
  const messagesEndRef = useRef(null);

  // Connection and event listeners
  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    
    socket.on('new_message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('new_private_message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('users_online', (usersList) => {
      setUsers(usersList);
    });

    socket.on('user_joined', (user) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `${user} joined the chat`,
        type: 'system'
      }]);
    });

    socket.on('user_left', (user) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `${user} left the chat`,
        type: 'system'
      }]);
    });

    socket.on('room_list', (roomList) => setRooms(roomList));
    socket.on('room_changed', (room) => setCurrentRoom(room));

    socket.on('user_typing', (user) => {
      setTypingUsers(prev => [...prev.filter(u => u !== user), user]);
    });

    socket.on('user_stop_typing', (user) => {
      setTypingUsers(prev => prev.filter(u => u !== user));
    });

    return () => {
      socket.off('connect');
      socket.off('new_message');
      socket.off('users_online');
      socket.off('user_joined');
      socket.off('user_left');
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (username.trim()) {
      socket.emit('user_join', username.trim());
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim()) {
      if (privateRecipient) {
        socket.emit('send_private_message', {
          to: privateRecipient,
          text: message
        });
        setPrivateRecipient('');
      } else {
        socket.emit('send_message', { text: message });
      }
      setMessage('');
      socket.emit('typing_stop');
    }
  };

  const handleTyping = () => {
    if (message.trim()) {
      socket.emit('typing_start');
    } else {
      socket.emit('typing_stop');
    }
  };

  const joinRoom = (roomName) => {
    socket.emit('join_room', roomName);
    setMessages([]);
  };

  const startPrivateChat = (user) => {
    setPrivateRecipient(user);
    setMessages(prev => [...prev, {
      id: Date.now(),
      text: `Started private chat with ${user}`,
      type: 'system'
    }]);
  };

  if (!username) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-96">
          <h1 className="text-2xl font-bold mb-6 text-center">Join Chat</h1>
          <form onSubmit={handleJoin} className="space-y-4">
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Join Chat
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Chat Rooms</h2>
          <div className="mt-2 space-y-1">
            {rooms.map(room => (
              <button
                key={room}
                onClick={() => joinRoom(room)}
                className={`w-full text-left p-2 rounded ${
                  currentRoom === room ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'
                }`}
              >
                # {room}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          <h2 className="text-lg font-semibold">Online Users ({users.length})</h2>
          <div className="mt-2 space-y-1">
            {users.map(user => (
              <div key={user.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  <span>{user.username}</span>
                </div>
                <button
                  onClick={() => startPrivateChat(user.username)}
                  className="text-blue-500 hover:text-blue-700 text-sm"
                >
                  PM
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-sm p-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">#{currentRoom}</h1>
            <div className="text-sm text-gray-500 flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              {isConnected ? 'Connected' : 'Disconnected'}
              {privateRecipient && (
                <span className="ml-2 text-blue-600">• Private: {privateRecipient}</span>
              )}
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {typingUsers.length > 0 && (
              <span>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</span>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`p-3 rounded-lg max-w-2xl ${
              msg.type === 'system' 
                ? 'bg-yellow-100 text-center text-yellow-800' 
                : msg.type === 'private'
                ? 'bg-purple-100 border-l-4 border-purple-500'
                : 'bg-white shadow-sm'
            }`}>
              {msg.type !== 'system' && (
                <div className="flex justify-between items-baseline mb-1">
                  <span className={`font-semibold ${
                    msg.type === 'private' ? 'text-purple-600' : 'text-blue-600'
                  }`}>
                    {msg.username}
                    {msg.type === 'private' && ' (PM)'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              )}
              <p className="text-gray-800">{msg.text}</p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="bg-white border-t p-4">
          <form onSubmit={handleSendMessage} className="flex space-x-4">
            <input
              type="text"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                handleTyping();
              }}
              placeholder={
                privateRecipient 
                  ? `Private message to ${privateRecipient}...` 
                  : `Message in #${currentRoom}...`
              }
              className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-500 text-white px-6 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}