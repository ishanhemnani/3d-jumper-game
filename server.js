require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');

// Debug: Log environment variables
console.log('Environment variables loaded:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'defined' : 'undefined');
console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY ? 'defined' : 'undefined');

// Inject environment variables into client-side code
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html') {
    // Debug information
    console.log('Serving index.html with injected environment variables');
    
    fs.readFile(path.join(__dirname, 'index.html'), 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading index.html:', err);
        return next(err);
      }
      
      // Inject environment variables
      const injectedData = data.replace('</head>', 
        `<script>
          window.SUPABASE_URL = "${process.env.SUPABASE_URL}";
          window.SUPABASE_KEY = "${process.env.SUPABASE_KEY}";
          console.log('Environment variables injected by server');
        </script>
        </head>`
      );
      
      res.send(injectedData);
    });
  } else {
    next();
  }
});

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