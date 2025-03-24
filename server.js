const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Serve static files from the current directory
app.use(express.static(path.join(__dirname, './')));

// Simple health check route
app.get('/health', (req, res) => {
  res.status(200).send('Server is running');
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
}); 