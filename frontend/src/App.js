import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import './App.css';

const SERVER = window.location.port === '3000' ? `http://${window.location.hostname}:5000` : window.location.origin;

function App() {
  const [view, setView] = useState('marketing');
  const [openFaq, setOpenFaq] = useState(null);
  const [activeRooms, setActiveRooms] = useState(4); 
  const [toastData, setToastData] = useState({ msg: '', type: 'inf', visible: false });
  const [modals, setModals] = useState({ qr: false, tos: false });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [roomTab, setRoomTab] = useState('dj'); 

  const [uname, setUname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  
  // FIX 1: Loader starts TRUE to cover the initial page load & refresh
  const [isSyncing, setIsSyncing] = useState(true);
  
  const [codeInput, setCodeInput] = useState('');
  const [members, setMembers] = useState([]);
  const [queue, setQueue] = useState([]);
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [currentSong, setCurrentSong] = useState(null);
  const [syncState, setSyncState] = useState({ state: 'syncing', label: 'Waiting for host...' });
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackReady, setTrackReady] = useState(true);
  
  const [guestUploads, setGuestUploads] = useState(false);
  const [globalVolume, setGlobalVolume] = useState(1.0);
  const [orbitActive, setOrbitActive] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState(null);

  const [tosChecked, setTosChecked] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const socketRef = useRef(null);
  const actxRef = useRef(null);
  const audioBufferRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const gainNodeRef = useRef(null);
  const pannerNodeRef = useRef(null);
  const analyserRef = useRef(null);
  const trackCacheRef = useRef({}); // PHASE 2: Stores downloaded songs in RAM
  
  const stateRef = useRef({ clockOff: 0, songOffset: 0, nodeStartTime: 0, localPlayState: false, amHost: false, queue: [], loop: false, shuffle: false, currentSongId: null, uname: '', members: [], globalVolume: 1.0, orbitActive: false });
  
  const progFillRef = useRef(null);
  const tCurRef = useRef(null);
  const chatBoxRef = useRef(null);
  const vizRafRef = useRef(null);
  const orbitRafRef = useRef(null);
  const audioOrbitRaf = useRef(null);
  const toastTmr = useRef(null);

  const toast = (msg, type = 'inf') => {
    setToastData({ msg, type, visible: true });
    clearTimeout(toastTmr.current);
    toastTmr.current = setTimeout(() => setToastData(t => ({ ...t, visible: false })), 3000);
  };

  // Safely find our user in the room list and check if they hold the true Host badge
  const myMemberData = members.find(m => m.id === socketRef.current?.id);
  const amHost = myMemberData ? myMemberData.isHost : false;

  useEffect(() => {
    stateRef.current.queue = queue;
    stateRef.current.loop = isLooping;
    stateRef.current.shuffle = isShuffle;
    stateRef.current.currentSongId = currentSong?.id;
    stateRef.current.uname = uname;
    stateRef.current.amHost = amHost;
    stateRef.current.members = members;
    stateRef.current.globalVolume = globalVolume;
    stateRef.current.orbitActive = orbitActive;
  }, [queue, isLooping, isShuffle, currentSong, uname, amHost, members, globalVolume, orbitActive]);

  // FIX 2: Global Mobile Audio Unlocker - Eliminates deep sync lags on mobile Safari/Chrome
  useEffect(() => {
    const unlockAudio = () => {
      if (actxRef.current && actxRef.current.state === 'suspended') {
        actxRef.current.resume();
      }
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);
  // --- BLUETOOTH / HARDWARE DISCONNECT DETECTOR ---
  useEffect(() => {
    const handleDeviceChange = () => {
      // If the hardware changes and we were previously calibrated...
      if (stateRef.current.isCalibrated) {
        toast("Audio hardware changed. Resetting sync...", "inf");

        // 1. Reset latency back to a fast, built-in speaker default (50ms)
        stateRef.current.outLat = 0.050;
        stateRef.current.isCalibrated = false; // Demand recalibration if they want perfect BT sync again

        // 2. Force an immediate Deep Sync snap
        if (stateRef.current.localPlayState && audioBufferRef.current) {
           const currentPos = stateRef.current.songOffset + (actxRef.current.currentTime - stateRef.current.nodeStartTime);
           // Re-trigger the play state. Because outLat is now 0.050, the math will instantly adjust!
           applyPlayState(true, currentPos, sNow(), false);
        }
      }
    };

    // Listen to the OS for any hardware routing changes
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    }

    return () => {
      if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view === 'marketing') {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
      }, { threshold: 0.12 });
      
      setTimeout(() => {
        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
      }, 100);

      const interval = setInterval(() => {
        setActiveRooms(prev => Math.max(1, prev + (Math.random() > 0.5 ? 1 : -1)));
      }, 7000);

      return () => {
        observer.disconnect();
        clearInterval(interval);
      };
    }
  }, [view]);

  useEffect(() => {
    const session = sessionStorage.getItem('hushpod_session');
    if (session) {
      const { code, name } = JSON.parse(session);
      setUname(name); setCodeInput(code);
      
      initSystem().then(() => {
        socketRef.current.emit('join-room', { code, name, claimHost: false }, (res) => {
          if (res.error) { 
            sessionStorage.removeItem('hushpod_session'); 
            setIsSyncing(false);
            return toast(res.error, 'err'); 
          }

          // FIX 3: 15 Person Limit check on reconnect
          if (res.members && res.members.length > 15) {
             sessionStorage.removeItem('hushpod_session');
             if (socketRef.current) {
                 socketRef.current.disconnect();
                 socketRef.current = null;
             }
             setIsSyncing(false);
             setView('app-entry');
             return toast('Room is full (Max 15)!', 'err');
          }

          setRoomCode(code); setMembers(res.members); setQueue(res.queue);
          setGuestUploads(res.guestUploads); setGlobalVolume(res.globalVolume); setOrbitActive(res.orbitActive || false);
          
          const hostUser = res.members.find(m => m.isHost);
          document.title = `HushPod | ${hostUser ? hostUser.name : 'Room'}'s Party`;

         if(res.currentSong) {
          setCurrentSong({ id: res.currentSong.songId, name: res.currentSong.name });
          guestLoadAndSync(SERVER + res.currentSong.streamUrl, res.playState, true, res.currentSong.songId);
        }
          setIsSyncing(false); // Hide global loader
          setRoomTab('dj'); setView('room');
        });
      });
    } else {
      setIsSyncing(false); // No session, drop the loader instantly
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    if (roomFromUrl) {
      setCodeInput(roomFromUrl.toUpperCase());
      setView('app-entry');
      toast(`Scanned! Enter your name to join room ${roomFromUrl.toUpperCase()}`, 'ok');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    let animId;
    const c = document.getElementById('bgc');
    if (!c) return; 
    const cx = c.getContext('2d');
    let W, H;
    const pts = Array.from({ length: 50 }, () => ({
      x: Math.random() * 2000, y: Math.random() * 2000, r: Math.random() * 1.5 + .5,
      vx: (Math.random() - .5) * .2, vy: (Math.random() - .5) * .2,
      col: ['#f72585', '#4cc9f0', '#06d6a0'][Math.floor(Math.random() * 3)],
      a: Math.random() * .4 + .1
    }));
    function resize() { W = c.width = window.innerWidth; H = c.height = window.innerHeight; }
    resize(); window.addEventListener('resize', resize);
    function draw() {
      cx.clearRect(0, 0, W, H);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, Math.PI * 2); cx.fillStyle = p.col; cx.globalAlpha = p.a; cx.fill();
      });
      cx.globalAlpha = 1; animId = requestAnimationFrame(draw);
    }
    draw();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animId); };
  }, [view]);

  useEffect(() => {
    if (view !== 'marketing') return;
    const handleScroll = () => {
      const nav = document.querySelector('nav');
      if (!nav) return;
      if (window.scrollY > 60) {
        nav.style.background = 'rgba(6,6,15,0.95)';
        nav.style.borderBottomColor = 'rgba(255,255,255,0.1)';
      } else {
        nav.style.background = 'rgba(6,6,15,0.7)';
        nav.style.borderBottomColor = 'var(--border)';
      }
    };
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [view]);
  // --- CONTINUOUS TIMING & SYNC ENGINE ---
  useEffect(() => {
    if (view !== 'room') return;

    // 1. Host continuously broadcasts exact audio position every 1 second
    const heartbeatInterval = setInterval(() => {
      const s = stateRef.current;
      if (s.localPlayState && socketRef.current && s.amHost) {
        socketRef.current.emit('heartbeat', { 
          currentTime: Math.max(0, s.songOffset + (actxRef.current.currentTime - s.nodeStartTime)) 
        });
      }
    }, 1000);

    // 2. ALL devices constantly resync their physical clocks with the server every 20 seconds
    const clockSyncInterval = setInterval(() => {
      syncClock();
    }, 20000);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(clockSyncInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  const initSystem = async () => {
    if (!actxRef.current) {
      actxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      
      // RESTORED: Calculate Physical Speaker/Bluetooth Latency
      stateRef.current.outLat = Math.max(0.020, Math.min(0.150, actxRef.current.outputLatency || actxRef.current.baseLatency || 0.060));
      
      gainNodeRef.current = actxRef.current.createGain();
      pannerNodeRef.current = actxRef.current.createStereoPanner ? actxRef.current.createStereoPanner() : actxRef.current.createGain();
      analyserRef.current = actxRef.current.createAnalyser();
      analyserRef.current.fftSize = 128;
      
      // ORBIT AUDIO ROUTING
      pannerNodeRef.current.connect(analyserRef.current);
      analyserRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(actxRef.current.destination);
    }
    if (actxRef.current.state === 'suspended') actxRef.current.resume();

    const silentWav = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    const bgKeepAlive = new Audio(silentWav);
    bgKeepAlive.loop = true; bgKeepAlive.play().catch(() => {});

    await syncClock();
    if (!socketRef.current) {
      socketRef.current = io(SERVER, { transports: ['websocket', 'polling'] });
      setupSocketListeners(socketRef.current);
      
      // Silent Reconnect logic
      socketRef.current.on('connect', () => {
         if (stateRef.current.uname && roomCode) {
             socketRef.current.emit('join-room', { code: roomCode, name: stateRef.current.uname, claimHost: false }, () => {});
         }
      });
    }
  };

  const syncClock = async () => {
    const samples = [];
    for (let i = 0; i < 8; i++) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 1000);
        const t1 = performance.now();
        const r = await fetch(SERVER + '/clocksync', { cache: 'no-store', signal: ctrl.signal });
        const t4 = performance.now(); 
        clearTimeout(tid);
        const { t } = await r.json(); 
        const rtt = t4 - t1;
        // Restored: Ignore laggy packets, use high-precision performance clock
        if (rtt < 150) samples.push({ offset: t + (rtt / 2) - Date.now(), rtt });
      } catch {}
      await new Promise(res => setTimeout(res, 40)); 
    }
    if (samples.length > 0) {
      samples.sort((a, b) => a.rtt - b.rtt);
      // Restored: Median of top 3 is much safer than Average
      const offs = samples.slice(0, 3).map(s => s.offset).sort((a, b) => a - b);
      stateRef.current.clockOff = offs[Math.floor(offs.length / 2)];
    }
  };

  const fmt = (s) => { if (!s || isNaN(s)) return '0:00'; return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
  const sNow = () => Date.now() + stateRef.current.clockOff;

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch(e) {}
      sourceNodeRef.current.disconnect(); sourceNodeRef.current = null;
    }
    stateRef.current.localPlayState = false; setIsPlaying(false);
    cancelAnimationFrame(vizRafRef.current);
  };

  const playAudioAt = (songTime, actxTime) => {
    stopAudio(); if (!audioBufferRef.current) return;
    sourceNodeRef.current = actxRef.current.createBufferSource();
    sourceNodeRef.current.buffer = audioBufferRef.current;
    
    // Connect to Orbit Spatial Engine
    sourceNodeRef.current.connect(pannerNodeRef.current);

    sourceNodeRef.current.onended = () => {
      const s = stateRef.current;
      if (s.localPlayState && actxRef.current.currentTime >= s.nodeStartTime + audioBufferRef.current.duration - s.songOffset - 0.1) {
        if (s.amHost) {
          const q = s.queue;
          if (q.length > 0) {
            if (s.loop) {
              socketRef.current.emit('play-song', { songId: s.currentSongId, autoPlay: true });
            } else if (s.shuffle) {
              const randomSong = q[Math.floor(Math.random() * q.length)];
              socketRef.current.emit('play-song', { songId: randomSong.id, autoPlay: true });
            } else {
              const idx = q.findIndex(x => x.id === s.currentSongId);
              if (idx !== -1 && idx < q.length - 1) socketRef.current.emit('play-song', { songId: q[idx + 1].id, autoPlay: true });
              else { socketRef.current.emit('song-ended', {}); setCurrentSong(null); }
            }
          } else { socketRef.current.emit('song-ended', {}); setCurrentSong(null); }
        }
      }
    };

    sourceNodeRef.current.start(actxTime, songTime);
    stateRef.current.songOffset = songTime; stateRef.current.nodeStartTime = actxTime;
    stateRef.current.localPlayState = true; setIsPlaying(true); drawVisualizer();
  };

  const prefetchQueue = async (q) => {
    if (!actxRef.current) return;
    for (const song of q) {
      if (!trackCacheRef.current[song.id]) {
        try {
          trackCacheRef.current[song.id] = 'fetching'; // Lock to prevent double download
          const res = await fetch(SERVER + song.streamUrl);
          const arrayBuffer = await res.arrayBuffer();
          const decoded = await actxRef.current.decodeAudioData(arrayBuffer);
          trackCacheRef.current[song.id] = decoded; // Save audio to RAM
        } catch(e) {
          delete trackCacheRef.current[song.id]; // Unlock if failed
        }
      }
    }
  };

  const guestLoadAndSync = async (url, playState, isNewJoiner = false, songId = null) => {
    stopAudio(); audioBufferRef.current = null;
    setTrackReady(false); // LOCK THE PLAYER
    if (!stateRef.current.amHost) setSyncState({ state: 'syncing', label: 'Loading track...' });
    
    try {
      // PHASE 2: Check RAM Cache First!
      if (songId && trackCacheRef.current[songId] && trackCacheRef.current[songId] !== 'fetching') {
        audioBufferRef.current = trackCacheRef.current[songId]; // INSTANT LOAD (0ms)
        setTrackReady(true); // UNLOCK THE PLAYER
        applyPlayState(playState.playing, playState.currentTime, playState.ts, isNewJoiner);
      } else {
        // FALLBACK: Network Fetch
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        audioBufferRef.current = await actxRef.current.decodeAudioData(arrayBuffer);
        if (songId) trackCacheRef.current[songId] = audioBufferRef.current; // Save for later
        setTrackReady(true); // UNLOCK THE PLAYER
        applyPlayState(playState.playing, playState.currentTime, playState.ts, isNewJoiner);
      }
    } catch(e) { 
      setTrackReady(true); // Failsafe unlock
      if (!stateRef.current.amHost) setSyncState({ state: 'fixing', label: 'Error loading track' }); 
    }
  };

  const applyPlayState = (playing, currentTime, ts, isNewJoiner = false) => {
    if (!audioBufferRef.current) return;
    
    // RESTORED: Factor in the hardware output latency so music aligns in the physical air!
    const outLat = stateRef.current.outLat || 0.060;
    const elapsed = (Date.now() + stateRef.current.clockOff - ts) / 1000;
    
    if (!playing) { 
      stopAudio(); stateRef.current.songOffset = currentTime; 
      if(!stateRef.current.amHost) setSyncState({ state: 'synced', label: 'Paused' });
      return; 
    }
    
    // Notice the + outLat added here!
    let expectedOffset = currentTime + elapsed + outLat;
    let startTime = actxRef.current.currentTime + 0.05;

    if (expectedOffset < 0) { startTime = actxRef.current.currentTime + Math.abs(expectedOffset); expectedOffset = 0; }
    
    if (isNewJoiner && !stateRef.current.amHost && expectedOffset > 0) {
        const delay = 3.0; expectedOffset += delay; startTime = actxRef.current.currentTime + delay; 
        setSyncState({ state: 'syncing', label: 'Locking sync... playing in 3s' });
        setTimeout(() => { if(stateRef.current.localPlayState) setSyncState({ state: 'synced', label: 'Locked Sync' }); }, delay * 1000);
    } else {
        if(!stateRef.current.amHost) setSyncState({ state: 'synced', label: 'Locked Sync' });
    }

    if (expectedOffset >= audioBufferRef.current.duration) { stopAudio(); return; }
    playAudioAt(expectedOffset, startTime);
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
    
    const style = getComputedStyle(document.body);
    const pColor = style.getPropertyValue('--cyan').trim() || '#4cc9f0';
    
    const bw = (W / data.length) * 2.5; let x = 0;
    for(let i=0; i<data.length; i++) {
      const bh = (data[i] / 255) * H;
      ctx.fillStyle = pColor; ctx.fillRect(x, H - bh, bw, bh); x += bw + 1;
    }
    
    let currentPos = Math.max(0, Math.min(stateRef.current.songOffset + (actxRef.current.currentTime - stateRef.current.nodeStartTime), audioBufferRef.current?.duration || 1));
    if (progFillRef.current) progFillRef.current.style.width = (currentPos / (audioBufferRef.current?.duration || 1) * 100) + '%';
    if (tCurRef.current) tCurRef.current.textContent = fmt(currentPos);
  };

  // --- ORBIT MODE: DYNAMIC MATH & AUDIO ENGINE ---
  useEffect(() => {
    const runOrbitUI = () => {
      if (roomTab !== 'orbit') return;
      orbitRafRef.current = requestAnimationFrame(runOrbitUI);
      const cvs = document.getElementById('orbit-canvas');
      if(!cvs) return; const ctx = cvs.getContext('2d');
      const W = cvs.width = cvs.offsetWidth; const H = cvs.height = cvs.offsetHeight;
      const cx = W/2, cy = H/2; const radius = Math.min(W, H) * 0.35;
      
      // FIX 5: Dynamic Global Time Radar
      const total = stateRef.current.members.length || 1;
      const speedMs = Math.max(3000, Math.min(10000, 2000 * total)); 
      const globalTime = Date.now() + stateRef.current.clockOff;
      const radarAngle = ((globalTime % speedMs) / speedMs) * Math.PI * 2;

      ctx.fillStyle = 'rgba(10, 10, 20, 0.4)'; ctx.fillRect(0, 0, W, H);
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(76,201,240,0.15)'; ctx.lineWidth = 1; ctx.stroke();

      if (stateRef.current.orbitActive) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(radarAngle);
        ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0, 0, radius * 1.3, 0, Math.PI * 0.3);
        ctx.lineTo(0,0);
        const grad = ctx.createRadialGradient(0,0,0, 0,0,radius*1.3);
        grad.addColorStop(0, 'rgba(247,37,133,0.6)'); grad.addColorStop(1, 'rgba(247,37,133,0)');
        ctx.fillStyle = grad; ctx.fill(); ctx.restore();
      }

      stateRef.current.members.forEach((m, i) => {
        const a = (i / total) * Math.PI * 2;
        const x = cx + Math.cos(a) * radius; const y = cy + Math.sin(a) * radius;
        
        let diff = Math.abs(radarAngle - a);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        const isHit = stateRef.current.orbitActive && diff < 0.6;
        
        ctx.beginPath(); ctx.arc(x, y, isHit ? 14 : 8, 0, Math.PI * 2);
        ctx.fillStyle = m.id === socketRef.current?.id ? '#4cc9f0' : (m.isHost ? '#f72585' : '#7777aa');
        if (isHit) { ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 20; }
        ctx.fill(); ctx.shadowBlur = 0;

        ctx.fillStyle = isHit ? '#fff' : 'var(--sub)'; ctx.font = '11px JetBrains Mono'; ctx.textAlign = 'center';
        ctx.fillText(m.id === socketRef.current?.id ? 'YOU' : m.name, x, y + 25);
      });
    };
    if (roomTab === 'orbit') runOrbitUI();
    return () => cancelAnimationFrame(orbitRafRef.current);
  }, [roomTab]);

  useEffect(() => {
    const updateAudioOrbit = () => {
      audioOrbitRaf.current = requestAnimationFrame(updateAudioOrbit);
      
      if (!stateRef.current.orbitActive || !pannerNodeRef.current || !gainNodeRef.current) {
        if (pannerNodeRef.current && pannerNodeRef.current.pan) pannerNodeRef.current.pan.value = 0;
        if (gainNodeRef.current) gainNodeRef.current.gain.value = stateRef.current.globalVolume;
        return;
      }
      
      const total = stateRef.current.members.length || 1;
      const speedMs = Math.max(3000, Math.min(10000, 2000 * total)); 
      const globalTime = Date.now() + stateRef.current.clockOff;
      const radarAngle = ((globalTime % speedMs) / speedMs) * Math.PI * 2;
      
      const myIdx = stateRef.current.members.findIndex(m => m.id === socketRef.current?.id);
      if (myIdx === -1) return;
      const myAngle = (myIdx / total) * Math.PI * 2;
      
      let diff = Math.abs(radarAngle - myAngle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      
      // FIX 6: Direct Volume Assignment prevents Safari bugs
      const vol = 0.2 + 0.8 * Math.max(0, Math.cos(diff));
      gainNodeRef.current.gain.value = vol * stateRef.current.globalVolume;
      
      if (pannerNodeRef.current.pan) {
          pannerNodeRef.current.pan.value = Math.sin(radarAngle - myAngle);
      }
    };
    updateAudioOrbit();
    return () => cancelAnimationFrame(audioOrbitRaf.current);
  }, []);
  // ----------------------------------------

  const runSonarCalibration = async () => {
    // Ensure AudioContext is running
    if (!actxRef.current) return toast("Audio not initialized. Play a track first.", "err");
    toast("Calibrating... Keep the room quiet!", "inf");

    try {
      // 1. Request RAW microphone access (bypass Apple/Google echo cancellation)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } 
      });
      
      const micSource = actxRef.current.createMediaStreamSource(stream);
      const micAnalyser = actxRef.current.createAnalyser();
      micSource.connect(micAnalyser);

      const bufferLength = micAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const startTime = performance.now();
      
      // 2. Fire the Acoustic Transient (The Sonar Ping)
      const osc = actxRef.current.createOscillator();
      const clickGain = actxRef.current.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, actxRef.current.currentTime);
      
      // Sharp attack and decay to create a "click" not a "beep"
      clickGain.gain.setValueAtTime(0, actxRef.current.currentTime);
      clickGain.gain.linearRampToValueAtTime(1, actxRef.current.currentTime + 0.002);
      clickGain.gain.linearRampToValueAtTime(0, actxRef.current.currentTime + 0.010);
      
      osc.connect(clickGain);
      clickGain.connect(actxRef.current.destination);
      osc.start();
      osc.stop(actxRef.current.currentTime + 0.02);

      // 3. Listen for the Sound Spike in the Air
      const checkMic = () => {
        micAnalyser.getByteFrequencyData(dataArray);
        let volume = 0;
        for (let i = 0; i < bufferLength; i++) if (dataArray[i] > volume) volume = dataArray[i];

        if (volume > 180) { // Threshold for a clear click detection
          const endTime = performance.now();
          const latencySec = (endTime - startTime) / 1000;
          
          // 4. Inject precisely into your sync engine (cap between 10ms and 600ms)
          stateRef.current.outLat = Math.max(0.010, Math.min(0.600, latencySec));
          toast(`Sync Locked: ${(latencySec * 1000).toFixed(0)}ms latency detected`, "ok");
          
          // Kill the mic to save battery and prevent feedback
          stream.getTracks().forEach(t => t.stop());
        } else if (performance.now() - startTime < 2000) {
          // Keep listening for up to 2 seconds
          requestAnimationFrame(checkMic);
        } else {
          toast("Calibration failed. Turn up the volume and try again.", "err");
          stream.getTracks().forEach(t => t.stop());
        }
      };
      
      // Start the listening loop
      checkMic();

    } catch (err) {
      console.error("Mic Error:", err);
      toast("Microphone access is required for Sonar Calibration.", "err");
    }
  };

  const setupSocketListeners = (sock) => {
    sock.on('song-changed', ({ songId, name, streamUrl, playState }) => {
      setCurrentSong({ id: songId, name, duration: 0 });
      document.title = `HushPod | ${name}`;
      guestLoadAndSync(SERVER + streamUrl, playState, !stateRef.current.amHost, songId);
    });

    sock.on('play-scheduled', ({ currentTime, targetTs }) => {
      if(!stateRef.current.amHost) setSyncState({ state: 'syncing', label: 'Readying...' });
      applyPlayState(true, currentTime, targetTs, false);
    });

    sock.on('playstate', ({ playing, currentTime, ts }) => { 
      if(!stateRef.current.amHost) applyPlayState(playing, currentTime, ts, false); 
    });

    sock.on('heartbeat', ({ currentTime, ts }) => {
      if (stateRef.current.amHost || !stateRef.current.localPlayState || !audioBufferRef.current) return;
      
      const outLat = stateRef.current.outLat || 0.060;
      const elapsed = (sNow() - ts) / 1000;
      const expectedTime = currentTime + elapsed + outLat;
      const actualTime = stateRef.current.songOffset + (actxRef.current.currentTime - stateRef.current.nodeStartTime);
      
      const drift = expectedTime - actualTime;
      const absDrift = Math.abs(drift);

      // 1. Hard seek if drift > 150ms (Prevents stadium echo)
      if (absDrift > 0.150) {
          applyPlayState(true, currentTime, ts, false);
      } 
      // 2. Micro-adjust only if drift > 30ms. Cap at 0.4% speed change (Acoustically Invisible!)
      else if (absDrift > 0.030 && sourceNodeRef.current && sourceNodeRef.current.playbackRate) {
          const correction = Math.min(0.004, absDrift * 0.1);
          sourceNodeRef.current.playbackRate.value = drift > 0 ? 1.0 + correction : 1.0 - correction;
      } 
      // 3. Perfect play state
      else if (sourceNodeRef.current && sourceNodeRef.current.playbackRate) {
          sourceNodeRef.current.playbackRate.value = 1.0;
      }
    });

    sock.on('queue-updated', ({ queue }) => { 
      setQueue(queue);
      prefetchQueue(queue); // Phase 2: Start background downloading
    });
    
    sock.on('chat-msg', ({ name, text }) => { 
      setChat(prev => [...prev, { name, text }]); 
      if (name !== stateRef.current.uname) { toast(`💬 ${name}: ${text}`, 'inf'); }
      setTimeout(() => { if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight; }, 10); 
    });
    
    sock.on('settings-updated', (s) => {
      setGuestUploads(s.guestUploads); 
      setGlobalVolume(s.globalVolume);
      setOrbitActive(s.orbitActive);
      if (gainNodeRef.current && actxRef.current && !s.orbitActive) gainNodeRef.current.gain.value = s.globalVolume;
    });

    sock.on('member-joined', ({ members }) => { setMembers(members); });
    sock.on('member-left', ({ members }) => { setMembers(members); });
    sock.on('host-left', () => { 
      sessionStorage.removeItem('hushpod_session');
      toast('Host ended the room', 'err'); 
      setTimeout(() => window.location.reload(), 2000); 
    });
  };

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
      await initSystem();
      socketRef.current.emit('create-room', { name: uname }, (res) => {
        setRoomCode(res.code); 
        setMembers([{ id: socketRef.current.id, name: uname, isHost: true }]);
        sessionStorage.setItem('hushpod_session', JSON.stringify({ code: res.code, name: uname }));
        setIsSyncing(false);
        setRoomTab('dj'); setView('room'); window.scrollTo(0,0);
        document.title = `HushPod | ${uname}'s Party`;
        setInterval(() => {
          const s = stateRef.current;
          if(s.localPlayState && socketRef.current && s.amHost) socketRef.current.emit('heartbeat', { currentTime: Math.max(0, s.songOffset + (actxRef.current.currentTime - s.nodeStartTime)) });
        }, 1000);
      });
    } 
    else if (pendingAction === 'join') {
      setIsSyncing(true);
      await initSystem();
      socketRef.current.emit('join-room', { code: codeInput, name: uname, claimHost: false }, (res) => {
        if (res.error) { setIsSyncing(false); return toast(res.error, 'err'); }
        
        // FIX: Capacity Limit Check on Manual Join
        if (res.members && res.members.length > 15) {
             setIsSyncing(false);
             socketRef.current.disconnect(); socketRef.current = null;
             sessionStorage.removeItem('hushpod_session');
             return toast('Room is full (Max 15 people)!', 'err');
        }

        sessionStorage.setItem('hushpod_session', JSON.stringify({ code: codeInput, name: uname }));
        setRoomCode(codeInput); setMembers(res.members); setQueue(res.queue);
        setGuestUploads(res.guestUploads); setGlobalVolume(res.globalVolume); setOrbitActive(res.orbitActive || false);
        
        const hostUser = res.members.find(m => m.isHost);
        document.title = `HushPod | ${hostUser ? hostUser.name : 'Room'}'s Party`;

        if(res.currentSong) {
          setCurrentSong({ id: res.currentSong.songId, name: res.currentSong.name });
          guestLoadAndSync(SERVER + res.currentSong.streamUrl, res.playState, true);
        }
        setIsSyncing(false);
        setRoomTab('dj'); setView('room'); window.scrollTo(0,0);
      });
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
    const t = Math.max(0, Math.min(audioBufferRef.current.duration, percent * audioBufferRef.current.duration));
    handleSeek(t);
  };

  const uploadSongs = (files) => {
    if (!files || files.length === 0) return;
    if (!amHost && !guestUploads) return toast('Host has locked uploads', 'err');
    
    let filesToUpload = Array.from(files);
    if (filesToUpload.length > 10) {
      toast('Max 10 files allowed. Slicing list.', 'inf');
      filesToUpload = filesToUpload.slice(0, 10);
    }

    setUploadProgress(1); const fd = new FormData();
    for (let i = 0; i < filesToUpload.length; i++) fd.append('songs', filesToUpload[i]);
    fd.append('uploaderId', socketRef.current.id);
    
    const xhr = new XMLHttpRequest(); xhr.open('POST', SERVER + '/upload/' + roomCode);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onload = () => { 
      setUploadProgress(0); 
      if (xhr.status !== 200) toast('Upload failed', 'err'); 
      const fileInput = document.getElementById('q-file');
      if (fileInput) fileInput.value = "";
    };
    xhr.send(fd);
  };

  const handleGlobalVolume = (e) => {
    if(!amHost) return;
    const val = parseFloat(e.target.value);
    setGlobalVolume(val);
    socketRef.current.emit('set-global-volume', { volume: val });
    if (gainNodeRef.current && actxRef.current && !orbitActive) gainNodeRef.current.gain.value = val;
  };

  const handleChat = () => { if (!chatInput.trim()) return; socketRef.current.emit('chat-msg', { text: chatInput.trim() }); setChatInput(''); };
  
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

  const currentHost = members.find(m => m.isHost);
  const roomTitle = currentHost ? `${currentHost.name}'s Party` : 'ROOM';

  return (
    <>
      <canvas id="bgc"></canvas>
      <div className={`toast ${toastData.visible ? 'on' : ''} ${toastData.type}`}>{toastData.msg}</div>
      
      {/* ── THE GLOBAL NEON LOADER ── */}
      {isSyncing && (
        <div className="loader-overlay">
          <div className="eq-container">
            <div className="eq-bar"></div><div className="eq-bar"></div><div className="eq-bar"></div><div className="eq-bar"></div><div className="eq-bar"></div>
          </div>
          <div className="loader-text">Syncing Audio...</div>
        </div>
      )}

      {/* ── VIEWS WRAPPED IN !isSyncing ── */}
      {view === 'marketing' && !isSyncing && (
        <div className="scr on" id="landing" style={{ display: 'block' }}>
          
          <nav>
            <a href="#marketing" className="nav-logo" onClick={e => { e.preventDefault(); window.scrollTo(0,0); }}>HUSHPOD</a>
            <div className="nav-links">
              <a href="#how" onClick={e => { e.preventDefault(); document.getElementById('how')?.scrollIntoView({behavior: 'smooth'}); }}>How it works</a>
              <a href="#features" onClick={e => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({behavior: 'smooth'}); }}>Features</a>
              <a href="#usecases" onClick={e => { e.preventDefault(); document.getElementById('usecases')?.scrollIntoView({behavior: 'smooth'}); }}>Use Cases</a>
              <a href="#tech" onClick={e => { e.preventDefault(); document.getElementById('tech')?.scrollIntoView({behavior: 'smooth'}); }}>Tech</a>
              <a href="#faq" onClick={e => { e.preventDefault(); document.getElementById('faq')?.scrollIntoView({behavior: 'smooth'}); }}>FAQ</a>
            </div>
            <a href="#app" className="nav-cta" onClick={(e) => { e.preventDefault(); setView('app-entry'); window.scrollTo(0,0); }}>Start Listening Free →</a>
          </nav>

          <div className="wrap">
            {/* ══ HERO ══ */}
            <section className="hero">
              <div className="hero-eyebrow"><span></span> Live · Synchronized · Private</div>
              <h1 className="hero-title"><span className="line1">HEAR</span><span className="line2">TOGETHER</span></h1>
              <p className="hero-sub">
                Real-time synchronized audio for groups.<br/>
                <strong>No app. No account. No lag.</strong> Just open, create a room, and everyone hears the same song at the exact same millisecond.
              </p>
              <div className="hero-btns">
                <button className="btn btn-pink btn-sm" onClick={() => { setView('app-entry'); window.scrollTo(0,0); }}>🎉 Create a Room Free</button>
                <a href="#how" className="btn-hero-secondary" onClick={e => { e.preventDefault(); document.getElementById('how')?.scrollIntoView({behavior: 'smooth'}); }}>See How It Works</a>
              </div>

              <div className="hero-proof">
                <div className="proof-item"><div className="proof-num">{activeRooms}</div><div className="proof-label">Active Rooms</div></div>
                <div className="proof-div"></div>
                <div className="proof-item"><div className="proof-num">&lt;100ms</div><div className="proof-label">Sync Precision</div></div>
                <div className="proof-div"></div>
                <div className="proof-item"><div className="proof-num">15</div><div className="proof-label">Listeners Free</div></div>
                <div className="proof-div"></div>
                <div className="proof-item"><div className="proof-num">0</div><div className="proof-label">Data Stored</div></div>
              </div>

              <div className="waveform-demo reveal">
                <div className="wf-header">
                  <div className="wf-title">Live Session</div>
                  <div className="wf-status">4 devices in sync</div>
                </div>
                <div className="wf-bars">
                  {[...Array(38)].map((_, i) => {
                    const h = 6 + Math.random() * 50;
                    const d = 0.3 + Math.random() * 0.7;
                    return <div key={i} className="wf-bar" style={{ '--d': `${d}s`, '--h': `${h}px`, height: `${h}px` }}></div>
                  })}
                </div>
                <div className="wf-devices">
                  <div className="wf-device active"><div className="wf-device-dot"></div>Host · iPhone 15</div>
                  <div className="wf-device active"><div className="wf-device-dot"></div>Priya · Galaxy S24</div>
                  <div className="wf-device active"><div className="wf-device-dot"></div>Arjun · Pixel 8</div>
                  <div className="wf-device active"><div className="wf-device-dot"></div>Meera · OnePlus</div>
                </div>
              </div>
            </section>

            {/* ══ HOW IT WORKS ══ */}
            <section id="how">
              <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
                <div className="section-label">⚡ Three Steps</div>
                <h2 className="section-title">Zero friction.<br/>Instant sync.</h2>
                <p className="section-sub" style={{ margin: '0 auto' }}>No downloads. No sign-up. Works in any browser on any phone.</p>
              </div>
              <div className="steps-grid">
                <div className="step-card reveal"><div className="step-icon">🎙️</div><div className="step-num">01</div><div className="step-title">Create a Room</div><div className="step-desc">Enter your name, tap "Create Party Room". You get a unique 5-character room code instantly. Upload up to 10 songs from your device — MP3, WAV, FLAC, AAC all supported.</div></div>
                <div className="step-card reveal" style={{ transitionDelay: '.1s' }}><div className="step-icon">📲</div><div className="step-num">02</div><div className="step-title">Share the Code</div><div className="step-desc">Send your room code or QR code to friends. They open HushPod in their browser, type the code, and they're in — no installation required. Works on any smartphone.</div></div>
                <div className="step-card reveal" style={{ transitionDelay: '.2s' }}><div className="step-icon">🎧</div><div className="step-num">03</div><div className="step-title">Listen Together</div><div className="step-desc">Everyone hears the same audio at the same millisecond. The host controls play, pause, and the queue. Guests can suggest songs via the chat. Perfect sync, guaranteed.</div></div>
                <div className="step-card reveal" style={{ transitionDelay: '.3s' }}><div className="step-icon">🔄</div><div className="step-num">04</div><div className="step-title">Pass the Aux</div><div className="step-desc">Guests can request host privileges. The current host can pass control with one tap. If the host leaves, the next listener becomes DJ automatically — the party never stops.</div></div>
              </div>
            </section>

            {/* ══ FEATURES ══ */}
            <section id="features" style={{ background: 'linear-gradient(180deg,var(--bg),var(--s1) 50%,var(--bg))' }}>
              <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
                <div className="section-label">✨ Everything Included</div>
                <h2 className="section-title">Built for real<br/>group experiences</h2>
                <p className="section-sub" style={{ margin: '0 auto' }}>Every feature engineered for low latency and high reliability.</p>
              </div>
              <div className="features-grid" style={{ maxWidth: '1100px', margin: '64px auto 0' }}>
                <div className="feat-card reveal"><div className="feat-icon pink">🔴</div><div className="feat-title">Dead Reckoning Sync</div><div className="feat-desc">Between heartbeats, guests mathematically calculate the host's exact position — eliminating drift accumulation between server updates.</div><span className="feat-badge badge-live">Live</span></div>
                <div className="feat-card reveal" style={{ transitionDelay: '.05s' }}><div className="feat-icon cyan">⚡</div><div className="feat-title">Seeked Recalculation</div><div className="feat-desc">After every seek, we wait for the browser's seeked event then recalculate position — eliminating 100–200ms mobile seek latency from the sync equation.</div><span className="feat-badge badge-live">Live</span></div>
                <div className="feat-card reveal" style={{ transitionDelay: '.1s' }}><div className="feat-icon green">🗓️</div><div className="feat-title">Scheduled Playback</div><div className="feat-desc">When a song starts, all devices receive a future server timestamp to begin playback simultaneously — true atomic sync from the very first beat.</div><span className="feat-badge badge-live">Live</span></div>
                <div className="feat-card reveal" style={{ transitionDelay: '.15s' }}><div className="feat-icon yellow">📦</div><div className="feat-title">Batch Upload (10 Songs)</div><div className="feat-desc">Upload your entire setlist at once. Auto-advance plays the next song seamlessly when one ends. Drag and drop supported on desktop.</div><span className="feat-badge badge-live">Live</span></div>
                <div className="feat-card reveal" style={{ transitionDelay: '.2s' }}><div className="feat-icon purple">💬</div><div className="feat-title">Song Suggestions Chat</div><div className="feat-desc">Built-in chat so guests can suggest what to play next. Real-time messages delivered to everyone in the room instantly via WebSocket.</div><span className="feat-badge badge-live">Live</span></div>
                <div className="feat-card reveal" style={{ transitionDelay: '.25s' }}><div className="feat-icon indigo">🔗</div><div className="feat-title">QR Code Sharing</div><div className="feat-desc">One tap generates a QR code for your room. Anyone can scan it to join instantly — no typing required. URL auto-fills the room code on landing.</div><span className="feat-badge badge-live">Live</span></div>
                <div className="feat-card reveal" style={{ transitionDelay: '.3s' }}><div className="feat-icon pink">🌙</div><div className="feat-title">Screen-off Resilience</div><div className="feat-desc">Wake Lock API keeps your screen active. If your screen does turn off, reconnection re-syncs audio to the exact correct position within milliseconds.</div><span className="feat-badge badge-live">Live</span></div>
                <div className="feat-card reveal" style={{ transitionDelay: '.35s' }}><div className="feat-icon cyan">🎤</div><div className="feat-title">Pass the Aux</div><div className="feat-desc">Guests can request host privileges. The host can accept and pass full DJ control. If the host disconnects, the oldest listener auto-promotes.</div><span className="feat-badge badge-live">Live</span></div>
                <div className="feat-card reveal" style={{ transitionDelay: '.4s' }}><div className="feat-icon green">🔒</div><div className="feat-title">Zero Data Retention</div><div className="feat-desc">Audio lives in server RAM only during your session. When the room ends, everything is permanently deleted. No logs. No storage. No accounts needed.</div><span className="feat-badge badge-live">Live</span></div>
                <div className="feat-card reveal" style={{ transitionDelay: '.45s' }}><div className="feat-icon yellow">🔔</div><div className="feat-title">Lock Screen Controls</div><div className="feat-desc">Full Media Session API integration — play, pause, skip, and seek from your lock screen or notification shade. Custom artwork generated per room.</div><span className="feat-badge badge-live">Live</span></div>
                <div className="feat-card reveal" style={{ transitionDelay: '.5s' }}><div className="feat-icon purple">♾️</div><div className="feat-title">Unlimited Listeners</div><div className="feat-desc">Free tier supports 15 listeners per room. Premium tier coming soon with unlimited participants, multiple simultaneous rooms, and lossless quality.</div><span className="feat-badge badge-soon">Coming Soon</span></div>
                <div className="feat-card reveal" style={{ transitionDelay: '.55s' }}><div className="feat-icon indigo">🌐</div><div className="feat-title">Works Anywhere</div><div className="feat-desc">Same WiFi, different cities, across the world — HushPod works wherever your internet reaches. The sync engine handles network variance automatically.</div><span className="feat-badge badge-live">Live</span></div>
              </div>
            </section>

            {/* ══ USE CASES ══ */}
            <section id="usecases">
              <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
                <div className="section-label">🌍 Use Cases</div>
                <h2 className="section-title">Made for every<br/>shared moment</h2>
                <p className="section-sub" style={{ margin: '0 auto' }}>From silent discos to study halls — HushPod makes group audio effortless.</p>
              </div>
              <div className="cases-grid" style={{ maxWidth: '1100px', margin: '64px auto 0' }}>
                <div className="case-card c1 reveal"><div className="case-emoji">🎉</div><div className="case-title">Silent Disco Parties</div><div className="case-desc">Replace expensive FM transmitters with HushPod. Everyone dances to the same beat through their own earphones. No expensive hardware, no frequency clashes.</div></div>
                <div className="case-card c2 reveal" style={{ transitionDelay: '.08s' }}><div className="case-emoji">📚</div><div className="case-title">Synchronized Study</div><div className="case-desc">Study in sync with your friend group. Everyone hears the same lo-fi playlist at the same moment — creates a shared focus atmosphere even across different locations.</div></div>
                <div className="case-card c3 reveal" style={{ transitionDelay: '.16s' }}><div className="case-emoji">🚗</div><div className="case-title">Road Trips</div><div className="case-desc">Everyone in different cars hearing the exact same song at the same time. The convoy moves to one beat. The host controls the vibe for the whole group.</div></div>
                <div className="case-card c4 reveal" style={{ transitionDelay: '.24s' }}><div className="case-emoji">🏋️</div><div className="case-title">Gym Classes</div><div className="case-desc">Fitness instructors can sync workout music to every participant simultaneously. No expensive sound system needed — just HushPod and everyone's earphones.</div></div>
                <div className="case-card c5 reveal" style={{ transitionDelay: '.32s' }}><div className="case-emoji">🎬</div><div className="case-title">Remote Watch Parties</div><div className="case-desc">Sync background music or ambient audio for remote events and virtual gatherings. Everyone feels like they're in the same room even when apart.</div></div>
                <div className="case-card c6 reveal" style={{ transitionDelay: '.4s' }}><div className="case-emoji">🏛️</div><div className="case-title">Audio Tours</div><div className="case-desc">Museums, galleries, and walking tours can sync audio guides to every visitor simultaneously. The guide controls the pace. Everyone hears the same thing.</div></div>
              </div>
            </section>

            {/* ══ TECH ══ */}
            <section id="tech" style={{ background: 'linear-gradient(180deg,var(--bg),var(--s1) 40%,var(--bg))' }}>
              <div className="tech-inner">
                <div className="reveal">
                  <div className="section-label">🔬 Under the Hood</div>
                  <h2 className="section-title">Engineered for precision</h2>
                  <p className="section-sub">Every millisecond matters. Our sync engine is built from first principles to eliminate every source of drift.</p>
                  <div className="tech-list">
                    <div className="tech-item">
                      <div className="tech-item-icon">⏱️</div>
                      <div className="tech-item-text">
                        <strong>Server-stamped timestamps</strong>
                        <span>Every event is stamped with the server's own Date.now() — all guests reference the same clock, eliminating per-device clock offset errors.</span>
                      </div>
                    </div>
                    <div className="tech-item">
                      <div className="tech-item-icon">📐</div>
                      <div className="tech-item-text">
                        <strong>Seeked-event recalculation</strong>
                        <span>After seeking, we wait for the browser's seeked confirmation then recalculate the target — absorbing 100–200ms mobile seek latency.</span>
                      </div>
                    </div>
                    <div className="tech-item">
                      <div className="tech-item-icon">🧭</div>
                      <div className="tech-item-text">
                        <strong>60fps dead reckoning</strong>
                        <span>Between heartbeats, the sync loop calculates the host's exact position mathematically — drift never accumulates between updates.</span>
                      </div>
                    </div>
                    <div className="tech-item">
                      <div className="tech-item-icon">🔇</div>
                      <div className="tech-item-text">
                        <strong>Glitch-free correction</strong>
                        <span>Small drifts are never corrected mid-play. Only catastrophic drift triggers a seek. Smooth audio always wins over perfect numbers.</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="tech-stats reveal" style={{ transitionDelay: '.15s' }}>
                  <div className="stat-box">
                    <div className="stat-val">&lt;100<span className="stat-unit">ms</span></div>
                    <div className="stat-label">Sync precision</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-val">500<span className="stat-unit">ms</span></div>
                    <div className="stat-label">Heartbeat interval</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-val">150<span className="stat-unit">MB</span></div>
                    <div className="stat-label">Max file size</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-val">10<span className="stat-unit"> songs</span></div>
                    <div className="stat-label">Batch upload</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-val">8<span className="stat-unit">x</span></div>
                    <div className="stat-label">Clock sync samples</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-val">0<span className="stat-unit">MB</span></div>
                    <div className="stat-label">Data retained</div>
                  </div>
                </div>
              </div>
            </section>

            {/* ══ FAQ ══ */}
            <section id="faq" style={{ padding: '100px 24px' }}>
              <div style={{ maxWidth: '760px', margin: '0 auto', textAlign: 'center' }}>
                <div className="section-label">❓ FAQ</div>
                <h2 className="section-title">Common questions</h2>
              </div>
              <div className="faq-grid">
                {[
                  { q: "Do guests need to download an app?", a: "No. HushPod works entirely in the browser. Guests simply open the link, enter the room code, and they're synced. No installation, no account, no friction." },
                  { q: "Does everyone need to be on the same WiFi?", a: "No. HushPod works over the internet — different WiFi networks, mobile data, different cities, different countries. The sync engine handles network variance automatically." },
                  { q: "What audio formats are supported?", a: "MP3, WAV, FLAC, AAC and most common audio formats. Files up to 150MB each. You can upload up to 10 songs at a time for a full session setlist." },
                  { q: "Is my music stored on HushPod servers?", a: "Never permanently. Audio is held in server RAM only during your active session. The moment your room ends, everything is deleted. HushPod stores zero bytes of your music." },
                  { q: "Can I use copyrighted music?", a: "You are responsible for any content you upload. HushPod provides synchronization technology only — not music. By accepting our Terms of Service, you confirm you own or have rights to any audio you share. See our Terms for full details." },
                  { q: "What happens if the host leaves?", a: "If the host disconnects, the longest-connected listener automatically becomes the new host. The room stays alive, playback continues, and the party doesn't stop. Hosts also get a 30-second grace period to reconnect." },
                  { q: "How many people can join a room?", a: "Free rooms support up to 15 simultaneous listeners. Premium plans with unlimited listeners are coming soon for larger events, silent discos, and enterprise use cases." }
                ].map((faq, i) => (
                  <div key={i} className={`faq-item reveal ${openFaq === i ? 'open' : ''}`} style={{ transitionDelay: `${i * 0.05}s` }}>
                    <div className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>{faq.q} <span className="faq-arrow">▾</span></div>
                    <div className="faq-a">{faq.a}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* ══ CTA ══ */}
            <section id="cta">
              <div className="cta-glow"></div>
              <div className="reveal" style={{ position: 'relative' }}>
                <div className="section-label" style={{ justifyContent: 'center' }}>🎧 Start Free</div>
                <div className="cta-title"><span>LISTEN</span><br/>TOGETHER<br/><span>NOW</span></div>
                <p className="cta-sub">Create your first room in under 10 seconds. No sign-up. No credit card. Just music, perfectly in sync.</p>
                <button className="btn-hero-primary" style={{ fontSize: '18px', padding: '18px 44px' }} onClick={() => { setView('app-entry'); window.scrollTo(0,0); }}>🎉 Create a Free Room</button>
              </div>
            </section>

            {/* ══ FOOTER ══ */}
            <footer>
              <div className="footer-inner">
                <div className="footer-top">
                  <div className="footer-brand">
                    <a href="#marketing" className="footer-logo" onClick={e => { e.preventDefault(); window.scrollTo(0,0); }}>HUSHPOD</a>
                    <p className="footer-tagline">Synchronized private group audio. Listen together in perfect sync — no app, no account, no lag.</p>
                    <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--sub)' }}>Engineered by <span style={{ color: '#bb86fc', fontWeight: '700' }}>Zentry Hub Pvt Ltd</span></p>
                  </div>
                  <div className="footer-col">
                    <h4>Product</h4>
                    <a href="#app" onClick={(e) => { e.preventDefault(); setView('app-entry'); window.scrollTo(0,0); }}>Launch App</a>
                    <a href="#features" onClick={e => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({behavior: 'smooth'}); }}>Features</a>
                    <a href="#how" onClick={e => { e.preventDefault(); document.getElementById('how')?.scrollIntoView({behavior: 'smooth'}); }}>How It Works</a>
                    <a href="#tech" onClick={e => { e.preventDefault(); document.getElementById('tech')?.scrollIntoView({behavior: 'smooth'}); }}>Technology</a>
                  </div>
                  <div className="footer-col">
                    <h4>Company</h4>
                    <a href="#faq" onClick={e => { e.preventDefault(); document.getElementById('faq')?.scrollIntoView({behavior: 'smooth'}); }}>FAQ</a>
                    <a href="#terms">Terms of Service</a>
                    <a href="mailto:contact@hushpod.app">Contact Us</a>
                  </div>
                </div>
                <div className="footer-bottom">
                  <div className="footer-copy">© 2026 HushPod · Built with ♥ in India</div>
                  <div className="footer-copy" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', color: 'var(--sub)' }}>v2.0.0 · Node.js + Socket.io · Zero data retention</div>
                </div>
              </div>
            </footer>
          </div>
        </div>
      )}

      {view === 'app-entry' && !isSyncing && (
        <div className="scr on" id="app-entry" style={{alignItems:'center', justifyContent:'center', padding:'40px 20px', textAlign:'center', flex:1}}>
          <div style={{width:'100%', maxWidth:'340px', margin:'0 auto 20px auto', textAlign:'left'}}>
            <button className="btn btn-ghost" style={{padding:'8px 16px', borderRadius:'8px', fontSize:'12px', cursor:'pointer', width:'auto'}} onClick={() => {setView('marketing'); window.scrollTo(0,0);}}>← Back to Home</button>
          </div>
          <div className="logo"><div className="logo-title" style={{marginBottom:'-5px', fontSize:'80px'}}>HUSH<br/>POD</div><div className="logo-sub">Listen together Privately</div></div>
          
          <div className="field" style={{maxWidth:'340px', margin:'0 auto'}}><label>Your name</label><input type="text" value={uname} onChange={e => setUname(e.target.value)} placeholder="Enter your name" maxLength="20" /></div>
          
          <div className="btns" style={{maxWidth:'340px', margin:'0 auto'}}>
            <button className="btn btn-pink" onClick={attemptCreateRoom}>Create Party Room</button>
            <div style={{display:'flex', alignItems:'center', gap:'9px', color:'var(--sub)', fontSize:'12px', margin:'10px 0'}}>
              <span style={{flex:1, height:'1px', background:'var(--border)'}}></span>or join one<span style={{flex:1, height:'1px', background:'var(--border)'}}></span>
            </div>
            <div style={{padding:'20px', borderRadius:'18px', border:'1px solid var(--border)', background:'var(--s1)'}}>
              <h3 style={{fontSize:'11px', fontWeight:'600', letterSpacing:'2px', textTransform:'uppercase', color:'var(--sub)', marginBottom:'12px'}}>Room Code</h3>
              <input type="text" value={codeInput} onChange={e => setCodeInput(e.target.value.toUpperCase())} placeholder="ABC12" maxLength="5" style={{textAlign:'center', letterSpacing:'6px', fontFamily:'JetBrains Mono', fontWeight:'bold', marginBottom:'12px'}} />
              <button className="btn btn-cyan" style={{marginBottom:0}} onClick={attemptJoinRoom}>Join Room</button>
            </div>
          </div>
        </div>
      )}

      {/* ── THE RESTORED ROOM VIEW (WITH NEON LOADER & BLUETOOTH NOTE) ── */}
      {/* ── THE COMPLETE ROOM VIEW (ALL 5 TABS RESTORED) ── */}
      {view === 'room' && !isSyncing && (
        <div id="room" className="scr on" style={{ display: 'flex' }}>
          <div className="rhead">
            <div className="rhead-left">
              <div className="rname">{roomTitle}</div>
              <div className="rcode">Code: {roomCode}</div>
            </div>
            <div style={{display:'flex', gap:'8px'}}>
              <button className="btn-ghost btn-sm" onClick={() => setModals({...modals, qr: true})}>Share</button>
              <button className="btn-red btn-sm" onClick={() => { 
                sessionStorage.removeItem('hushpod_session'); 
                if(socketRef.current) socketRef.current.disconnect(); 
                window.location.reload(); 
              }}>Leave</button>
            </div>
          </div>

          <div className="rbody">
            
            {/* --- UPDATED NAVIGATION WITH ALL 5 TABS --- */}
            <div style={{display: 'flex', gap: '6px', marginBottom: '10px', background: 'var(--s1)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border)', overflowX: 'auto', whiteSpace: 'nowrap'}}>
              <button onClick={() => setRoomTab('dj')} style={{flex: 1, padding: '10px 8px', background: roomTab === 'dj' ? 'var(--s2)' : 'transparent', color: roomTab === 'dj' ? 'var(--cyan)' : 'var(--sub)', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px'}}>DJ Desk</button>
              <button onClick={() => setRoomTab('members')} style={{flex: 1, padding: '10px 8px', background: roomTab === 'members' ? 'var(--s2)' : 'transparent', color: roomTab === 'members' ? 'var(--text)' : 'var(--sub)', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px'}}>Listeners</button>
              <button onClick={() => setRoomTab('chat')} style={{flex: 1, padding: '10px 8px', background: roomTab === 'chat' ? 'var(--s2)' : 'transparent', color: roomTab === 'chat' ? 'var(--text)' : 'var(--sub)', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px'}}>Chat</button>
              <button onClick={() => setRoomTab('settings')} style={{flex: 1, padding: '10px 8px', background: roomTab === 'settings' ? 'var(--s2)' : 'transparent', color: roomTab === 'settings' ? 'var(--text)' : 'var(--sub)', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px'}}>Settings</button>
              <button onClick={() => setRoomTab('orbit')} style={{flex: 1, padding: '10px 8px', background: roomTab === 'orbit' ? 'var(--s2)' : 'transparent', color: roomTab === 'orbit' ? 'var(--pink)' : 'var(--sub)', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px'}}>Labs 🧪</button>
            </div>

            {/* --- DJ TAB --- */}
            <div style={{ display: roomTab === 'dj' ? 'block' : 'none' }}>
              <div style={{
                background: 'rgba(247,37,133,0.05)', 
                border: '1px solid rgba(247,37,133,0.2)', 
                borderRadius: '8px', 
                padding: '10px 14px', 
                marginBottom: '15px', 
                fontSize: '12px', 
                color: 'var(--sub)', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px'
              }}>
                <span style={{fontSize: '16px'}}>🔊</span>
                <div style={{flex: 1, lineHeight: '1.4'}}>
                  <strong style={{color: 'var(--text)'}}>Using a Bluetooth speaker?</strong><br/>
                  Bluetooth creates an audio echo. Go to the <span onClick={() => setRoomTab('orbit')} style={{color: 'var(--pink)', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline'}}>Labs 🧪 tab</span> to calibrate this specific device.
                </div>
              </div>

              {(amHost || guestUploads) && !currentSong && (
                <div className="upload-wrap" style={{border:'2px dashed var(--border)', borderRadius:'14px', padding:'26px 18px', textAlign:'center', cursor:'pointer', background:'var(--s2)', position:'relative'}}>
                  <input type="file" accept="audio/*" multiple onChange={e => uploadSongs(e.target.files)} style={{position:'absolute', inset:0, opacity:0, cursor:'pointer', width:'100%', height:'100%'}} />
                  <div style={{fontSize:'32px', marginBottom:'8px'}}>🎧</div><h3 style={{fontSize:'14px', fontWeight:'600', marginBottom:'3px'}}>Add up to 10 songs</h3><p style={{fontSize:'12px', color:'var(--sub)'}}>MP3 WAV FLAC AAC</p>
                </div>
              )}
              
              {uploadProgress > 0 && (
                <div style={{marginTop:'10px'}}><div style={{height:'4px', background:'var(--s3)', borderRadius:'4px', overflow:'hidden', marginBottom:'5px'}}><div style={{height:'100%', background:'linear-gradient(90deg,var(--pink),var(--cyan))', width: `${uploadProgress}%`, transition:'width .15s'}}></div></div><div style={{fontSize:'11px', color:'var(--sub)', fontFamily:"'JetBrains Mono',monospace"}}>Uploading {uploadProgress}%</div></div>
              )}
              
              <div className="card">
                {!currentSong ? (
                  <div style={{textAlign:'center', padding:'28px 16px'}}><div style={{fontSize:'44px', marginBottom:'10px'}}>🎧</div><h3 style={{fontSize:'17px', fontWeight:'700', marginBottom:'5px'}}>No song yet</h3><p style={{fontSize:'13px', color:'var(--sub)'}}>{(amHost||guestUploads) ? 'Upload a song to start!' : 'Waiting for host to add a song'}</p></div>
                ) : (
                  <div>
                    <div style={{fontSize:'20px', fontWeight:'700', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginBottom:'3px'}}>{currentSong.name}</div>
                    <div style={{fontSize:'13px', color:'var(--sub)', fontWeight:'300', marginBottom:'16px'}}>Status: <span style={{color: isPlaying ? 'var(--green)' : 'var(--sub)', fontWeight:'600'}}>{isPlaying ? 'Playing' : 'Paused'}</span></div>
                    
                    <div style={{width:'100%', height:'70px', margin:'15px 0', background:'transparent', borderRadius:'8px', border:'1px solid var(--border)', overflow:'hidden', position: 'relative'}}>
                      {!trackReady && (
                        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 5}}>
                          <div className="eq-container" style={{transform: 'scale(0.5)'}}>
                            <div className="eq-bar"></div><div className="eq-bar"></div><div className="eq-bar"></div><div className="eq-bar"></div><div className="eq-bar"></div>
                          </div>
                          <span style={{fontSize: '11px', color: 'var(--cyan)', marginLeft: '10px', fontWeight: 'bold', letterSpacing: '2px'}}>DECODING AUDIO...</span>
                        </div>
                      )}
                      <canvas id="viz-canvas" style={{width:'100%', height:'100%', display:'block'}}></canvas>
                    </div>

                    <div style={{marginBottom:'14px'}}>
                      <div style={{width:'100%', height:'30px', display:'flex', alignItems:'center', cursor:'pointer', marginBottom:'6px'}} onClick={seekClick}>
                        <div style={{width:'100%', height:'6px', background:'var(--s3)', borderRadius:'5px', overflow:'hidden'}}>
                          <div ref={progFillRef} style={{height:'100%', background:'linear-gradient(90deg,var(--pink),var(--cyan))', width:'0%'}}></div>
                        </div>
                      </div>
                      <div style={{display:'flex', justifyContent:'space-between', fontSize:'11px', color:'var(--sub)', fontFamily:"'JetBrains Mono',monospace"}}><span ref={tCurRef}>0:00</span><span>{audioBufferRef.current ? fmt(audioBufferRef.current.duration) : '0:00'}</span></div>
                    </div>
                    
                    {amHost && (
                      <div style={{display:'flex', justifyContent:'center', alignItems:'center', gap:'15px', marginTop:'10px'}}>
                        <button className="btn-ghost" style={{color: isShuffle ? 'var(--pink)' : 'var(--sub)', borderColor: isShuffle ? 'var(--pink)' : 'var(--border)', width:'40px', height:'40px', borderRadius:'8px', padding:0, fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center', margin:0}} onClick={() => setIsShuffle(!isShuffle)}>🔀</button>
                        <button className="btn-ghost" style={{width:'44px', height:'44px', borderRadius:'50%', padding:0, fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center', margin:0}} onClick={() => handleSeek(stateRef.current.songOffset + (actxRef.current.currentTime - stateRef.current.nodeStartTime) - 10)}>⏮</button>
                        <button className="btn-pink" style={{width:'60px', height:'60px', borderRadius:'50%', padding:0, fontSize:'24px', display:'flex', alignItems:'center', justifyContent:'center', margin:0, opacity: trackReady ? 1 : 0.4, cursor: trackReady ? 'pointer' : 'not-allowed', transition: 'all 0.3s'}} onClick={() => { if (trackReady) togglePlay(); }} disabled={!trackReady}>{isPlaying ? '⏸' : '▶'}</button>
                        <button className="btn-ghost" style={{width:'44px', height:'44px', borderRadius:'50%', padding:0, fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center', margin:0}} onClick={() => handleSeek(stateRef.current.songOffset + (actxRef.current.currentTime - stateRef.current.nodeStartTime) + 10)}>⏭</button>
                        <button className="btn-ghost" style={{color: isLooping ? 'var(--pink)' : 'var(--sub)', borderColor: isLooping ? 'var(--pink)' : 'var(--border)', width:'40px', height:'40px', borderRadius:'8px', padding:0, fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center', margin:0}} onClick={() => setIsLooping(!isLooping)}>🔁</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="card">
                <div className="card-label">Queue {(amHost || guestUploads) && currentSong && <button className="btn-ghost" style={{margin:0, padding: '4px 10px', width:'auto', borderRadius:'6px', fontSize:'11px'}} onClick={() => document.getElementById('q-file')?.click()}>+ Add</button>}</div>
                {(amHost || guestUploads) && <input type="file" id="q-file" style={{display:'none'}} accept="audio/*" multiple onChange={e => uploadSongs(e.target.files)} />}
                <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
                  {queue.length === 0 ? <div style={{fontSize:'13px', color:'var(--sub)', textAlign:'center', padding:'12px 0'}}>No songs queued</div> : queue.map((s, i) => (
                    <div key={s.id} draggable={amHost} onDragStart={() => setDraggedIdx(i)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, i)} style={{background:'var(--s2)', padding:'10px 14px', borderRadius:'12px', fontSize:'14px', display:'flex', justifyContent:'space-between', alignItems:'center', border: currentSong?.id === s.id ? '1px solid var(--pink)' : '1px solid var(--border)', fontWeight:'500', cursor: amHost ? 'grab' : 'default', opacity: draggedIdx === i ? 0.5 : 1}}>
                      {amHost && <span style={{marginRight:'10px', cursor:'grab', color:'var(--sub)'}}>☰</span>}
                      <div style={{flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{s.name}</div>
                      {amHost && currentSong?.id !== s.id && <button className="btn-ghost" style={{fontSize:'12px', color:'var(--cyan)', fontWeight:'600', padding:'4px 10px', borderRadius:'6px', border:'1px solid rgba(76,201,240,.3)', background:'var(--s3)', cursor:'pointer', flexShrink:0, width:'auto', margin:0}} onClick={() => socketRef.current.emit('play-song', { songId: s.id, autoPlay: true })}>Play</button>}
                      {currentSong?.id === s.id && <span style={{fontSize:'11px', color:'var(--cyan)', fontWeight:'bold'}}>NOW</span>}
                      {currentSong?.id !== s.id && !amHost && <button className="btn-ghost" style={{background:'var(--s3)', color:'var(--cyan)', border:'1px solid rgba(76,201,240,.3)', padding:'4px 10px', borderRadius:'6px', cursor:'pointer', fontWeight:'700', fontSize:'11px', width:'auto', margin:0}} onClick={() => socketRef.current.emit('upvote', { songId: s.id })}>▲ {s.upvotes || 0}</button>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* --- LISTENERS TAB --- */}
            <div style={{ display: roomTab === 'members' ? 'block' : 'none' }}>
              <div className="card">
                <div className="card-label">Listeners ({members.length})</div>
                <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
                  {members.map(m => (
                    <div key={m.id} style={{background:'var(--s2)', padding:'10px 14px', borderRadius:'12px', fontSize:'14px', display:'flex', justifyContent:'space-between', alignItems:'center', border:'1px solid var(--border)'}}>
                      <div>
                        <span style={{fontWeight:'600'}}>{m.name}</span> {m.id === socketRef.current?.id && <span style={{fontSize:'11px', color:'var(--sub)', marginLeft:'6px'}}>(You)</span>}
                        {m.isHost && <span style={{fontSize:'11px', color:'var(--pink)', marginLeft:'6px', fontWeight:'bold'}}>HOST</span>}
                        {!m.isHost && stateRef.current.admins?.includes(m.id) && <span style={{fontSize:'11px', color:'var(--cyan)', marginLeft:'6px', fontWeight:'bold'}}>DJ</span>}
                      </div>
                      {amHost && m.id !== socketRef.current?.id && (
                        <div style={{display:'flex', gap:'6px'}}>
                          {!stateRef.current.admins?.includes(m.id) ? 
                            <button className="btn-ghost" style={{padding:'4px 8px', fontSize:'11px', margin:0, width:'auto'}} onClick={() => socketRef.current.emit('make-admin', {targetId: m.id})}>Make DJ</button> :
                            <button className="btn-ghost" style={{padding:'4px 8px', fontSize:'11px', margin:0, width:'auto', color:'var(--yellow)'}} onClick={() => socketRef.current.emit('remove-admin', {targetId: m.id})}>Remove DJ</button>
                          }
                          <button className="btn-red" style={{padding:'4px 8px', fontSize:'11px', margin:0, width:'auto'}} onClick={() => socketRef.current.emit('transfer-host', {targetId: m.id})}>Make Host</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* --- CHAT TAB --- */}
            <div style={{ display: roomTab === 'chat' ? 'block' : 'none' }}>
              <div className="card">
                <div className="card-label">Room Chat</div>
                <div className="chat-wrap" ref={chatBoxRef} style={{height:'300px', maxHeight:'none'}}>
                  {chat.length === 0 ? <div style={{color:'var(--sub)', fontSize:'13px', textAlign:'center', marginTop:'20px'}}>No messages yet</div> : chat.map((c, i) => (
                    <div key={i} style={{marginBottom:'8px'}}>
                      <strong style={{color: c.name === uname ? 'var(--cyan)' : 'var(--pink)'}}>{c.name}: </strong>
                      <span style={{color:'var(--text)'}}>{c.text}</span>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex', gap:'8px', marginTop:'10px'}}>
                  <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChat()} placeholder="Suggest a song..." style={{flex:1, padding:'10px 14px', background:'var(--s2)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--text)', outline:'none'}} />
                  <button className="btn-cyan" style={{width:'auto', margin:0, padding:'0 20px'}} onClick={handleChat}>Send</button>
                </div>
              </div>
            </div>

            {/* --- SETTINGS TAB --- */}
            <div style={{ display: roomTab === 'settings' ? 'block' : 'none' }}>
              <div className="card">
                <div className="card-label">Room Settings</div>
                
                <div style={{background:'var(--s2)', padding:'16px', borderRadius:'12px', border:'1px solid var(--border)', marginBottom:'12px'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
                    <div>
                      <div style={{fontSize:'14px', fontWeight:'600'}}>Guest Uploads</div>
                      <div style={{fontSize:'11px', color:'var(--sub)'}}>Allow listeners to add songs to queue</div>
                    </div>
                    {amHost ? (
                      <label style={{position:'relative', display:'inline-block', width:'44px', height:'24px'}}>
                        <input type="checkbox" checked={guestUploads} onChange={e => { setGuestUploads(e.target.checked); socketRef.current.emit('toggle-guest-uploads', {allowed: e.target.checked}); }} style={{opacity:0, width:0, height:0}} />
                        <span style={{position:'absolute', cursor:'pointer', top:0, left:0, right:0, bottom:0, background: guestUploads ? 'var(--green)' : 'var(--s3)', borderRadius:'24px', transition:'.4s'}}><span style={{position:'absolute', height:'18px', width:'18px', left: guestUploads ? '22px' : '3px', bottom:'3px', background:'white', borderRadius:'50%', transition:'.4s'}}></span></span>
                      </label>
                    ) : (
                      <div style={{fontSize:'12px', fontWeight:'bold', color: guestUploads ? 'var(--green)' : 'var(--pink)'}}>{guestUploads ? 'ENABLED' : 'LOCKED'}</div>
                    )}
                  </div>
                </div>

                <div style={{background:'var(--s2)', padding:'16px', borderRadius:'12px', border:'1px solid var(--border)'}}>
                  <div style={{fontSize:'14px', fontWeight:'600', marginBottom:'4px'}}>Global Volume ({Math.round(globalVolume * 100)}%)</div>
                  <div style={{fontSize:'11px', color:'var(--sub)', marginBottom:'12px'}}>Adjust max volume for everyone</div>
                  <input type="range" min="0" max="1" step="0.05" value={globalVolume} onChange={handleGlobalVolume} disabled={!amHost} style={{width:'100%', accentColor:'var(--cyan)', cursor: amHost ? 'pointer' : 'default'}} />
                </div>
              </div>
            </div>

            {/* --- LABS / ORBIT TAB --- */}
            <div style={{ display: roomTab === 'orbit' ? 'block' : 'none' }}>
              <div className="card" style={{padding: '10px'}}>
                <div style={{marginBottom: '15px', padding: '5px 10px'}}>
                  <div style={{fontSize: '18px', fontWeight: '800', color: 'var(--pink)', letterSpacing: '-0.5px'}}>HushPod Labs</div>
                  <div style={{fontSize: '12px', color: 'var(--sub)', marginTop: '2px'}}>Phase 1: Acoustic Hardware Calibration</div>
                </div>

                <div style={{background: 'var(--s2)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '15px', textAlign: 'center'}}>
                  <div style={{fontSize: '12px', color: 'var(--sub)', marginBottom: '8px', textTransform: 'uppercase'}}>Local Device Latency</div>
                  <div style={{fontSize: '36px', fontWeight: '900', fontFamily: 'monospace', color: 'var(--cyan)', marginBottom: '10px'}}>
                    {stateRef.current.outLat ? (stateRef.current.outLat * 1000).toFixed(0) : 0}<span style={{fontSize: '16px', color: 'var(--sub)', marginLeft: '4px'}}>ms</span>
                  </div>
                  <button className="btn btn-cyan" style={{width: '100%', maxWidth: '200px', margin: '10px auto', padding: '12px', fontSize: '14px', fontWeight: '700', borderRadius: '8px'}} onClick={() => runSonarCalibration()}>🔊 Run Sonar Ping</button>
                  <p style={{fontSize: '11px', color: 'var(--sub)', marginTop: '10px', lineHeight: '1.4'}}>Only run this on the specific device connected to the Bluetooth speaker. Hold the speaker near the microphone to measure the air delay.</p>
                </div>

               <div style={{width: '100%', height: '200px', background: '#05050a', borderRadius: '12px', position: 'relative', overflow: 'hidden', border: '1px solid var(--border)'}}>
                  <canvas id="orbit-canvas" style={{width: '100%', height: '100%', display: 'block'}}></canvas>
                  
                  {/* THE ORBIT ON/OFF BUTTON */}
                  <div style={{position: 'absolute', top: '10px', right: '10px', zIndex: 10}}>
                     {amHost ? (
                        <button 
                          className="btn-ghost" 
                          style={{
                            fontSize: '11px', padding: '6px 12px', width: 'auto', borderRadius: '6px', fontWeight: 'bold', margin: 0,
                            background: orbitActive ? 'rgba(247,37,133,0.15)' : 'rgba(0,0,0,0.6)', 
                            border: orbitActive ? '1px solid var(--pink)' : '1px solid var(--border)', 
                            color: orbitActive ? 'var(--pink)' : 'var(--text)', 
                          }} 
                          onClick={() => socketRef.current.emit('set-orbit', {active: !orbitActive})}
                        >
                          {orbitActive ? 'Orbit: LIVE' : 'Orbit: OFF'}
                        </button>
                     ) : (
                        <div style={{
                          fontSize: '10px', padding: '6px 10px', background: 'rgba(0,0,0,0.6)', 
                          border: '1px solid var(--border)', borderRadius: '6px', 
                          color: orbitActive ? 'var(--pink)' : 'var(--sub)', fontWeight: 'bold'
                        }}>
                          {orbitActive ? 'Orbit: LIVE' : 'Orbit: OFF'}
                        </div>
                     )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {!amHost && view === 'room' && (
        <div style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'11px', color:'var(--sub)', fontFamily:"'JetBrains Mono',monospace", padding:'8px 12px', background:'var(--s2)', borderRadius:'8px', position:'fixed', bottom:'20px', left:'20px', zIndex:100}}>
          <div className={`sync-dot ${syncState.state}`} style={{width:'6px', height:'6px', borderRadius:'50%', background:'var(--green)'}}></div><span>{syncState.label}</span>
        </div>
      )}

      {modals.tos && (
        <div style={{position:'fixed', inset:0, zIndex:3000, background:'rgba(0,0,0,.88)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px'}}>
          <div style={{background:'var(--s1)', border:'1px solid var(--border)', borderRadius:'22px', padding:'30px 24px', maxWidth:'400px', width:'100%', textAlign:'left'}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif", fontSize:'28px', letterSpacing:'2px', background:'linear-gradient(135deg,var(--pink),var(--cyan))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', marginBottom:'2px'}}>HUSHPOD</div>
            <div style={{fontSize:'11px', fontWeight:'600', color:'var(--sub)', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'20px'}}>Terms of Service</div>
            <div style={{marginBottom:'14px'}}>
              <div style={{fontSize:'11px', fontWeight:'700', color:'var(--cyan)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'5px'}}>🎵 Your Content, Your Responsibility</div>
              <div style={{fontSize:'12px', color:'var(--sub)', lineHeight:'1.7'}}>By uploading audio, you confirm you own the content, hold a valid license, or have explicit permission from the copyright holder.</div>
            </div>
            <label style={{display:'flex', alignItems:'flex-start', gap:'10px', margin:'18px 0', padding:'14px', background:'var(--s2)', borderRadius:'12px', border:'1px solid var(--border)', cursor:'pointer'}}>
              <input type="checkbox" checked={tosChecked} onChange={e => setTosChecked(e.target.checked)} style={{marginTop:'2px', accentColor:'var(--cyan)', width:'16px', height:'16px', cursor:'pointer'}} />
              <span style={{fontSize:'12px', color:'var(--text)', lineHeight:'1.6', cursor:'pointer'}}>I confirm I will only upload content I own or have rights to.</span>
            </label>
            <div style={{display:'flex', gap:'10px'}}>
              <button className="btn-ghost" style={{margin:0, padding:'12px', flex:1}} onClick={() => setModals({...modals, tos: false})}>Cancel</button>
              <button className="btn-cyan" style={{margin:0, padding:'12px', flex:1, opacity: tosChecked ? 1 : 0.4}} disabled={!tosChecked} onClick={confirmTosAndExecute}>Accept</button>
            </div>
          </div>
        </div>
      )}

      {modals.qr && (
        <div style={{position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,.88)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px'}}>
          <div style={{background:'var(--s1)', border:'1px solid rgba(255,214,10,.35)', borderRadius:'22px', padding:'30px 24px', maxWidth:'320px', width:'100%', textAlign:'center'}}>
            <h3 style={{color:'#fff', marginBottom:'15px', fontFamily:"'Bebas Neue',sans-serif", letterSpacing:'2px', fontSize:'28px'}}>Scan to Join</h3>
            <div style={{background:'#ffffff', padding:'15px', borderRadius:'10px', display:'inline-block', marginBottom:'15px'}}>
              <QRCodeSVG value={`${window.location.origin}/?room=${roomCode}`} size={180} bgColor="#ffffff" fgColor="#000000" level="L" includeMargin={false} />
            </div>
            <p style={{color:'var(--sub)', fontSize:'13px', marginBottom:'20px'}}>Or use code: <strong style={{color:'var(--pink)', fontSize:'18px', letterSpacing:'2px'}}>{roomCode}</strong></p>
            <button className="btn-ghost" style={{width:'100%', padding:'15px', borderRadius:'12px', fontWeight:'600', cursor:'pointer'}} onClick={() => setModals({...modals, qr: false})}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}

export default App;