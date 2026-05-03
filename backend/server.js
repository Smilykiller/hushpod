const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');

const app = express();

// CORS must be first — before every route
const corsOptions = { origin: '*', methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] };
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions)); // handle preflight (Express 5 requires regex, not bare *)

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 150 * 1024 * 1024,
  pingTimeout: 120000,
  pingInterval: 30000,
});

// Safety net — prevents server crash on unhandled errors
process.on('uncaughtException', (err) => console.error('[UNCAUGHT]', err));
process.on('unhandledRejection', (err) => console.error('[UNHANDLED]', err));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// ─── DATA STORES ───────────────────────────────────────────────────────────────
const rooms = {};
const hostGrace = {}; // { roomCode: { timerId, hostName } }

const upload = multer({ dest: 'uploads/', limits: { fileSize: 150 * 1024 * 1024 } });

// ─── FIX 2: QUEUE PERSISTENCE ──────────────────────────────────────────────────
// Saves room queue metadata to disk on every change so that a server crash/restart
// doesn't wipe the party. Audio files already live in uploads/ on disk, so streams
// still work after a restart. (Note: a full Render redeploy wipes the filesystem —
// for that you'd need a database. This covers crash restarts perfectly.)
const STATE_FILE = path.join(__dirname, 'room_state.json');

function saveRoomState() {
  try {
    const snapshot = {};
    for (const [code, room] of Object.entries(rooms)) {
      if (room.queue.length === 0) continue;
      snapshot[code] = {
        hostName:      room.hostName,
        currentSongId: room.currentSongId,
        guestUploads:  room.guestUploads,
        globalVolume:  room.globalVolume,
        // Only save songs whose file still exists on disk
        queue: room.queue
          .filter(s => s.filePath && fs.existsSync(s.filePath))
          .map(s => ({ id: s.id, name: s.name, filePath: s.filePath, type: s.type, streamUrl: s.streamUrl })),
      };
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(snapshot), 'utf8');
  } catch (e) { console.error('[STATE SAVE]', e); }
}

function loadRoomState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const snapshot = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    for (const [code, saved] of Object.entries(snapshot)) {
      const validQueue = (saved.queue || []).filter(s => s.filePath && fs.existsSync(s.filePath));
      if (validQueue.length === 0) continue;
      rooms[code] = {
        hostId: null, hostName: saved.hostName || 'Host',
        queue:  validQueue.map(s => ({ ...s, upvotes: [] })),
        currentSongId: validQueue.find(s => s.id === saved.currentSongId) ? saved.currentSongId : validQueue[0].id,
        // Start paused after restart — guests must wait for host to resume
        playState:    { playing: false, currentTime: 0, ts: Date.now() },
        members:      [],
        admins:       [],
        guestUploads: saved.guestUploads || false,
        globalVolume: saved.globalVolume || 1.0,
        orbitActive:  false,
      };
      console.log(`[STATE] Restored room ${code} with ${validQueue.length} songs`);
    }
  } catch (e) { console.error('[STATE LOAD]', e); }
}

// Load persisted rooms immediately at startup
loadRoomState();

// ─── HELPERS ───────────────────────────────────────────────────────────────────
function generateCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function getCleanQueue(room) {
  return room.queue.map(s => ({
    id: s.id,
    name: s.name,
    upvotes: s.upvotes ? s.upvotes.length : 0,
    streamUrl: s.streamUrl
  }));
}

// Helper to build the full settings payload — always includes orbitActive
// BUG FIX: Previously some events omitted orbitActive, causing clients to set it to undefined
function getSettings(room) {
  return {
    admins: room.admins,
    guestUploads: room.guestUploads,
    globalVolume: room.globalVolume,
    orbitActive: room.orbitActive || false,
  };
}

// Cleans up all uploaded files for a room and deletes the room entry
function destroyRoom(code) {
  const room = rooms[code];
  if (!room) return;
  // BUG FIX: Files were never deleted, filling up disk over time
  room.queue.forEach(s => {
    if (s.filePath && fs.existsSync(s.filePath)) {
      try { fs.unlinkSync(s.filePath); } catch (e) { console.error('[FILE CLEANUP]', e); }
    }
  });
  delete rooms[code];
  console.log(`[ROOM] ${code} destroyed`);
}

// ─── REST ROUTES ───────────────────────────────────────────────────────────────
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
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': end - start + 1,
    });
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
  if (!room.guestUploads && !room.admins.includes(uploaderId))
    return res.status(403).json({ error: 'Uploads locked' });
  if (!req.files || req.files.length === 0)
    return res.status(400).json({ error: 'No files' });

  req.files.forEach(file => {
    const songId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    room.queue.push({
      id: songId,
      filePath: file.path,
      name: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      type: file.mimetype,
      size: file.size,
      streamUrl: `/stream/${req.params.code}/${songId}`,
      upvotes: [],
    });
  });

  // Cap queue at 10, removing non-current songs first
  while (room.queue.length > 10) {
    const idxToRemove = room.queue.findIndex(s => s.id !== room.currentSongId);
    if (idxToRemove !== -1) {
      const removed = room.queue.splice(idxToRemove, 1)[0];
      if (removed.filePath && fs.existsSync(removed.filePath)) fs.unlinkSync(removed.filePath);
    } else break;
  }

  if (!room.currentSongId && room.queue.length > 0) {
    const first = room.queue[0];
    room.currentSongId = first.id;
    room.playState = { playing: false, currentTime: 0, ts: Date.now() };
    io.to(req.params.code).emit('song-changed', {
      songId: first.id, name: first.name,
      streamUrl: first.streamUrl, playState: room.playState,
    });
    io.to(req.params.code).emit('queue-updated', { queue: getCleanQueue(room) });
  } else {
    io.to(req.params.code).emit('queue-updated', { queue: getCleanQueue(room) });
  }
  saveRoomState(); // FIX 2: persist queue after every upload
  res.json({ ok: true });
});

// ─── SOCKET.IO ─────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  let roomCode = null;
  let userName = '';

  // ── CREATE ROOM ──
  socket.on('create-room', ({ name }, cb) => {
    const code = generateCode();
    // BUG FIX: room.members is now an ARRAY [], not an object {}
    // The disconnect handler was calling .findIndex() and .splice() on an object, which
    // always threw a silent TypeError — meaning members were NEVER actually removed.
    rooms[code] = {
      hostId: socket.id,
      hostName: name,
      queue: [],
      currentSongId: null,
      playState: { playing: false, currentTime: 0, ts: Date.now() },
      members: [],          // ← ARRAY, not {}
      admins: [socket.id],
      guestUploads: false,
      globalVolume: 1.0,
      orbitActive: false,
    };
    roomCode = code;
    userName = name;
    rooms[code].members.push({ id: socket.id, name, isHost: true });
    socket.join(code);
    cb({ code });
    console.log(`[ROOM] ${code} created by ${name}`);
  });

  // ── JOIN ROOM ──
  socket.on('join-room', ({ code, name, claimHost }, cb) => {
    const room = rooms[code];
    if (!room) return cb({ error: 'Room not found.' });
    if (room.members.length >= 15) return cb({ error: 'Room is full!' });

    roomCode = code;
    userName = name;

    // BUG FIX: Implement claimHost — previously this parameter was received but NEVER used.
    // When a host's browser reconnects (new socket ID), they send claimHost:true.
    // Without this, they'd rejoin as a regular guest with no admin rights, losing all DJ controls.
    let isHost = false;
    if (claimHost && hostGrace[code] && hostGrace[code].hostName === name) {
      // Host reconnected within the grace period — restore their crown!
      clearTimeout(hostGrace[code].timerId);
      delete hostGrace[code];

      isHost = true;
      room.hostId = socket.id;

      // Remove admin rights from any previous socket ID of this user
      // and grant them to the new socket ID
      room.admins = room.admins.filter(id => {
        // Keep all admin IDs that are still connected
        return io.sockets.sockets.has(id);
      });
      if (!room.admins.includes(socket.id)) room.admins.push(socket.id);

      // Update all members' isHost flag
      room.members.forEach(m => { m.isHost = false; });

      console.log(`[HOST] ${name} reclaimed crown in room ${code}`);
      socket.to(code).emit('member-left', {
        members: room.members,
        newHostName: null,
      });
    }

    room.members.push({ id: socket.id, name, isHost });
    socket.join(code);
    socket.to(code).emit('member-joined', { members: room.members });

    const currentSong = room.queue.find(s => s.id === room.currentSongId);
    cb({
      ok: true,
      isHost,
      members: room.members,
      queue: getCleanQueue(room),
      currentSong: currentSong
        ? { songId: currentSong.id, name: currentSong.name, streamUrl: currentSong.streamUrl }
        : null,
      playState: room.playState,
      admins: room.admins,
      guestUploads: room.guestUploads,
      globalVolume: room.globalVolume,
      orbitActive: room.orbitActive || false,
    });
  });

  // ── PLAYBACK CONTROLS (all gated by admins check) ──
  socket.on('schedule-play', ({ currentTime }) => {
    const room = rooms[roomCode];
    if (!room || !room.admins.includes(socket.id)) return;
    const targetTs = Date.now() + 1500;
    room.playState = { playing: true, currentTime, ts: targetTs };
    io.to(roomCode).emit('play-scheduled', { currentTime, targetTs });
  });

  socket.on('playstate', ({ playing, currentTime, ts }) => {
    const room = rooms[roomCode];
    if (!room || !room.admins.includes(socket.id)) return;
    room.playState = { playing, currentTime, ts: Date.now() };
    socket.to(roomCode).emit('playstate', { playing, currentTime, ts: room.playState.ts });
  });

  socket.on('heartbeat', ({ currentTime }) => {
    const room = rooms[roomCode];
    if (!room || !room.admins.includes(socket.id)) return;
    room.playState.currentTime = currentTime;
    room.playState.ts = Date.now();
    socket.to(roomCode).emit('heartbeat', { currentTime, ts: room.playState.ts });
  });

  socket.on('play-song', ({ songId, autoPlay }) => {
    const room = rooms[roomCode];
    if (!room || !room.admins.includes(socket.id)) return;
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
    io.to(roomCode).emit('song-changed', {
      songId, name: song.name, streamUrl: song.streamUrl, playState: room.playState,
    });
  });

  socket.on('song-ended', () => {
    const room = rooms[roomCode];
    if (!room || !room.admins.includes(socket.id)) return;
    room.currentSongId = null;
    room.playState = { playing: false, currentTime: 0, ts: Date.now() };
  });

  // ── ADMIN MANAGEMENT ──
  // BUG FIX: make-admin was duplicated — both handlers fired on every event.
  socket.on('make-admin', ({ targetId }) => {
    const room = rooms[roomCode];
    if (!room || room.hostId !== socket.id) return;
    if (!room.admins.includes(targetId)) room.admins.push(targetId);
    io.to(roomCode).emit('settings-updated', getSettings(room));
  });

  socket.on('remove-admin', ({ targetId }) => {
    const room = rooms[roomCode];
    if (!room || room.hostId !== socket.id || targetId === socket.id) return;
    room.admins = room.admins.filter(id => id !== targetId);
    io.to(roomCode).emit('settings-updated', getSettings(room));
  });

  socket.on('transfer-host', ({ targetId }) => {
    const room = rooms[roomCode];
    if (!room || room.hostId !== socket.id) return;
    room.hostId = targetId;
    if (!room.admins.includes(targetId)) room.admins.push(targetId);
    room.members.forEach(m => { m.isHost = (m.id === targetId); });
    io.to(roomCode).emit('settings-updated', getSettings(room));
    io.to(roomCode).emit('member-joined', { members: room.members });
  });

  // ── ROOM SETTINGS ──
  socket.on('toggle-guest-uploads', ({ allowed }) => {
    const room = rooms[roomCode];
    if (!room || room.hostId !== socket.id) return;
    room.guestUploads = allowed;
    // BUG FIX: Always use getSettings() so orbitActive is never accidentally set to undefined on clients
    io.to(roomCode).emit('settings-updated', getSettings(room));
  });

  socket.on('set-global-volume', ({ volume }) => {
    const room = rooms[roomCode];
    if (!room || !room.admins.includes(socket.id)) return;
    room.globalVolume = volume;
    socket.to(roomCode).emit('settings-updated', getSettings(room));
  });

  socket.on('set-orbit', ({ active }) => {
    const room = rooms[roomCode];
    if (!room || room.hostId !== socket.id) return;
    room.orbitActive = active;
    io.to(roomCode).emit('settings-updated', getSettings(room));
  });

  // ── QUEUE ──
  socket.on('reorder-queue', ({ newOrder }) => {
    const room = rooms[roomCode];
    if (!room || !room.admins.includes(socket.id)) return;
    const reordered = [];
    newOrder.forEach(id => {
      const song = room.queue.find(s => s.id === id);
      if (song) reordered.push(song);
    });
    room.queue.forEach(s => { if (!newOrder.includes(s.id)) reordered.push(s); });
    room.queue = reordered;
    io.to(roomCode).emit('queue-updated', { queue: getCleanQueue(room) });
    saveRoomState();
  });

  socket.on('upvote', ({ songId }) => {
    const room = rooms[roomCode];
    if (!room) return;
    const song = room.queue.find(s => s.id === songId);
    if (!song || song.id === room.currentSongId || song.upvotes.includes(socket.id)) return;
    song.upvotes.push(socket.id);
    const current = room.queue.find(s => s.id === room.currentSongId);
    let others = room.queue.filter(s => s.id !== room.currentSongId);
    others.sort((a, b) => (b.upvotes?.length || 0) - (a.upvotes?.length || 0));
    room.queue = current ? [current, ...others] : others;
    io.to(roomCode).emit('queue-updated', { queue: getCleanQueue(room) });
    saveRoomState();
  });

  // ── CHAT ──
  socket.on('chat-msg', ({ text }) => {
    if (roomCode) io.to(roomCode).emit('chat-msg', { name: userName, text });
  });

  // ── DISCONNECT ──
  socket.on('disconnect', () => {
    if (!roomCode || !rooms[roomCode]) return;
    const room = rooms[roomCode];

    // BUG FIX: room.members is now an array, so findIndex and splice work correctly.
    // Previously members was an object {} and these array methods always threw a silent TypeError.
    const memberIndex = room.members.findIndex(m => m.id === socket.id);
    if (memberIndex === -1) return;

    const wasHost = room.members[memberIndex].isHost;
    room.members.splice(memberIndex, 1);

    // Also remove from admins
    room.admins = room.admins.filter(id => id !== socket.id);

    console.log(`[DISCONNECT] ${userName} left room ${roomCode} (wasHost: ${wasHost})`);

    if (room.members.length === 0) {
      destroyRoom(roomCode);
      return;
    }

    if (wasHost) {
      // BUG FIX: Start a 30-second grace period before transferring the crown.
      // If the host's browser crashes or loses signal briefly, they can rejoin
      // and reclaim without disrupting the party.
      console.log(`[HOST GRACE] Starting 30s grace period for ${userName} in ${roomCode}`);

      // Notify guests that host is "away" but don't transfer yet
      io.to(roomCode).emit('member-left', {
        members: room.members,
        newHostName: null,
        hostAway: true,
      });

      hostGrace[roomCode] = {
        hostName: userName,
        timerId: setTimeout(() => {
          // Grace period expired — give the crown to the longest-connected member
          const currentRoom = rooms[roomCode];
          if (!currentRoom || currentRoom.members.length === 0) {
            delete hostGrace[roomCode];
            return;
          }

          const newHost = currentRoom.members[0];
          newHost.isHost = true;
          currentRoom.hostId = newHost.id;

          // BUG FIX: New host MUST be added to admins, otherwise all their
          // playback commands are silently rejected by the server.
          if (!currentRoom.admins.includes(newHost.id)) {
            currentRoom.admins.push(newHost.id);
          }

          delete hostGrace[roomCode];
          console.log(`[HOST] Crown transferred to ${newHost.name} in ${roomCode}`);

          io.to(roomCode).emit('member-left', {
            members: currentRoom.members,
            newHostName: newHost.name,
          });
          // Broadcast updated settings so everyone gets the new admins list
          io.to(roomCode).emit('settings-updated', getSettings(currentRoom));
        }, 30000),
      };
    } else {
      io.to(roomCode).emit('member-left', { members: room.members, newHostName: null });
    }
  });
});

// ─── SERVE REACT FRONTEND ──────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend/build')));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`HushPod running on :${PORT}`));