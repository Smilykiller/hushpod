import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';

const SERVER = window.location.port === '3000' ? `http://${window.location.hostname}:5000` : window.location.origin;

export default function useHushPodEngine() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const setView = (viewName) => {
    if (viewName === 'marketing') navigate('/');
    else if (viewName === 'app-entry') navigate('/join');
    else if (viewName === 'room') navigate('/room');
  };

  const [toastData, setToastData] = useState({ msg: '', type: 'inf', visible: false });
  const [modals, setModals] = useState({ qr: false, tos: false });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [roomTab, setRoomTab] = useState('dj'); 

  const [uname, setUname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isSyncing, setIsSyncing] = useState(true);
  
  const [codeInput, setCodeInput] = useState('');
  const [members, setMembers] = useState([]);
  const [queue, setQueue] = useState([]);
  const [chat, setChat] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [syncState, setSyncState] = useState({ state: 'syncing', label: 'Waiting for host...' });
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackReady, setTrackReady] = useState(true);
  
  const [guestUploads, setGuestUploads] = useState(false);
  const [globalVolume, setGlobalVolume] = useState(1.0);
  const [orbitActive, setOrbitActive] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState(null);

  // NEW: 3-State Loop (none, queue, song)
  const [loopMode, setLoopMode] = useState('none');

  const [tosChecked, setTosChecked] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const socketRef = useRef(null);
  const actxRef = useRef(null);
  const audioBufferRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const gainNodeRef = useRef(null);
  const pannerNodeRef = useRef(null);
  const analyserRef = useRef(null);
  const trackCacheRef = useRef({}); 
  
  const loadSessionId = useRef(0);
  
  const stateRef = useRef({ 
    clockOff: 0, songOffset: 0, nodeStartTime: 0, localPlayState: false, amHost: false, 
    queue: [], loopMode: 'none', shuffle: false, currentSongId: null, uname: '', members: [], 
    globalVolume: 1.0, orbitActive: false, accumulatedRateDrift: 0, lastHeartbeatTime: 0, 
    isTransitioning: false 
  });
  
  const progFillRef = useRef(null);
  const tCurRef = useRef(null);
  const chatBoxRef = useRef(null);
  const vizRafRef = useRef(null);
  const toastTmr = useRef(null);

  const toast = (msg, type = 'inf') => {
    setToastData({ msg, type, visible: true });
    clearTimeout(toastTmr.current);
    toastTmr.current = setTimeout(() => setToastData(t => ({ ...t, visible: false })), 3000);
  };

  const myMemberData = members.find(m => m.id === socketRef.current?.id);
  const amHost = myMemberData ? myMemberData.isHost : false;
  const currentHost = members.find(m => m.isHost);
  const roomTitle = currentHost ? `${currentHost.name}'s Party` : 'ROOM';

  useEffect(() => {
    let wakeLock = null;
    const requestWakeLock = async () => {
      try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } 
      catch (err) {}
    };
    requestWakeLock();
    const handleVis = () => { if (document.visibilityState === 'visible') requestWakeLock(); };
    document.addEventListener('visibilitychange', handleVis);
    return () => document.removeEventListener('visibilitychange', handleVis);
  }, []);

  useEffect(() => {
    stateRef.current.queue = queue;
    stateRef.current.loopMode = loopMode; // Updated to 3-state
    stateRef.current.shuffle = isShuffle;
    stateRef.current.currentSongId = currentSong?.id;
    stateRef.current.uname = uname;
    stateRef.current.amHost = amHost;
    stateRef.current.members = members;
    stateRef.current.globalVolume = globalVolume;
    stateRef.current.orbitActive = orbitActive;
  }, [queue, loopMode, isShuffle, currentSong, uname, amHost, members, globalVolume, orbitActive]);

  useEffect(() => {
    const unlockAudio = () => { if (actxRef.current && actxRef.current.state === 'suspended') actxRef.current.resume(); };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    return () => { window.removeEventListener('click', unlockAudio); window.removeEventListener('touchstart', unlockAudio); };
  }, []);

  useEffect(() => {
    const handleDeviceChange = () => {
      if (stateRef.current.isCalibrated) {
        toast("Audio hardware changed. Resetting sync...", "inf");
        stateRef.current.outLat = 0.050;
        stateRef.current.isCalibrated = false; 
        if (stateRef.current.localPlayState && audioBufferRef.current) {
           const currentPos = stateRef.current.songOffset + (actxRef.current.currentTime - stateRef.current.nodeStartTime);
           applyPlayState(true, currentPos, sNow(), false);
        }
      }
    };
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => { if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && socketRef.current && !stateRef.current.amHost) {
        syncClock().then(() => toast("Tab resumed: Re-locking sync...", "inf"));
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    const session = sessionStorage.getItem('hushpod_session');
    if (session) {
      const { code, name } = JSON.parse(session);
      setUname(name); setCodeInput(code);
      initSystem().then(() => {
        socketRef.current.emit('join-room', { code, name, claimHost: false }, (res) => {
          if (res.error) { sessionStorage.removeItem('hushpod_session'); setIsSyncing(false); return toast(res.error, 'err'); }
          setRoomCode(code); setMembers(res.members); setQueue(res.queue);
          setGuestUploads(res.guestUploads); setGlobalVolume(res.globalVolume); setOrbitActive(res.orbitActive || false);
          if(res.currentSong) {
            setCurrentSong({ id: res.currentSong.songId, name: res.currentSong.name });
            guestLoadAndSync(SERVER + res.currentSong.streamUrl, res.playState, true, res.currentSong.songId, ++loadSessionId.current);
          }
          setIsSyncing(false); setRoomTab('dj'); setView('room');
        });
      });
    } else {
      setIsSyncing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    if (roomFromUrl) {
      setCodeInput(roomFromUrl.toUpperCase()); setView('app-entry');
      toast(`Scanned! Enter your name to join room ${roomFromUrl.toUpperCase()}`, 'ok');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (location.pathname !== '/room') return;
    const workerBlob = new Blob([`
      let tick1, tick2;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          tick1 = setInterval(() => self.postMessage('heartbeat'), 1000);
          tick2 = setInterval(() => self.postMessage('clocksync'), 20000);
        } else if (e.data === 'stop') { clearInterval(tick1); clearInterval(tick2); }
      };
    `], { type: 'application/javascript' });

    const worker = new Worker(URL.createObjectURL(workerBlob));
    worker.onmessage = (e) => {
      if (e.data === 'heartbeat') {
        const s = stateRef.current;
        if (s.localPlayState && socketRef.current && s.amHost && audioBufferRef.current) {
          const now = actxRef.current.currentTime;
          const delta = now - (s.lastHeartbeatTime || now);
          s.lastHeartbeatTime = now;
          
          if (sourceNodeRef.current && sourceNodeRef.current.playbackRate) {
              s.accumulatedRateDrift += delta * (sourceNodeRef.current.playbackRate.value - 1.0);
          }

          const currentAudioPos = Math.max(0, s.songOffset + (now - s.nodeStartTime) + s.accumulatedRateDrift);
          socketRef.current.emit('heartbeat', { currentTime: currentAudioPos });

          if (currentAudioPos >= audioBufferRef.current.duration - 0.4 && !s.isTransitioning) {
              s.isTransitioning = true;
              playNext(false); // Natural end of song
          }
        }
      } else if (e.data === 'clocksync') { syncClock(); }
    };
    worker.postMessage('start');
    return () => { worker.postMessage('stop'); worker.terminate(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const initSystem = async () => {
    if (!actxRef.current) {
      actxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      stateRef.current.outLat = Math.max(0.020, Math.min(0.150, actxRef.current.outputLatency || actxRef.current.baseLatency || 0.060));
      gainNodeRef.current = actxRef.current.createGain();
      pannerNodeRef.current = actxRef.current.createStereoPanner ? actxRef.current.createStereoPanner() : actxRef.current.createGain();
      analyserRef.current = actxRef.current.createAnalyser();
      analyserRef.current.fftSize = 128;
      pannerNodeRef.current.connect(analyserRef.current); analyserRef.current.connect(gainNodeRef.current); gainNodeRef.current.connect(actxRef.current.destination);
    }
    if (actxRef.current.state === 'suspended') actxRef.current.resume();
    const silentWav = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    const bgKeepAlive = new Audio(silentWav); bgKeepAlive.loop = true; bgKeepAlive.play().catch(() => {});
    await syncClock();
    if (!socketRef.current) {
      socketRef.current = io(SERVER, { transports: ['websocket', 'polling'] });
      setupSocketListeners(socketRef.current);
      socketRef.current.on('connect', () => {
         if (stateRef.current.uname && roomCode) socketRef.current.emit('join-room', { code: roomCode, name: stateRef.current.uname, claimHost: false }, () => {});
      });
    }
  };

  const syncClock = async () => {
    const samples = [];
    for (let i = 0; i < 8; i++) {
      try {
        const ctrl = new AbortController(); const tid = setTimeout(() => ctrl.abort(), 1000);
        const t1 = performance.now();
        const r = await fetch(SERVER + '/clocksync', { cache: 'no-store', signal: ctrl.signal });
        const t4 = performance.now(); clearTimeout(tid);
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

  const fmt = (s) => { if (!s || isNaN(s)) return '0:00'; return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
  const sNow = () => Date.now() + stateRef.current.clockOff;

  const stopAudio = () => {
    if (sourceNodeRef.current) { try { sourceNodeRef.current.stop(); } catch(e) {} sourceNodeRef.current.disconnect(); sourceNodeRef.current = null; }
    stateRef.current.localPlayState = false; setIsPlaying(false); cancelAnimationFrame(vizRafRef.current);
  };

  const playAudioAt = (songTime, actxTime) => {
    stopAudio(); if (!audioBufferRef.current) return;
    sourceNodeRef.current = actxRef.current.createBufferSource();
    sourceNodeRef.current.buffer = audioBufferRef.current;
    sourceNodeRef.current.connect(pannerNodeRef.current);

    sourceNodeRef.current.onended = () => {
      const s = stateRef.current;
      if (s.localPlayState && !s.isTransitioning && actxRef.current.currentTime >= s.nodeStartTime + audioBufferRef.current.duration - s.songOffset - 0.1) {
        s.isTransitioning = true;
        playNext(false); // Natural end of song
      }
    };
    sourceNodeRef.current.start(actxTime, songTime);
    stateRef.current.songOffset = songTime; stateRef.current.nodeStartTime = actxTime;
    stateRef.current.localPlayState = true; setIsPlaying(true); drawVisualizer();
  };

  const prefetchQueue = async (q) => {
    if (!actxRef.current) return;
    for (const song of q.slice(0, 2)) {
      if (!trackCacheRef.current[song.id]) {
        try {
          trackCacheRef.current[song.id] = 'fetching'; 
          const res = await fetch(SERVER + song.streamUrl);
          trackCacheRef.current[song.id] = await actxRef.current.decodeAudioData(await res.arrayBuffer()); 
        } catch(e) { delete trackCacheRef.current[song.id]; }
      }
    }
  };

  const guestLoadAndSync = async (url, playState, isNewJoiner = false, songId = null, expectedLoadId) => {
    stopAudio(); 
    try {
      if (songId && trackCacheRef.current[songId] && trackCacheRef.current[songId] !== 'fetching') {
        audioBufferRef.current = trackCacheRef.current[songId]; 
        if (expectedLoadId !== loadSessionId.current) return; 
        setTrackReady(true); applyPlayState(playState.playing, playState.currentTime, playState.ts, isNewJoiner);
      } else {
        if (!audioBufferRef.current) setTrackReady(false); 
        
        if (!stateRef.current.amHost) setSyncState({ state: 'syncing', label: 'Buffering next...' });
        if (songId) trackCacheRef.current[songId] = 'fetching';
        
        const res = await fetch(url);
        const decoded = await actxRef.current.decodeAudioData(await res.arrayBuffer());
        
        if (expectedLoadId !== loadSessionId.current) return; 
        
        audioBufferRef.current = decoded;
        if (songId) trackCacheRef.current[songId] = audioBufferRef.current; 
        
        setTrackReady(true); applyPlayState(playState.playing, playState.currentTime, playState.ts, isNewJoiner);
      }
    } catch(e) { 
      if (expectedLoadId !== loadSessionId.current) return;
      setTrackReady(true); if (!stateRef.current.amHost) setSyncState({ state: 'fixing', label: 'Error loading track' }); 
    }
  };

  const applyPlayState = (playing, currentTime, ts, isNewJoiner = false) => {
    if (!audioBufferRef.current) return;
    const outLat = stateRef.current.outLat || 0.060;
    const elapsed = (Date.now() + stateRef.current.clockOff - ts) / 1000;
    
    if (!playing) { 
      stopAudio(); stateRef.current.songOffset = currentTime; 
      if(!stateRef.current.amHost) setSyncState({ state: 'synced', label: 'Paused' });
      return; 
    }

    stateRef.current.accumulatedRateDrift = 0;
    stateRef.current.lastHeartbeatTime = actxRef.current.currentTime;
    stateRef.current.isTransitioning = false;
    
    let expectedOffset = currentTime + elapsed + outLat;
    const hardwareWarmup = 0.100; 
    let startTime = actxRef.current.currentTime + hardwareWarmup;

    if (expectedOffset < 0) { startTime = actxRef.current.currentTime + Math.abs(expectedOffset); expectedOffset = 0; }
    
    if (isNewJoiner && !stateRef.current.amHost && expectedOffset > 0) {
        expectedOffset += hardwareWarmup; 
        setSyncState({ state: 'synced', label: 'Locked Sync' });
    } else {
        if(!stateRef.current.amHost) setSyncState({ state: 'synced', label: 'Locked Sync' });
    }

    if (expectedOffset >= audioBufferRef.current.duration) { stopAudio(); return; }
    playAudioAt(expectedOffset, startTime);
  };

  // --- NEW: Toggle 3-State Loop ---
  const toggleLoopMode = () => {
    setLoopMode(prev => prev === 'none' ? 'queue' : prev === 'queue' ? 'song' : 'none');
  };

  // --- UPDATED: Smart Next / Prev Logic ---
  const playNext = (isManualClick = false) => {
    if (!stateRef.current.amHost) return;
    const s = stateRef.current;
    const q = s.queue;
    if (q.length === 0) return;

    // If the song naturally ended and we are on "Repeat Song", replay it instantly
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
        // We reached the end of the list. If looping is active, go back to song 1
        socketRef.current.emit('play-song', { songId: q[0].id, autoPlay: true });
      } else {
        socketRef.current.emit('song-ended', {}); setCurrentSong(null);
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
    if (!amHost) return;
    const s = stateRef.current;
    let cur = s.localPlayState ? s.songOffset + (actxRef.current.currentTime - s.nodeStartTime) : s.songOffset;
    if (!s.localPlayState) { socketRef.current.emit('schedule-play', { currentTime: cur }); }
    else { socketRef.current.emit('playstate', { playing: false, currentTime: cur, ts: sNow() }); applyPlayState(false, cur, sNow(), false); }
  };

  const seekClick = (e) => {
    if (!amHost || !audioBufferRef.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - r.left) / r.width;
    handleSeek(Math.max(0, Math.min(audioBufferRef.current.duration, percent * audioBufferRef.current.duration)));
  };

  const handleSeek = (newTime) => {
    if (!amHost || !audioBufferRef.current) return;
    socketRef.current.emit('playstate', { playing: stateRef.current.localPlayState, currentTime: newTime, ts: sNow() });
    applyPlayState(stateRef.current.localPlayState, newTime, sNow(), false);
  };

  const drawVisualizer = () => {
    if (!stateRef.current.localPlayState || !analyserRef.current) return;
    vizRafRef.current = requestAnimationFrame(drawVisualizer);
    
    const cvs = document.getElementById('viz-canvas');
    if(!cvs) return; const ctx = cvs.getContext('2d'); if(!ctx) return;
    const W = cvs.width = cvs.offsetWidth; const H = cvs.height = cvs.offsetHeight;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data); ctx.clearRect(0, 0, W, H);
    
    const pColor = getComputedStyle(document.body).getPropertyValue('--cyan').trim() || '#4cc9f0';
    const bw = (W / data.length) * 2.5; let x = 0;
    for(let i=0; i<data.length; i++) {
      const bh = (data[i] / 255) * H;
      ctx.fillStyle = pColor; ctx.fillRect(x, H - bh, bw, bh); x += bw + 1;
    }
    
    let currentPos = Math.max(0, Math.min(stateRef.current.songOffset + (actxRef.current.currentTime - stateRef.current.nodeStartTime), audioBufferRef.current?.duration || 1));
    if (progFillRef.current) progFillRef.current.style.width = (currentPos / (audioBufferRef.current?.duration || 1) * 100) + '%';
    if (tCurRef.current) tCurRef.current.textContent = fmt(currentPos);
  };

  const runSonarCalibration = async () => {
    if (!actxRef.current) return toast("Audio not initialized. Play a track first.", "err");
    toast("Calibrating... Keep the room quiet!", "inf");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const micSource = actxRef.current.createMediaStreamSource(stream);
      const micAnalyser = actxRef.current.createAnalyser();
      micSource.connect(micAnalyser);
      const bufferLength = micAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const startTime = performance.now();
      
      const osc = actxRef.current.createOscillator();
      const clickGain = actxRef.current.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(1200, actxRef.current.currentTime);
      clickGain.gain.setValueAtTime(0, actxRef.current.currentTime);
      clickGain.gain.linearRampToValueAtTime(1, actxRef.current.currentTime + 0.002);
      clickGain.gain.linearRampToValueAtTime(0, actxRef.current.currentTime + 0.010);
      
      osc.connect(clickGain); clickGain.connect(actxRef.current.destination);
      osc.start(); osc.stop(actxRef.current.currentTime + 0.02);

      const checkMic = () => {
        micAnalyser.getByteFrequencyData(dataArray);
        let volume = 0; for (let i = 0; i < bufferLength; i++) if (dataArray[i] > volume) volume = dataArray[i];

        if (volume > 180) { 
          const latencySec = (performance.now() - startTime) / 1000;
          stateRef.current.outLat = Math.max(0.010, Math.min(0.600, latencySec));
          toast(`Sync Locked: ${(latencySec * 1000).toFixed(0)}ms latency detected`, "ok");
          stream.getTracks().forEach(t => t.stop());
        } else if (performance.now() - startTime < 2000) requestAnimationFrame(checkMic);
        else { toast("Calibration failed. Turn up the volume and try again.", "err"); stream.getTracks().forEach(t => t.stop()); }
      };
      checkMic();
    } catch (err) { toast("Microphone access is required for Sonar Calibration.", "err"); }
  };

  const setupSocketListeners = (sock) => {
    sock.on('song-changed', ({ songId, name, streamUrl, playState }) => {
      const currentLoadId = ++loadSessionId.current;
      stopAudio(); 
      setCurrentSong({ id: songId, name, duration: 0 });
      guestLoadAndSync(SERVER + streamUrl, playState, !stateRef.current.amHost, songId, currentLoadId);
    });
    sock.on('play-scheduled', ({ currentTime, targetTs }) => {
      if(!stateRef.current.amHost) setSyncState({ state: 'syncing', label: 'Readying...' });
      applyPlayState(true, currentTime, targetTs, false);
    });
    sock.on('playstate', ({ playing, currentTime, ts }) => { 
      if(!stateRef.current.amHost) applyPlayState(playing, currentTime, ts, false); 
    });
    
    sock.on('heartbeat', ({ currentTime, ts }) => {
      if (stateRef.current.amHost || !audioBufferRef.current || !stateRef.current.localPlayState) return;
      const outLat = stateRef.current.outLat || 0.050; 
      
      const rawNetworkDelay = (sNow() - ts) / 1000;
      if (rawNetworkDelay > 0.800 || rawNetworkDelay < -0.100) return; 
      const networkDelay = Math.max(0, rawNetworkDelay);       
      const trueHostTime = currentTime + networkDelay;

      const now = actxRef.current.currentTime;
      const delta = now - (stateRef.current.lastHeartbeatTime || now);
      stateRef.current.lastHeartbeatTime = now;

      if (sourceNodeRef.current && sourceNodeRef.current.playbackRate) {
          stateRef.current.accumulatedRateDrift += delta * (sourceNodeRef.current.playbackRate.value - 1.0);
      }

      const myActualTime = stateRef.current.songOffset + (now - stateRef.current.nodeStartTime) + stateRef.current.accumulatedRateDrift - outLat;
      const drift = trueHostTime - myActualTime;
      const absDrift = Math.abs(drift);

      if (absDrift > 0.150) applyPlayState(true, trueHostTime + outLat, sNow(), false);
      else if (absDrift > 0.015 && sourceNodeRef.current && sourceNodeRef.current.playbackRate) {
          sourceNodeRef.current.playbackRate.value = drift > 0 ? 1.006 : 0.994;
      } 
      else if (sourceNodeRef.current && sourceNodeRef.current.playbackRate) {
          if (sourceNodeRef.current.playbackRate.value !== 1.0) sourceNodeRef.current.playbackRate.value = 1.0;
      }
    });

    sock.on('queue-updated', ({ queue }) => { setQueue(queue); prefetchQueue(queue); });
    sock.on('chat-msg', ({ name, text }) => { 
      setChat(prev => [...prev, { name, text }]); 
      if (name !== stateRef.current.uname) toast(`💬 ${name}: ${text}`, 'inf'); 
    });
    sock.on('settings-updated', (s) => {
      setGuestUploads(s.guestUploads); setGlobalVolume(s.globalVolume); setOrbitActive(s.orbitActive);
      if (gainNodeRef.current && actxRef.current && !s.orbitActive) gainNodeRef.current.gain.value = s.globalVolume;
    });
    sock.on('member-joined', ({ members }) => { setMembers(members); });
    sock.on('member-left', ({ members }) => { setMembers(members); });
    sock.on('host-left', () => { 
      sessionStorage.removeItem('hushpod_session'); toast('Host ended the room', 'err'); 
      setTimeout(() => window.location.href = '/', 2000); 
    });
  };

  const attemptCreateRoom = () => {
    if (!uname.trim()) return toast('Enter your name first', 'err');
    setPendingAction('create'); setTosChecked(false); setModals({ ...modals, tos: true });
  };

  const attemptJoinRoom = () => {
    if (!uname.trim() || codeInput.length < 3) return toast('Enter name and code', 'err');
    setPendingAction('join'); setTosChecked(false); setModals({ ...modals, tos: true });
  };

  const confirmTosAndExecute = async () => {
    if (!tosChecked) return;
    setModals({ ...modals, tos: false });
    if (pendingAction === 'create') {
      setIsSyncing(true); await initSystem();
      socketRef.current.emit('create-room', { name: uname }, (res) => {
        setRoomCode(res.code); setMembers([{ id: socketRef.current.id, name: uname, isHost: true }]);
        sessionStorage.setItem('hushpod_session', JSON.stringify({ code: res.code, name: uname }));
        setIsSyncing(false); setRoomTab('dj'); setView('room'); window.scrollTo(0,0);
      });
    } 
    else if (pendingAction === 'join') {
      setIsSyncing(true); await initSystem();
      socketRef.current.emit('join-room', { code: codeInput, name: uname, claimHost: false }, (res) => {
        if (res.error) { setIsSyncing(false); return toast(res.error, 'err'); }
        sessionStorage.setItem('hushpod_session', JSON.stringify({ code: codeInput, name: uname }));
        setRoomCode(codeInput); setMembers(res.members); setQueue(res.queue);
        setGuestUploads(res.guestUploads); setGlobalVolume(res.globalVolume); setOrbitActive(res.orbitActive || false);
        if(res.currentSong) {
          setCurrentSong({ id: res.currentSong.songId, name: res.currentSong.name });
          guestLoadAndSync(SERVER + res.currentSong.streamUrl, res.playState, true, res.currentSong.songId, ++loadSessionId.current);
        }
        setIsSyncing(false); setRoomTab('dj'); setView('room'); window.scrollTo(0,0);
      });
    }
  };

  const uploadSongs = (files) => {
    if (!files || files.length === 0) return;
    if (!amHost && !guestUploads) return toast('Host has locked uploads', 'err');
    let filesToUpload = Array.from(files);
    if (filesToUpload.length > 10) { toast('Max 10 files allowed. Slicing list.', 'inf'); filesToUpload = filesToUpload.slice(0, 10); }

    setUploadProgress(1); const fd = new FormData();
    for (let i = 0; i < filesToUpload.length; i++) fd.append('songs', filesToUpload[i]);
    fd.append('uploaderId', socketRef.current.id);
    
    const xhr = new XMLHttpRequest(); xhr.open('POST', SERVER + '/upload/' + roomCode);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onload = () => { 
      setUploadProgress(0); if (xhr.status !== 200) toast('Upload failed', 'err'); 
      const fileInput = document.getElementById('q-file'); if (fileInput) fileInput.value = "";
    };
    xhr.send(fd);
  };

  const handleGlobalVolume = (e) => {
    if(!amHost) return;
    const val = parseFloat(e.target.value);
    setGlobalVolume(val); socketRef.current.emit('set-global-volume', { volume: val });
    if (gainNodeRef.current && actxRef.current && !orbitActive) gainNodeRef.current.gain.value = val;
  };
  
  const handleDrop = (e, index) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    const newQ = [...queue]; const [moved] = newQ.splice(draggedIdx, 1); newQ.splice(index, 0, moved);
    setQueue(newQ); socketRef.current.emit('reorder-queue', { newOrder: newQ.map(q => q.id) }); setDraggedIdx(null);
  };

  return {
    setView, toastData, modals, setModals, uploadProgress, roomTab, setRoomTab,
    uname, setUname, roomCode, isSyncing, codeInput, setCodeInput, members,
    queue, setQueue, chat, currentSong, syncState, isPlaying, trackReady,
    guestUploads, setGuestUploads, globalVolume, handleGlobalVolume, orbitActive,
    loopMode, toggleLoopMode, isShuffle, setIsShuffle, draggedIdx, setDraggedIdx,
    tosChecked, setTosChecked, socketRef, actxRef, audioBufferRef, progFillRef, tCurRef,
    stateRef, fmt, seekClick, handleSeek, togglePlay, uploadSongs, handleDrop,
    attemptCreateRoom, attemptJoinRoom, confirmTosAndExecute, runSonarCalibration,
    amHost, roomTitle, playNext, playPrev
  };
}