// Import dotenv for environment variables
require('dotenv').config();

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Set up MIME types
express.static.mime.define({
    'image/svg+xml': ['svg'],
    'audio/mpeg': ['mp3'],
    'application/javascript': ['js']
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));
app.use('/styles', express.static(path.join(__dirname, '../styles')));
app.use('/src', express.static(path.join(__dirname, '../src')));
app.use('/config', express.static(path.join(__dirname, '../config')));
app.use('/assets', express.static(path.join(__dirname, '../public/assets')));

// Simple health check route
app.get('/health', (req, res) => {
  res.status(200).send('Server is running');
});

// Route for the test page
app.get('/test-wallet', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/test-wallet.html'));
});

// Make environment variables available to the client
app.get('/env-config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
    window.ENV = {
      SUPABASE_URL: "${process.env.SUPABASE_URL}",
      SUPABASE_KEY: "${process.env.SUPABASE_KEY}"
    };
  `);
});

const players = new Map();

io.on('connection', (socket) => {
    console.log('A player connected');

    socket.on('newPlayer', (username) => {
        console.log(`New player joined: ${username}`);
        players.set(socket.id, {
            id: socket.id,
            username: username,
            position: { x: Math.random() * 10 - 5, y: 0, z: Math.random() * 10 - 5 },
            rotation: { y: 0 }
        });
        socket.emit('currentPlayers', Array.from(players.values()));
        socket.broadcast.emit('playerJoined', players.get(socket.id));
    });

    socket.on('playerMovement', (movementData) => {
        const player = players.get(socket.id);
        if (player) {
            player.position = movementData.position;
            player.rotation = movementData.rotation;
            socket.broadcast.emit('playerMoved', player);
        }
    });

    socket.on('disconnect', () => {
        console.log('A player disconnected');
        players.delete(socket.id);
        io.emit('playerLeft', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the game at http://localhost:${PORT}`);
    console.log(`Access the wallet test page at http://localhost:${PORT}/test-wallet`);
}); 