import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';

// Empty string = relative URLs. Frontend and backend are the same Render service,
// so all API calls (/clocksync, /upload, /stream, socket.io) go to the same origin.
// This also eliminates ALL CORS issues since there's no cross-origin request at all.
const SERVER = "";

export default function useHushPodEngine() {
  const navigate = useNavigate();
  const location = useLocation();

  const setView = (viewName) => {
    if (viewName === 'marketing') navigate('/');
    else if (viewName === 'app-entry') navigate('/join');
    else if (viewName === 'room') navigate('/room');
  };

  // ==========================================
  // STATE
  // ==========================================
  const [toastData, setToastData]       = useState({ msg: '', type: 'inf', visible: false });
  const [modals, setModals]             = useState({ qr: false, tos: false });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [roomTab, setRoomTab]           = useState('dj');

  const [uname, setUname]               = useState('');
  const [roomCode, setRoomCode]         = useState('');
  const [isSyncing, setIsSyncing]       = useState(true);
  const [codeInput, setCodeInput]       = useState('');

  const [members, setMembers]           = useState([]);
  const [queue, setQueue]               = useState([]);
  const [chat, setChat]                 = useState([]);
  const [currentSong, setCurrentSong]   = useState(null);

  const [syncState, setSyncState]       = useState({ state: 'syncing', label: 'Waiting for host...' });
  const [isPlaying, setIsPlaying]       = useState(false);
  const [trackReady, setTrackReady]     = useState(true);

  const [guestUploads, setGuestUploads] = useState(false);
  const [globalVolume, setGlobalVolume] = useState(1.0);
  const [orbitActive, setOrbitActive]   = useState(false);
  const [isShuffle, setIsShuffle]       = useState(false);
  const [draggedIdx, setDraggedIdx]     = useState(null);

  const [musicalChairActive, setMusicalChairActive] = useState(false);
  const [loopMode, setLoopMode]         = useState('none');
  const [localVolume, setLocalVolume]   = useState(1.0);

  // Feature: Floating reactions
  const [reactions, setReactions]       = useState([]); // [{id, emoji, name, x}]
  // Feature: Typing indicator
  const [typingUsers, setTypingUsers]   = useState([]); // ['Alice', 'Bob']
  // Feature: Room password
  const [roomPassword, setRoomPassword] = useState('');
  const [joinPassword, setJoinPassword] = useState('');

  const typingTimers = useRef({});

  const [tosChecked, setTosChecked]     = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  // ==========================================
  // REFS
  // ==========================================
  const socketRef       = useRef(null);
  const actxRef         = useRef(null);
  const audioBufferRef  = useRef(null);
  const sourceNodeRef   = useRef(null);
  const gainNodeRef     = useRef(null);
  const pannerNodeRef   = useRef(null);
  const analyserRef     = useRef(null);
  const trackCacheRef   = useRef({});

  const loadSessionId   = useRef(0);
  const progFillRef     = useRef(null);
  const tCurRef         = useRef(null);
  const chatBoxRef      = useRef(null);
  const vizRafRef       = useRef(null);
  const toastTmr        = useRef(null);
  const musicalChairTimer = useRef(null);
  const keepAliveRef    = useRef(null);
  const sleepArmorTmr   = useRef(null);

  // Master state ref — the audio engine reads this directly to avoid stale closures
  const stateRef = useRef({
    clockOff: 0,
    songOffset: 0,
    nodeStartTime: 0,
    localPlayState: false,
    amHost: false,
    queue: [],
    loopMode: 'none',
    shuffle: false,
    currentSongId: null,
    uname: '',
    members: [],
    globalVolume: 1.0,
    orbitActive: false,
    accumulatedRateDrift: 0,
    lastHeartbeatTime: 0,
    isTransitioning: false,
    isTransitioningOS: false,
    isCalibrated: false,
    outLat: 0.050,
    roomCode: '',
  });

  // ==========================================
  // HELPERS
  // ==========================================
  const toast = (msg, type = 'inf') => {
    setToastData({ msg, type, visible: true });
    clearTimeout(toastTmr.current);
    toastTmr.current = setTimeout(() => setToastData(t => ({ ...t, visible: false })), 3000);
  };

  const myMemberData = members.find(m => m.id === socketRef.current?.id);
  const amHost       = myMemberData ? myMemberData.isHost : false;
  const currentHost  = members.find(m => m.isHost);
  const roomTitle    = currentHost ? `${currentHost.name}'s Party` : 'ROOM';

  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00';
    return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  };

  const sNow = () => Date.now() + stateRef.current.clockOff;

  // ==========================================
  // USE EFFECTS
  // ==========================================

  // 1. WAKE LOCK — prevents screen-off from killing audio
  useEffect(() => {
    let wakeLock = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
      } catch (err) {}
    };
    requestWakeLock();
    const handleVis = () => { if (document.visibilityState === 'visible') requestWakeLock(); };
    document.addEventListener('visibilitychange', handleVis);
    return () => document.removeEventListener('visibilitychange', handleVis);
  }, []);

  // 2. KEEP stateRef in sync with React state so audio engine math is never stale
  useEffect(() => {
    stateRef.current.queue         = queue;
    stateRef.current.loopMode      = loopMode;
    stateRef.current.shuffle       = isShuffle;
    stateRef.current.currentSongId = currentSong?.id;
    stateRef.current.uname         = uname;
    stateRef.current.roomCode      = roomCode;
    stateRef.current.amHost        = amHost;
    stateRef.current.members       = members;
    stateRef.current.globalVolume  = globalVolume;
    stateRef.current.orbitActive   = orbitActive;
  }, [queue, loopMode, isShuffle, currentSong, uname, roomCode, amHost, members, globalVolume, orbitActive]);

  // 3. BROWSER AUDIO UNLOCK — first user interaction resumes the AudioContext
  useEffect(() => {
    const unlockAudio = () => {
      if (actxRef.current && actxRef.current.state === 'suspended') actxRef.current.resume();
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  // 4. DEVICE HARDWARE CHANGE — reset latency calibration when headphones/speakers swap
  useEffect(() => {
    const handleDeviceChange = () => {
      if (stateRef.current.isCalibrated) {
        toast('Audio hardware changed. Resetting sync...', 'inf');
        stateRef.current.outLat = 0.050;
        stateRef.current.isCalibrated = false;
        if (stateRef.current.localPlayState && audioBufferRef.current) {
          const currentPos = stateRef.current.songOffset + (actxRef.current.currentTime - stateRef.current.nodeStartTime);
          applyPlayState(true, currentPos, sNow(), false);
        }
      }
    };
    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    }
    return () => {
      if (navigator.mediaDevices?.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 5. SLEEP ARMOR — ignore drift math for 3s after OS wakes from sleep
  useEffect(() => {
    const handleVisibilityChange = () => {
      stateRef.current.isTransitioningOS = true;
      clearTimeout(sleepArmorTmr.current);
      sleepArmorTmr.current = setTimeout(() => {
        stateRef.current.isTransitioningOS = false;
      }, 3000);

      if (!document.hidden && socketRef.current && !stateRef.current.amHost) {
        syncClock().then(() => toast('Tab resumed: Re-locking sync...', 'inf'));
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 6. ORBIT 3D SPATIAL AUDIO MATH — runs every animation frame
  useEffect(() => {
    let raf;
    const runOrbitAudio = () => {
      raf = requestAnimationFrame(runOrbitAudio);
      if (stateRef.current.orbitActive && stateRef.current.localPlayState && pannerNodeRef.current && gainNodeRef.current) {
        const total    = stateRef.current.members.length || 1;
        const speedMs  = Math.max(3000, Math.min(10000, 2000 * total));
        const globalTime  = Date.now() + stateRef.current.clockOff;
        const radarAngle  = ((globalTime % speedMs) / speedMs) * Math.PI * 2;

        const myIndex = stateRef.current.members.findIndex(m => m.id === socketRef.current?.id);
        const myAngle = ((myIndex === -1 ? 0 : myIndex) / total) * Math.PI * 2;

        let diff = radarAngle - myAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI)  diff -= Math.PI * 2;

        if (pannerNodeRef.current.pan) pannerNodeRef.current.pan.value = Math.sin(diff);

        const dist   = Math.abs(diff);
        const volDrop = Math.max(0.15, 1.0 - (dist / Math.PI));
        gainNodeRef.current.gain.value = stateRef.current.globalVolume * volDrop;
      } else if (pannerNodeRef.current && gainNodeRef.current) {
        if (pannerNodeRef.current.pan) pannerNodeRef.current.pan.value = 0;
        gainNodeRef.current.gain.value = stateRef.current.globalVolume;
      }
    };
    runOrbitAudio();
    return () => cancelAnimationFrame(raf);
  }, [orbitActive, members]);

  // 7. SESSION RESTORE — re-joins the room on page reload
  useEffect(() => {
    const raw = sessionStorage.getItem('hushpod_session');
    if (raw) {
      const { code, name, isHost: wasHost } = JSON.parse(raw);
      setUname(name);
      setCodeInput(code);
      initSystem()
      .catch(() => {
        sessionStorage.removeItem('hushpod_session');
        setIsSyncing(false);
        toast('Could not reach server. Please rejoin.', 'err');
      })
      .then(() => {
        if (!socketRef.current) return; // initSystem failed, already handled above
        socketRef.current.emit('join-room', { code, name, claimHost: !!wasHost }, (res) => {
          if (res.error) {
            sessionStorage.removeItem('hushpod_session');
            setIsSyncing(false);
            return toast(res.error, 'err');
          }
          setRoomCode(code);
          setMembers(res.members);
          setQueue(res.queue);
          setGuestUploads(res.guestUploads);
          setGlobalVolume(res.globalVolume);
          if (res.orbitActive !== undefined) setOrbitActive(res.orbitActive);

          if (res.currentSong) {
            setCurrentSong({ id: res.currentSong.songId, name: res.currentSong.name });
            guestLoadAndSync(
              SERVER + res.currentSong.streamUrl,
              res.playState,
              true,
              res.currentSong.songId,
              ++loadSessionId.current
            );
          }
          setIsSyncing(false);
          setRoomTab('dj');
          setView('room');
        });
      });
    } else {
      setIsSyncing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 8. QR URL PARSER — reads ?room=XXXXX from the URL when scanned
  useEffect(() => {
    const params     = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    if (roomFromUrl) {
      setCodeInput(roomFromUrl.toUpperCase());
      setView('app-entry');
      toast(`Scanned! Enter your name to join room ${roomFromUrl.toUpperCase()}`, 'ok');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 9. BACKGROUND WEB WORKER — keeps timers alive when the tab is hidden
  useEffect(() => {
    if (location.pathname !== '/room') return;
    const workerBlob = new Blob([`
      let tick1, tick2;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          tick1 = setInterval(() => self.postMessage('heartbeat'), 1000);
          tick2 = setInterval(() => self.postMessage('clocksync'), 20000);
        } else if (e.data === 'stop') {
          clearInterval(tick1); clearInterval(tick2);
        }
      };
    `], { type: 'application/javascript' });

    const worker = new Worker(URL.createObjectURL(workerBlob));
    worker.onmessage = (e) => {
      if (e.data === 'heartbeat') {
        const s = stateRef.current;
        if (s.localPlayState && socketRef.current && s.amHost && audioBufferRef.current) {
          const now   = actxRef.current.currentTime;
          const delta = now - (s.lastHeartbeatTime || now);
          s.lastHeartbeatTime = now;

          if (sourceNodeRef.current?.playbackRate) {
            s.accumulatedRateDrift += delta * (sourceNodeRef.current.playbackRate.value - 1.0);
          }

          const currentAudioPos = Math.max(0, s.songOffset + (now - s.nodeStartTime) + s.accumulatedRateDrift);
          socketRef.current.emit('heartbeat', { currentTime: currentAudioPos });

          // Auto-advance to next song just before the current one ends
          if (currentAudioPos >= audioBufferRef.current.duration - 0.4 && !s.isTransitioning) {
            s.isTransitioning = true;
            playNext(false);
          }
        }
      } else if (e.data === 'clocksync') {
        syncClock();
      }
    };
    worker.postMessage('start');
    return () => { worker.postMessage('stop'); worker.terminate(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // 10. MEDIA SESSION — wires OS lock-screen controls to the engine
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title:  currentSong ? currentSong.name : 'HushPod Party',
      artist: amHost ? 'DJ ' + uname : roomTitle,
      album:  'HushPod Live Session',
      artwork: [{ src: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=512&q=80', sizes: '512x512', type: 'image/jpeg' }],
    });
    navigator.mediaSession.setActionHandler('play',          () => { if (amHost) togglePlay(); });
    navigator.mediaSession.setActionHandler('pause',         () => { if (amHost) togglePlay(); });
    navigator.mediaSession.setActionHandler('nexttrack',     () => { if (amHost) playNext(true); });
    navigator.mediaSession.setActionHandler('previoustrack', () => { if (amHost) playPrev(); });
  }, [currentSong, amHost, uname, roomTitle]);

  // 11. KEYBOARD SHORTCUTS — only active in the room, skipped when typing in an input
  useEffect(() => {
    if (location.pathname !== '/room') return;

    const handler = (e) => {
      // Don't fire if user is typing in an input/textarea
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault(); // prevent page scroll
          if (stateRef.current.amHost) togglePlay();
          break;
        case 'ArrowRight':
          if (stateRef.current.amHost && audioBufferRef.current) {
            e.preventDefault();
            const cur = stateRef.current.songOffset + (actxRef.current.currentTime - stateRef.current.nodeStartTime);
            handleSeek(Math.min(cur + 10, audioBufferRef.current.duration - 0.5));
          }
          break;
        case 'ArrowLeft':
          if (stateRef.current.amHost && audioBufferRef.current) {
            e.preventDefault();
            const cur = stateRef.current.songOffset + (actxRef.current.currentTime - stateRef.current.nodeStartTime);
            handleSeek(Math.max(cur - 10, 0));
          }
          break;
        case 'KeyN':
          if (stateRef.current.amHost) playNext(true);
          break;
        case 'KeyP':
          if (stateRef.current.amHost) playPrev();
          break;
        case 'KeyM':
          // Mute/unmute local volume
          if (gainNodeRef.current) {
            const isMuted = gainNodeRef.current.gain.value === 0;
            gainNodeRef.current.gain.value = isMuted ? stateRef.current.globalVolume : 0;
            toast(isMuted ? '🔊 Unmuted' : '🔇 Muted', 'inf');
          }
          break;
        default: break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, amHost]);


  // ==========================================
  // CORE AUDIO FUNCTIONS
  // ==========================================

  const initSystem = async () => {
    if (!actxRef.current) {
      actxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      stateRef.current.outLat = Math.max(
        0.020,
        Math.min(0.150, actxRef.current.outputLatency || actxRef.current.baseLatency || 0.060)
      );

      gainNodeRef.current   = actxRef.current.createGain();
      pannerNodeRef.current = actxRef.current.createStereoPanner
        ? actxRef.current.createStereoPanner()
        : actxRef.current.createGain();
      analyserRef.current   = actxRef.current.createAnalyser();
      analyserRef.current.fftSize = 128;

      pannerNodeRef.current.connect(analyserRef.current);
      analyserRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(actxRef.current.destination);
    }

    if (actxRef.current.state === 'suspended') actxRef.current.resume();

    // Silent keep-alive audio prevents mobile OS from killing the AudioContext
    if (!keepAliveRef.current) {
      const silentWav = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      keepAliveRef.current = new Audio(silentWav);
      keepAliveRef.current.loop = true;
      keepAliveRef.current.play().catch(() => {});
    }

    await syncClock();

    if (!socketRef.current) {
      socketRef.current = io(window.location.origin, { transports: ['websocket', 'polling'] });
      setupSocketListeners(socketRef.current);
    }

    // FIX: Wait for socket to actually be connected before returning.
    // Previously initSystem() returned immediately after io() — which is async.
    // So confirmTosAndExecute() called emit('create-room') before the socket was
    // ready. Socket.io buffers the emit, but if the server is slow (Render cold
    // start) or unreachable, the callback never fires → isSyncing stuck forever.
    if (!socketRef.current.connected) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Server took too long to respond. Check your connection.'));
        }, 12000);

        socketRef.current.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
        socketRef.current.once('connect_error', (err) => {
          clearTimeout(timeout);
          reject(new Error('Cannot reach server: ' + err.message));
        });
      });
    }

    // Handle reconnection (e.g. brief network dropout after already in a room)
    socketRef.current.off('connect');
    socketRef.current.on('connect', () => {
      const savedUname = stateRef.current.uname;
      const savedCode  = stateRef.current.roomCode;

      if (savedUname && savedCode) {
        socketRef.current.emit('join-room', {
          code:      savedCode,
          name:      savedUname,
          claimHost: stateRef.current.amHost,
        }, (res) => {
          if (!res) return;
          if (res.error) {
            sessionStorage.removeItem('hushpod_session');
            toast('Session expired. Please rejoin.', 'err');
            setIsSyncing(false);
            setView('app-entry');
          } else {
            if (res.members) setMembers(res.members);
            if (res.queue)   setQueue(res.queue);
            if (res.orbitActive !== undefined) setOrbitActive(res.orbitActive);
            toast('Connection restored', 'ok');
          }
        });
      }
    });
  };

  const syncClock = async () => {
    const samples = [];
    for (let i = 0; i < 8; i++) {
      try {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 1000);
        const t1   = performance.now();
        const r    = await fetch(SERVER + '/clocksync', { cache: 'no-store', signal: ctrl.signal });
        const t4   = performance.now();
        clearTimeout(tid);
        const { t } = await r.json();
        if ((t4 - t1) < 150) samples.push({ offset: t + ((t4 - t1) / 2) - Date.now(), rtt: t4 - t1 });
      } catch {}
      await new Promise(res => setTimeout(res, 40));
    }
    if (samples.length > 0) {
      samples.sort((a, b) => a.rtt - b.rtt);
      const offs = samples.slice(0, 3).map(s => s.offset).sort((a, b) => a - b);
      stateRef.current.clockOff = offs[Math.floor(offs.length / 2)];
    }
  };

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) {}
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    stateRef.current.localPlayState = false;
    setIsPlaying(false);
    cancelAnimationFrame(vizRafRef.current);
  };

  const playAudioAt = (songTime, actxTime) => {
    stopAudio();
    if (!audioBufferRef.current) return;

    sourceNodeRef.current        = actxRef.current.createBufferSource();
    sourceNodeRef.current.buffer = audioBufferRef.current;
    sourceNodeRef.current.connect(pannerNodeRef.current);

    sourceNodeRef.current.onended = () => {
      const s = stateRef.current;
      if (
        s.localPlayState &&
        !s.isTransitioning &&
        actxRef.current.currentTime >= s.nodeStartTime + audioBufferRef.current.duration - s.songOffset - 0.1
      ) {
        s.isTransitioning = true;
        playNext(false);
      }
    };

    if (actxRef.current.state === 'suspended') actxRef.current.resume();

    sourceNodeRef.current.start(actxTime, songTime);
    stateRef.current.songOffset     = songTime;
    stateRef.current.nodeStartTime  = actxTime;
    stateRef.current.localPlayState = true;
    setIsPlaying(true);
    drawVisualizer();
  };

  const prefetchQueue = async (q) => {
    if (!actxRef.current) return;
    for (const song of q.slice(0, 2)) {
      if (!trackCacheRef.current[song.id]) {
        try {
          trackCacheRef.current[song.id] = 'fetching';
          const res = await fetch(SERVER + song.streamUrl);
          trackCacheRef.current[song.id] = await actxRef.current.decodeAudioData(await res.arrayBuffer());
        } catch (e) { delete trackCacheRef.current[song.id]; }
      }
    }
  };

  const guestLoadAndSync = async (url, playState, isNewJoiner = false, songId = null, expectedLoadId) => {
    stopAudio();
    try {
      if (songId && trackCacheRef.current[songId] && trackCacheRef.current[songId] !== 'fetching') {
        audioBufferRef.current = trackCacheRef.current[songId];
        if (expectedLoadId !== loadSessionId.current) return;
        setTrackReady(true);
        applyPlayState(playState.playing, playState.currentTime, playState.ts, isNewJoiner);
      } else {
        if (!audioBufferRef.current) setTrackReady(false);
        if (!stateRef.current.amHost) setSyncState({ state: 'syncing', label: 'Buffering next...' });
        if (songId) trackCacheRef.current[songId] = 'fetching';

        const res     = await fetch(url);
        const decoded = await actxRef.current.decodeAudioData(await res.arrayBuffer());

        if (expectedLoadId !== loadSessionId.current) return;

        audioBufferRef.current = decoded;
        if (songId) trackCacheRef.current[songId] = audioBufferRef.current;

        setTrackReady(true);
        applyPlayState(playState.playing, playState.currentTime, playState.ts, isNewJoiner);
      }
    } catch (e) {
      if (expectedLoadId !== loadSessionId.current) return;
      setTrackReady(true);
      if (!stateRef.current.amHost) setSyncState({ state: 'fixing', label: 'Error loading track' });
    }
  };

  const applyPlayState = (playing, currentTime, ts, isNewJoiner = false) => {
    if (!audioBufferRef.current) return;
    const outLat  = stateRef.current.outLat || 0.060;
    const elapsed = (Date.now() + stateRef.current.clockOff - ts) / 1000;

    if (!playing) {
      stopAudio();
      stateRef.current.songOffset = currentTime;
      if (!stateRef.current.amHost) setSyncState({ state: 'synced', label: 'Paused' });
      return;
    }

    stateRef.current.accumulatedRateDrift = 0;
    stateRef.current.lastHeartbeatTime    = actxRef.current.currentTime;
    stateRef.current.isTransitioning      = false;

    let expectedOffset = currentTime + elapsed + outLat;
    const hardwareWarmup = 0.100;
    let startTime = actxRef.current.currentTime + hardwareWarmup;

    if (expectedOffset < 0) {
      startTime      = actxRef.current.currentTime + Math.abs(expectedOffset);
      expectedOffset = 0;
    }

    if (isNewJoiner && !stateRef.current.amHost && expectedOffset > 0) {
      expectedOffset += hardwareWarmup;
      setSyncState({ state: 'synced', label: 'Locked Sync' });
    } else {
      if (!stateRef.current.amHost) setSyncState({ state: 'synced', label: 'Locked Sync' });
    }

    if (expectedOffset >= audioBufferRef.current.duration) { stopAudio(); return; }
    playAudioAt(expectedOffset, startTime);
  };


  // ==========================================
  // SOCKET EVENT LISTENERS
  // ==========================================

  const setupSocketListeners = (sock) => {
    sock.on('song-changed', ({ songId, name, streamUrl, playState }) => {
      const currentLoadId = ++loadSessionId.current;
      stopAudio();
      setCurrentSong({ id: songId, name, duration: 0 });
      guestLoadAndSync(SERVER + streamUrl, playState, !stateRef.current.amHost, songId, currentLoadId);
    });

    sock.on('play-scheduled', ({ currentTime, targetTs }) => {
      if (!stateRef.current.amHost) setSyncState({ state: 'syncing', label: 'Readying...' });
      applyPlayState(true, currentTime, targetTs, false);
    });

    sock.on('playstate', ({ playing, currentTime, ts }) => {
      if (!stateRef.current.amHost) applyPlayState(playing, currentTime, ts, false);
    });

    sock.on('heartbeat', ({ currentTime, ts }) => {
      if (stateRef.current.amHost || !audioBufferRef.current || !stateRef.current.localPlayState) return;
      const outLat = stateRef.current.outLat || 0.050;

      const rawNetworkDelay = (sNow() - ts) / 1000;
      // Discard obviously bad readings (>800ms network delay or negative)
      if (rawNetworkDelay > 0.800 || rawNetworkDelay < -0.100) return;
      const networkDelay = Math.max(0, rawNetworkDelay);

      const trueHostTime = currentTime + networkDelay;
      const now   = actxRef.current.currentTime;
      const delta = now - (stateRef.current.lastHeartbeatTime || now);
      stateRef.current.lastHeartbeatTime = now;

      if (sourceNodeRef.current?.playbackRate) {
        stateRef.current.accumulatedRateDrift += delta * (sourceNodeRef.current.playbackRate.value - 1.0);
      }

      const myActualTime = stateRef.current.songOffset + (now - stateRef.current.nodeStartTime) + stateRef.current.accumulatedRateDrift - outLat;
      const drift    = trueHostTime - myActualTime;
      const absDrift = Math.abs(drift);

      // SLEEP ARMOR: Skip correction while OS is throttling after wake
      if (stateRef.current.isTransitioningOS) return;

      if (absDrift > 0.250) {
        // Hard re-sync — drift too large, must seek
        applyPlayState(true, trueHostTime + outLat, sNow(), false);
      } else if (absDrift > 0.040 && sourceNodeRef.current?.playbackRate) {
        // Soft correction — nudge playback rate slightly
        sourceNodeRef.current.playbackRate.value = drift > 0 ? 1.015 : 0.985;
      } else if (sourceNodeRef.current?.playbackRate) {
        // Back to normal speed — within deadzone
        if (sourceNodeRef.current.playbackRate.value !== 1.0) sourceNodeRef.current.playbackRate.value = 1.0;
      }
    });

    sock.on('queue-updated', ({ queue }) => { setQueue(queue); prefetchQueue(queue); });

    sock.on('chat-msg', ({ name, text }) => {
      setChat(prev => [...prev, { name, text }]);
      if (name !== stateRef.current.uname) toast(`💬 ${name}: ${text}`, 'inf');
    });

    // FIX: Previously, setOrbitActive(s.orbitActive) would set orbit to undefined
    // whenever any setting was changed (guest uploads, volume, etc.) because those
    // events didn't include orbitActive. This silently killed orbit mode mid-session.
    sock.on('settings-updated', (s) => {
      setGuestUploads(s.guestUploads);
      setGlobalVolume(s.globalVolume);
      if (s.orbitActive !== undefined) setOrbitActive(s.orbitActive);
      if (gainNodeRef.current && actxRef.current && !s.orbitActive) {
        gainNodeRef.current.gain.value = s.globalVolume;
      }
    });

    sock.on('member-joined', ({ members }) => { setMembers(members); });

    sock.on('member-left', ({ members, newHostName, hostAway }) => {
      setMembers(members);
      if (hostAway) toast('Host lost connection. Waiting 30s for them to return...', 'inf');
      else if (newHostName) toast(`👑 ${newHostName} is the new Host!`, 'ok');
    });

    // Feature: Typing indicator
    sock.on('typing', ({ name, isTyping }) => {
      setTypingUsers(prev => {
        if (isTyping && !prev.includes(name)) return [...prev, name];
        if (!isTyping) return prev.filter(n => n !== name);
        return prev;
      });
      // Auto-clear after 4s in case stop event is missed
      clearTimeout(typingTimers.current[name]);
      if (isTyping) {
        typingTimers.current[name] = setTimeout(() => {
          setTypingUsers(prev => prev.filter(n => n !== name));
        }, 4000);
      }
    });

    // Feature: Floating emoji reactions
    sock.on('reaction', ({ name, emoji }) => {
      const id = Date.now() + Math.random();
      const x  = 10 + Math.random() * 80; // random horizontal position %
      setReactions(prev => [...prev, { id, emoji, name, x }]);
      // Remove after animation completes (2.5s)
      setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2500);
    });
  };


  // ==========================================
  // ROOM ACTIONS
  // ==========================================

  const attemptCreateRoom = () => {
    if (!uname.trim()) return toast('Enter your name first', 'err');
    setPendingAction('create');
    setTosChecked(false);
    setModals({ ...modals, tos: true });
  };

  const attemptJoinRoom = () => {
    if (!uname.trim() || codeInput.length < 3) return toast('Enter name and code', 'err');
    setPendingAction('join');
    setTosChecked(false);
    setModals({ ...modals, tos: true });
  };

  const confirmTosAndExecute = async () => {
    if (!tosChecked) return;
    setModals({ ...modals, tos: false });

    if (pendingAction === 'create') {
      setIsSyncing(true);
      try {
        await initSystem();
      } catch (err) {
        setIsSyncing(false);
        return toast(err.message || 'Could not connect to server.', 'err');
      }

      // Safety timeout — if server never calls back, unblock the UI after 10s
      const safetyTimer = setTimeout(() => {
        setIsSyncing(false);
        toast('Server did not respond. Try again.', 'err');
      }, 10000);

      socketRef.current.emit('create-room', { name: uname, password: roomPassword.trim() || null }, (res) => {
        clearTimeout(safetyTimer);
        if (!res || res.error) {
          setIsSyncing(false);
          return toast(res?.error || 'Failed to create room.', 'err');
        }
        setRoomCode(res.code);
        setMembers([{ id: socketRef.current.id, name: uname, isHost: true }]);
        sessionStorage.setItem('hushpod_session', JSON.stringify({ code: res.code, name: uname, isHost: true }));
        setIsSyncing(false);
        setRoomTab('dj');
        setView('room');
        window.scrollTo(0, 0);
      });

    } else if (pendingAction === 'join') {
      setIsSyncing(true);
      try {
        await initSystem();
      } catch (err) {
        setIsSyncing(false);
        return toast(err.message || 'Could not connect to server.', 'err');
      }

      const safetyTimer = setTimeout(() => {
        setIsSyncing(false);
        toast('Server did not respond. Try again.', 'err');
      }, 10000);

      socketRef.current.emit('join-room', { code: codeInput, name: uname, claimHost: false, password: roomPassword.trim() || null }, (res) => {
        clearTimeout(safetyTimer);
        if (!res || res.error) {
          setIsSyncing(false);
          return toast(res?.error || 'Failed to join room.', 'err');
        }
        sessionStorage.setItem('hushpod_session', JSON.stringify({ code: codeInput, name: uname, isHost: res.isHost || false }));
        setRoomCode(codeInput);
        setMembers(res.members);
        setQueue(res.queue);
        setGuestUploads(res.guestUploads);
        setGlobalVolume(res.globalVolume);
        if (res.orbitActive !== undefined) setOrbitActive(res.orbitActive);

        if (res.currentSong) {
          setCurrentSong({ id: res.currentSong.songId, name: res.currentSong.name });
          guestLoadAndSync(
            SERVER + res.currentSong.streamUrl,
            res.playState,
            true,
            res.currentSong.songId,
            ++loadSessionId.current
          );
        }
        setIsSyncing(false);
        setRoomTab('dj');
        setView('room');
        window.scrollTo(0, 0);
      });
    }
  };


  // ==========================================
  // CONTROLS & INTERACTION
  // ==========================================

  const toggleLoopMode = () => {
    setLoopMode(prev => prev === 'none' ? 'queue' : prev === 'queue' ? 'song' : 'none');
  };

  const playNext = (isManualClick = false) => {
    // Always read from stateRef to avoid stale closures in web worker callbacks
    if (!stateRef.current.amHost) return;
    const s = stateRef.current;
    const q = s.queue;
    if (q.length === 0) return;

    if (!isManualClick && s.loopMode === 'song') {
      socketRef.current.emit('play-song', { songId: s.currentSongId, autoPlay: true });
      return;
    }

    if (s.shuffle) {
      socketRef.current.emit('play-song', { songId: q[Math.floor(Math.random() * q.length)].id, autoPlay: true });
    } else {
      const idx = q.findIndex(x => x.id === s.currentSongId);
      if (idx !== -1 && idx < q.length - 1) {
        socketRef.current.emit('play-song', { songId: q[idx + 1].id, autoPlay: true });
      } else if (s.loopMode === 'queue' || s.loopMode === 'song') {
        socketRef.current.emit('play-song', { songId: q[0].id, autoPlay: true });
      } else {
        socketRef.current.emit('song-ended', {});
        setCurrentSong(null);
      }
    }
  };

  const playPrev = () => {
    if (!stateRef.current.amHost) return;
    const s = stateRef.current;
    const q = s.queue;
    if (q.length === 0) return;

    const idx = q.findIndex(x => x.id === s.currentSongId);
    if (idx > 0) {
      socketRef.current.emit('play-song', { songId: q[idx - 1].id, autoPlay: true });
    } else {
      socketRef.current.emit('play-song', { songId: q[0].id, autoPlay: true });
    }
  };

  const togglePlay = () => {
    if (!stateRef.current.amHost) return;
    const s   = stateRef.current;
    const cur = s.localPlayState
      ? s.songOffset + (actxRef.current.currentTime - s.nodeStartTime)
      : s.songOffset;

    if (!s.localPlayState) {
      socketRef.current.emit('schedule-play', { currentTime: cur });
    } else {
      socketRef.current.emit('playstate', { playing: false, currentTime: cur, ts: sNow() });
      applyPlayState(false, cur, sNow(), false);
    }
  };

  const seekClick = (e) => {
    if (!stateRef.current.amHost || !audioBufferRef.current) return;
    const r       = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - r.left) / r.width;
    handleSeek(Math.max(0, Math.min(audioBufferRef.current.duration, percent * audioBufferRef.current.duration)));
  };

  const handleSeek = (newTime) => {
    if (!stateRef.current.amHost || !audioBufferRef.current) return;
    socketRef.current.emit('playstate', { playing: stateRef.current.localPlayState, currentTime: newTime, ts: sNow() });
    applyPlayState(stateRef.current.localPlayState, newTime, sNow(), false);
  };

  const drawVisualizer = () => {
    if (!stateRef.current.localPlayState || !analyserRef.current) return;
    vizRafRef.current = requestAnimationFrame(drawVisualizer);

    const cvs = document.getElementById('viz-canvas');
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const W = cvs.width  = cvs.offsetWidth;
    const H = cvs.height = cvs.offsetHeight;

    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    ctx.clearRect(0, 0, W, H);

    const pColor = getComputedStyle(document.body).getPropertyValue('--cyan').trim() || '#4cc9f0';
    const bw = (W / data.length) * 2.5;
    let x = 0;

    for (let i = 0; i < data.length; i++) {
      const bh = (data[i] / 255) * H;
      ctx.fillStyle = pColor;
      ctx.fillRect(x, H - bh, bw, bh);
      x += bw + 1;
    }

    const currentPos = Math.max(
      0,
      Math.min(
        stateRef.current.songOffset + (actxRef.current.currentTime - stateRef.current.nodeStartTime),
        audioBufferRef.current?.duration || 1
      )
    );
    if (progFillRef.current) progFillRef.current.style.width = (currentPos / (audioBufferRef.current?.duration || 1) * 100) + '%';
    if (tCurRef.current)     tCurRef.current.textContent = fmt(currentPos);
  };

  // FIX: toggleMusicalChairs' setTimeout callback now reads stateRef.current.amHost
  // instead of the React-state amHost, preventing the stale closure issue where
  // the timeout fires but amHost is already false (e.g. after host change).
  const toggleMusicalChairs = () => {
    if (!stateRef.current.amHost) return;

    if (musicalChairActive) {
      clearTimeout(musicalChairTimer.current);
      setMusicalChairActive(false);
      if (stateRef.current.localPlayState) togglePlay();
    } else {
      setMusicalChairActive(true);
      if (!stateRef.current.localPlayState) togglePlay();

      const randomTimeMs = Math.floor(Math.random() * 10000) + 5000;
      toast(`Party Roulette started! Stopping in ${(randomTimeMs / 1000).toFixed(1)}s...`, 'inf');

      musicalChairTimer.current = setTimeout(() => {
        if (!stateRef.current.amHost) return; // Safety: only act if still host
        setMusicalChairActive(false);
        if (stateRef.current.localPlayState) togglePlay();
        toast('🛑 MUSIC STOPPED!', 'ok');
      }, randomTimeMs);
    }
  };

  // FIX 1: Guest visualizer — restart the RAF loop whenever isPlaying flips to true.
  // Previously if a guest's tab lost focus (browser throttles RAF), the loop died and
  // they'd see a frozen progress bar + blank waveform for the rest of the session.
  useEffect(() => {
    if (isPlaying && analyserRef.current && actxRef.current) {
      cancelAnimationFrame(vizRafRef.current);
      drawVisualizer();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // FIX 3: Local (personal) volume — never broadcast to server, only adjusts this
  // device's gain node. Works independently from the host's global volume.
  const handleLocalVolume = (e) => {
    const val = parseFloat(e.target.value);
    setLocalVolume(val);
    // Multiply personal volume into the current gain value
    if (gainNodeRef.current && actxRef.current) {
      gainNodeRef.current.gain.value = stateRef.current.globalVolume * val;
    }
  };

  // FIX 4: File type validation before upload
  const ALLOWED_AUDIO = ['audio/mpeg','audio/mp3','audio/wav','audio/flac','audio/aac','audio/ogg','audio/x-m4a','audio/mp4'];
  const ALLOWED_EXT   = ['.mp3','.wav','.flac','.aac','.ogg','.m4a'];

  const uploadSongs = (files) => {
    if (!files || files.length === 0) return;
    if (!stateRef.current.amHost && !guestUploads) return toast('Host has locked uploads', 'err');

    let filesToUpload = Array.from(files);

    // FIX 4: Reject non-audio files with a clear error message
    const invalid = filesToUpload.filter(f => {
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      return !ALLOWED_AUDIO.includes(f.type) && !ALLOWED_EXT.includes(ext);
    });
    if (invalid.length > 0) {
      toast(`❌ ${invalid.map(f => f.name).join(', ')} — only MP3, WAV, FLAC, AAC allowed`, 'err');
      filesToUpload = filesToUpload.filter(f => {
        const ext = '.' + f.name.split('.').pop().toLowerCase();
        return ALLOWED_AUDIO.includes(f.type) || ALLOWED_EXT.includes(ext);
      });
      if (filesToUpload.length === 0) return;
    }

    if (filesToUpload.length > 10) {
      toast('Max 10 files allowed. Slicing list.', 'inf');
      filesToUpload = filesToUpload.slice(0, 10);
    }

    // Warn about large files before uploading
    const large = filesToUpload.filter(f => f.size > 50 * 1024 * 1024);
    if (large.length > 0) toast(`⚠️ Large file detected — upload may take a moment`, 'inf');

    setUploadProgress(1);
    const fd = new FormData();
    filesToUpload.forEach(f => fd.append('songs', f));
    fd.append('uploaderId', socketRef.current.id);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', SERVER + '/upload/' + roomCode);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setUploadProgress(Math.round(e.loaded / e.total * 100));
    };
    xhr.onload = () => {
      setUploadProgress(0);
      if (xhr.status === 403) return toast('Host has locked uploads', 'err');
      if (xhr.status !== 200) return toast('Upload failed — try again', 'err');
      toast(`✅ ${filesToUpload.length} song${filesToUpload.length > 1 ? 's' : ''} added!`, 'ok');
      const fileInput = document.getElementById('q-file');
      if (fileInput) fileInput.value = '';
    };
    xhr.onerror = () => { setUploadProgress(0); toast('Upload failed — check connection', 'err'); };
    xhr.send(fd);
  };

  const handleGlobalVolume = (e) => {
    if (!stateRef.current.amHost) return;
    const val = parseFloat(e.target.value);
    setGlobalVolume(val);
    socketRef.current.emit('set-global-volume', { volume: val });
    if (gainNodeRef.current && actxRef.current && !orbitActive) {
      gainNodeRef.current.gain.value = val;
    }
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    const newQ = [...queue];
    const [moved] = newQ.splice(draggedIdx, 1);
    newQ.splice(index, 0, moved);
    setQueue(newQ);
    socketRef.current.emit('reorder-queue', { newOrder: newQ.map(q => q.id) });
    setDraggedIdx(null);
  };

  const runSonarCalibration = async () => {
    if (!actxRef.current) return toast('Audio not initialized. Play a track first.', 'err');
    toast('Calibrating... Keep the room quiet!', 'inf');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const micSource  = actxRef.current.createMediaStreamSource(stream);
      const micAnalyser = actxRef.current.createAnalyser();
      micSource.connect(micAnalyser);
      const bufferLength = micAnalyser.frequencyBinCount;
      const dataArray    = new Uint8Array(bufferLength);
      const startTime    = performance.now();

      const osc       = actxRef.current.createOscillator();
      const clickGain = actxRef.current.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, actxRef.current.currentTime);
      clickGain.gain.setValueAtTime(0, actxRef.current.currentTime);
      clickGain.gain.linearRampToValueAtTime(1, actxRef.current.currentTime + 0.002);
      clickGain.gain.linearRampToValueAtTime(0, actxRef.current.currentTime + 0.010);
      osc.connect(clickGain);
      clickGain.connect(actxRef.current.destination);
      osc.start();
      osc.stop(actxRef.current.currentTime + 0.02);

      const checkMic = () => {
        micAnalyser.getByteFrequencyData(dataArray);
        let volume = 0;
        for (let i = 0; i < bufferLength; i++) { if (dataArray[i] > volume) volume = dataArray[i]; }

        if (volume > 180) {
          const latencySec = (performance.now() - startTime) / 1000;
          stateRef.current.outLat       = Math.max(0.010, Math.min(0.600, latencySec));
          stateRef.current.isCalibrated = true;
          toast(`Sync Locked: ${(latencySec * 1000).toFixed(0)}ms latency detected`, 'ok');
          stream.getTracks().forEach(t => t.stop());
        } else if (performance.now() - startTime < 2000) {
          requestAnimationFrame(checkMic);
        } else {
          toast('Calibration failed. Turn up volume and try again.', 'err');
          stream.getTracks().forEach(t => t.stop());
        }
      };
      checkMic();
    } catch (err) {
      toast('Microphone access is required for Sonar Calibration.', 'err');
    }
  };


  const sendReaction = (emoji) => {
    if (socketRef.current) socketRef.current.emit('react', { emoji });
  };

  const sendTyping = () => {
    if (socketRef.current && roomCode) socketRef.current.emit('typing');
  };

  // ==========================================
  // EXPORTS
  // ==========================================
  return {
    setView, toastData, modals, setModals, uploadProgress, roomTab, setRoomTab,
    uname, setUname, roomCode, isSyncing, codeInput, setCodeInput, members,
    queue, setQueue, chat, currentSong, syncState, isPlaying, trackReady,
    guestUploads, setGuestUploads, globalVolume, handleGlobalVolume,
    localVolume, handleLocalVolume,
    typingUsers, reactions, sendReaction, sendTyping,
    roomPassword, setRoomPassword,
    orbitActive, loopMode, toggleLoopMode, isShuffle, setIsShuffle,
    draggedIdx, setDraggedIdx, tosChecked, setTosChecked,
    socketRef, actxRef, audioBufferRef, progFillRef, tCurRef,
    stateRef, fmt, seekClick, handleSeek, togglePlay, uploadSongs, handleDrop,
    attemptCreateRoom, attemptJoinRoom, confirmTosAndExecute, runSonarCalibration,
    amHost, roomTitle, playNext, playPrev, musicalChairActive, toggleMusicalChairs,
  };
}