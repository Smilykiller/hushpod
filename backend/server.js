const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { origin: '*' }, 
  maxHttpBufferSize: 150 * 1024 * 1024,
  pingTimeout: 120000,
  pingInterval: 30000,
});

app.use(cors());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const rooms = {};
const upload = multer({ dest: 'uploads/', limits: { fileSize: 150 * 1024 * 1024 } });

function generateCode() { return Math.random().toString(36).substring(2, 7).toUpperCase(); }

app.get('/clocksync', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.json({ t: Date.now() });
});

app.get('/stream/:code/:songId', (req, res) => {
  const room = rooms[req.params.code];
  if (!room) return res.status(404).send('Room not found');
  const song = room.queue.find(s => s.id === req.params.songId);
  if (!song || !fs.existsSync(song.filePath)) return res.status(404).send('Not found');

  const stat = fs.statSync(song.filePath);
  const total = stat.size;
  const range = req.headers.range;
  res.setHeader('Content-Type', song.type || 'audio/mpeg');
  res.setHeader('Accept-Ranges', 'bytes');
  
  if (range) {
    const [s, e] = range.replace(/bytes=/, '').split('-');
    const start = parseInt(s, 10);
    const end = e ? parseInt(e, 10) : total - 1;
    res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Length': end - start + 1 });
    fs.createReadStream(song.filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Length': total });
    fs.createReadStream(song.filePath).pipe(res);
  }
});

app.post('/upload/:code', upload.array('songs', 10), (req, res) => {
  const room = rooms[req.params.code];
  const uploaderId = req.body.uploaderId;
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (!room.guestUploads && !room.admins.includes(uploaderId)) return res.status(403).json({ error: 'Uploads locked' });
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files' });

  req.files.forEach(file => {
    const songId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    room.queue.push({
      id: songId, filePath: file.path, name: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      type: file.mimetype, size: file.size, streamUrl: `/stream/${req.params.code}/${songId}`, upvotes: [] 
    });
  });
  
  while (room.queue.length > 10) { 
    const idxToRemove = room.queue.findIndex(s => s.id !== room.currentSongId);
    if (idxToRemove !== -1) {
      const removed = room.queue.splice(idxToRemove, 1)[0];
      if (fs.existsSync(removed.filePath)) fs.unlinkSync(removed.filePath);
    } else {
      break; 
    }
  }
  
  if (!room.currentSongId && room.queue.length > 0) {
    const first = room.queue[0];
    room.currentSongId = first.id;
    room.playState = { playing: false, currentTime: 0, ts: Date.now() };
    io.to(req.params.code).emit('song-changed', { songId: first.id, name: first.name, streamUrl: first.streamUrl, playState: room.playState });
    io.to(req.params.code).emit('queue-updated', { queue: getCleanQueue(room) }); 
  } else {
    io.to(req.params.code).emit('queue-updated', { queue: getCleanQueue(room) });
  }
  res.json({ ok: true });
});

function getCleanQueue(room) {
  return room.queue.map(s => ({ id: s.id, name: s.name, upvotes: s.upvotes ? s.upvotes.length : 0 }));
}

io.on('connection', (socket) => {
  let roomCode = null; let userName = '';

  socket.on('create-room', ({ name }, cb) => {
    const code = generateCode();
    rooms[code] = { 
      hostId: socket.id, hostName: name, queue: [], currentSongId: null, 
      playState: { playing: false, currentTime: 0, ts: Date.now() }, 
      members: {}, theme: 'default',
      admins: [socket.id], guestUploads: false, globalVolume: 1.0
    };
    roomCode = code; userName = name;
    rooms[code].members[socket.id] = { id: socket.id, name, isHost: true };
    socket.join(code); cb({ code });
  });

  socket.on('join-room', ({ code, name, claimHost }, cb) => {
    const room = rooms[code];
    if (!room) return cb({ error: 'Room not found.', full: false });
    if (Object.keys(room.members).length >= 15) return cb({ error: 'Room is full!', full: true });
    
    roomCode = code; userName = name;
    room.members[socket.id] = { id: socket.id, name, isHost: false };
    socket.join(code);
    
    socket.to(code).emit('member-joined', { members: Object.values(room.members) });
    
    const currentSong = room.queue.find(s => s.id === room.currentSongId);
    cb({ 
      ok: true, isHost: false, members: Object.values(room.members), queue: getCleanQueue(room), 
      currentSong: currentSong ? { songId: currentSong.id, name: currentSong.name, streamUrl: currentSong.streamUrl } : null, 
      playState: room.playState, theme: room.theme,
      admins: room.admins, guestUploads: room.guestUploads, globalVolume: room.globalVolume
    });
  });

  socket.on('schedule-play', ({ currentTime }) => {
    const room = rooms[roomCode];
    if (room && room.admins.includes(socket.id)) {
      const targetTs = Date.now() + 1500; 
      room.playState = { playing: true, currentTime, ts: targetTs };
      io.to(roomCode).emit('play-scheduled', { currentTime, targetTs }); 
    }
  });

  socket.on('playstate', ({ playing, currentTime, ts }) => {
    const room = rooms[roomCode];
    if (room && room.admins.includes(socket.id)) {
      room.playState = { playing, currentTime, ts: Date.now() };
      socket.to(roomCode).emit('playstate', { playing, currentTime, ts: room.playState.ts }); 
    }
  });

  socket.on('heartbeat', ({ currentTime }) => {
    const room = rooms[roomCode];
    if (room && room.admins.includes(socket.id)) {
      room.playState.currentTime = currentTime; room.playState.ts = Date.now();
      socket.to(roomCode).emit('heartbeat', { currentTime, ts: room.playState.ts });
    }
  });

  socket.on('play-song', ({ songId, autoPlay }) => {
    const room = rooms[roomCode];
    if (room && room.admins.includes(socket.id)) {
      const song = room.queue.find(s => s.id === songId); 
      if (!song) return;
      room.currentSongId = songId;
      if (autoPlay) { 
        const targetTs = Date.now() + 1500; 
        room.playState = { playing: true, currentTime: 0, ts: targetTs }; 
        io.to(roomCode).emit('play-scheduled', { currentTime: 0, targetTs }); 
      } else { 
        room.playState = { playing: false, currentTime: 0, ts: Date.now() }; 
      }
      io.to(roomCode).emit('song-changed', { songId, name: song.name, streamUrl: song.streamUrl, playState: room.playState });
    }
  });

  socket.on('song-ended', () => {
    const room = rooms[roomCode];
    if (room && room.admins.includes(socket.id)) {
      room.currentSongId = null;
      room.playState = { playing: false, currentTime: 0, ts: Date.now() };
    }
  });

  socket.on('make-admin', ({ targetId }) => {
    const room = rooms[roomCode];
    if (room && room.hostId === socket.id && !room.admins.includes(targetId)) {
      room.admins.push(targetId);
      io.to(roomCode).emit('settings-updated', { admins: room.admins, guestUploads: room.guestUploads, globalVolume: room.globalVolume });
    }
  });
  socket.on('make-admin', ({ targetId }) => {
    const room = rooms[roomCode];
    if (room && room.hostId === socket.id && !room.admins.includes(targetId)) {
      room.admins.push(targetId);
      io.to(roomCode).emit('settings-updated', { admins: room.admins, guestUploads: room.guestUploads, globalVolume: room.globalVolume });
    }
  });

  // --- PASTE THESE TWO NEW COMMANDS HERE ---
  socket.on('remove-admin', ({ targetId }) => {
    const room = rooms[roomCode];
    // Only the host can remove an admin, and they cannot remove themselves
    if (room && room.hostId === socket.id && targetId !== socket.id) {
      room.admins = room.admins.filter(id => id !== targetId);
      io.to(roomCode).emit('settings-updated', { admins: room.admins, guestUploads: room.guestUploads, globalVolume: room.globalVolume });
    }
  });

  socket.on('transfer-host', ({ targetId }) => {
    const room = rooms[roomCode];
    if (room && room.hostId === socket.id) {
      room.hostId = targetId; // Transfer the host ID
      
      // Ensure the new host is automatically in the admins array
      if (!room.admins.includes(targetId)) room.admins.push(targetId);
      
      // Move the visually-displayed 'isHost' badge to the new person
      Object.values(room.members).forEach(m => {
        m.isHost = (m.id === targetId);
      });
      
      // Broadcast the massive power shift to the room
      io.to(roomCode).emit('settings-updated', { admins: room.admins, guestUploads: room.guestUploads, globalVolume: room.globalVolume });
      io.to(roomCode).emit('member-joined', { members: Object.values(room.members) }); 
    }
  });
  // -----------------------------------------

  socket.on('toggle-guest-uploads', ({ allowed }) => {
    const room = rooms[roomCode];
    if (room && room.hostId === socket.id) {
      room.guestUploads = allowed;
      io.to(roomCode).emit('settings-updated', { admins: room.admins, guestUploads: room.guestUploads, globalVolume: room.globalVolume });
    }
  });

  socket.on('set-global-volume', ({ volume }) => {
    const room = rooms[roomCode];
    if (room && room.admins.includes(socket.id)) {
      room.globalVolume = volume;
      socket.to(roomCode).emit('settings-updated', { admins: room.admins, guestUploads: room.guestUploads, globalVolume: room.globalVolume });
    }
  });

  socket.on('chat-msg', ({ text }) => { if (roomCode) io.to(roomCode).emit('chat-msg', { name: userName, text }); });

  socket.on('reorder-queue', ({ newOrder }) => {
    const room = rooms[roomCode];
    if (room && room.admins.includes(socket.id)) {
      const reordered = [];
      newOrder.forEach(id => {
        const song = room.queue.find(s => s.id === id);
        if (song) reordered.push(song);
      });
      room.queue.forEach(s => { if (!newOrder.includes(s.id)) reordered.push(s); });
      room.queue = reordered;
      io.to(roomCode).emit('queue-updated', { queue: getCleanQueue(room) });
    }
  });

  socket.on('upvote', ({ songId }) => {
    const room = rooms[roomCode];
    if (!room) return;
    const song = room.queue.find(s => s.id === songId);
    if (song && song.id !== room.currentSongId && !song.upvotes.includes(socket.id)) {
      song.upvotes.push(socket.id);
      const current = room.queue.find(s => s.id === room.currentSongId);
      let others = room.queue.filter(s => s.id !== room.currentSongId);
      others.sort((a, b) => (b.upvotes?.length || 0) - (a.upvotes?.length || 0));
      room.queue = current ? [current, ...others] : others;
      io.to(roomCode).emit('queue-updated', { queue: getCleanQueue(room) });
    }
  });
  socket.on('set-orbit', ({ active }) => {
    const room = rooms[roomCode];
    if (room && room.hostId === socket.id) {
      room.orbitActive = active;
      io.to(roomCode).emit('settings-updated', { admins: room.admins, guestUploads: room.guestUploads, globalVolume: room.globalVolume, orbitActive: room.orbitActive });
    }
  });
 socket.on('disconnect', () => {
    try {
      const room = rooms[roomCode];
      if (!room) return;
      delete room.members[socket.id];
      
      // FIX: If Host leaves, auto-promote the oldest guest! Never stop the music.
      if (room.hostId === socket.id) {
        const remainingIds = Object.keys(room.members);
        if (remainingIds.length > 0) {
          const newHostId = remainingIds[0]; // The first person who joined
          room.hostId = newHostId;
          room.admins = [newHostId]; // Keep compatibility
          room.members[newHostId].isHost = true;
          
          io.to(roomCode).emit('settings-updated', { admins: room.admins, guestUploads: room.guestUploads, globalVolume: room.globalVolume, orbitActive: room.orbitActive });
          io.to(roomCode).emit('member-joined', { members: Object.values(room.members) });
        } else {
          // Only destroy the room if it is completely empty
          room.queue.forEach(s => { if (fs.existsSync(s.filePath)) fs.unlinkSync(s.filePath); });
          delete rooms[roomCode]; 
        }
      } else {
        socket.to(roomCode).emit('member-left', { members: Object.values(room.members) });
      }
    } catch (err) {}
  });

// --- SERVE THE REACT FRONTEND ---
app.use(express.static(path.join(__dirname, '../frontend/build')));

// FIX: Use app.use instead of app.get('*') to avoid the path-to-regexp crash
app.use((req, res) => { 
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html')); 
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`HushPod Backend running on :${PORT}`));