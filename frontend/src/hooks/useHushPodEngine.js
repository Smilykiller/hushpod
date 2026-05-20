import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';

// In production (Render): both frontend + backend are same origin → SERVER=""
// In local dev: frontend=:3000, backend=:5000 → set REACT_APP_SERVER_URL=http://localhost:5000
const SERVER = process.env.REACT_APP_SERVER_URL || "";

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * AUDIO ENGINE ARCHITECTURE — v3 (HTMLAudioElement + MediaElementSource)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WHY THE PREVIOUS ENGINE WAS BROKEN:
 *   fetch() → decodeAudioData() → AudioBufferSourceNode
 *   ↳ Must download and decode the ENTIRE file before playback starts.
 *     For a 10MB MP3 this can take 5–15 seconds. This IS the "decoding lag".
 *   ↳ AudioBufferSourceNode has no .currentTime you can read. The engine
 *     computed position as (nodeStartTime + elapsed) which accumulated drift
 *     every time the node was stopped/started. The sync math was wrong.
 *   ↳ Output latency was added as a delay, not subtracted from position,
 *     causing Bluetooth users to always be behind.
 *
 * THE FIX — HTMLAudioElement streaming:
 *   new Audio(url) → createMediaElementSource() → Web Audio graph
 *   ↳ Browser progressive-decodes the stream. 'canplay' fires in <1 second.
 *     Playback starts immediately. No decode bottleneck.
 *   ↳ audio.currentTime is the ground truth position. No accumulated error.
 *   ↳ audio.playbackRate nudges sync without glitching.
 *
 * SYNC MATH (the key insight):
 *   audio.currentTime = what the decoder is at RIGHT NOW
 *   audio.currentTime - outputLatency = what your EARS are hearing
 *
 *   So to sync guest ears to host position P:
 *   → Set audio.currentTime = P + outputLatency
 *   → This means by the time sound exits the hardware, it matches P.
 *
 *   For Bluetooth (outputLatency ≈ 0.16–0.24s):
 *   → The same formula applies — we just have a larger outputLatency value.
 *   → This IS the BT sync fix. No separate correction needed.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export default function useHushPodEngine() {
  const navigate = useNavigate();
  const location = useLocation();

  const setView = (viewName) => {
    if (viewName === 'marketing') navigate('/');
    else if (viewName === 'app-entry') navigate('/join');
    else if (viewName === 'room') navigate('/room');
  };

  // ── STATE ─────────────────────────────────────────────────────────────────
  const [toastData, setToastData]         = useState({ msg: '', type: 'inf', visible: false });
  const [modals, setModals]               = useState({ qr: false, tos: false });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [roomTab, setRoomTab]             = useState('dj');
  const [uname, setUname]                 = useState('');
  const [roomCode, setRoomCode]           = useState('');
  const [isSyncing, setIsSyncing]         = useState(true);
  const [codeInput, setCodeInput]         = useState('');
  const [members, setMembers]             = useState([]);
  const [queue, setQueue]                 = useState([]);
  const [chat, setChat]                   = useState([]);
  const [playHistory, setPlayHistory]     = useState([]);
  const [isOnline, setIsOnline]           = useState(navigator.onLine);
  const [currentSong, setCurrentSong]     = useState(null);
  const [syncState, setSyncState]         = useState({ state: 'syncing', label: 'Waiting for host...' });
  const [isPlaying, setIsPlaying]         = useState(false);
  const [trackReady, setTrackReady]       = useState(false);
  const [guestUploads, setGuestUploads]   = useState(false);
  const [globalVolume, setGlobalVolume]   = useState(1.0);
  const [orbitActive, setOrbitActive]     = useState(false);
  const [isShuffle, setIsShuffle]         = useState(false);
  const [draggedIdx, setDraggedIdx]       = useState(null);
  const [musicalChairActive, setMusicalChairActive] = useState(false);
  const [loopMode, setLoopMode]           = useState('none');
  const [localVolume, setLocalVolume]     = useState(1.0);
  const [reactions, setReactions]         = useState([]);
  const [typingUsers, setTypingUsers]     = useState([]);
  const [roomPassword, setRoomPassword]   = useState('');
  const [hasPassword, setHasPassword]     = useState(false);
  const [btStatus, setBtStatus]           = useState({
    connected: false, deviceName: '', latencyMs: 0, type: 'wired', synced: false,
  });

  // ── REFS ──────────────────────────────────────────────────────────────────
  const socketRef       = useRef(null);
  const actxRef         = useRef(null);
  // NEW: HTMLAudioElement replaces AudioBufferSourceNode
  const audioElRef      = useRef(null);   // the <audio> element
  const mediaSourceRef  = useRef(null);   // createMediaElementSource node
  const gainNodeRef     = useRef(null);
  const pannerNodeRef   = useRef(null);
  const analyserRef     = useRef(null);

  const loadSessionId   = useRef(0);
  const progFillRef     = useRef(null);
  const tCurRef         = useRef(null);
  const vizRafRef       = useRef(null);
  const toastTmr        = useRef(null);
  const musicalChairTimer = useRef(null);
  const keepAliveRef    = useRef(null);
  const sleepArmorTmr   = useRef(null);
  const prevDevicesRef  = useRef([]);
  const typingTimers    = useRef({});
  const driftCorrTmr    = useRef(null);   // rate-nudge reset timer

  // Master stateRef — audio engine reads this to avoid stale closures
  const stateRef = useRef({
    clockOff: 0,
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
    isTransitioning: false,
    isTransitioningOS: false,
    isCalibrated: false,
    outLat: 0.040,     // device output latency in seconds (auto-detected)
    roomCode: '',
    songDuration: 0,
  });

  const [tosChecked, setTosChecked]   = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  // ── HELPERS ───────────────────────────────────────────────────────────────
  const toast = (msg, type = 'inf') => {
    setToastData({ msg, type, visible: true });
    clearTimeout(toastTmr.current);
    toastTmr.current = setTimeout(() => setToastData(t => ({ ...t, visible: false })), 3500);
  };

  const myMemberData = members.find(m => m.id === socketRef.current?.id);
  const amHost       = myMemberData ? myMemberData.isHost : false;
  const currentHost  = members.find(m => m.isHost);
  const roomTitle    = currentHost ? `${currentHost.name}'s Party` : 'ROOM';

  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00';
    return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  };

  // Synced server clock (ms)
  const sNow = () => Date.now() + stateRef.current.clockOff;

  // Total hardware output latency in seconds
  // This is what we ADD to audio.currentTime so ears hear the right position
  const getOutputLat = () => {
    const ctx = actxRef.current;
    if (!ctx) return stateRef.current.outLat;
    // outLat = user-measured (BT profile / sonar) + AudioContext pipeline
    const ctxLat = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
    return Math.max(stateRef.current.outLat, ctxLat);
  };

  // ── KEEP stateRef in sync ─────────────────────────────────────────────────
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

  // ── WAKE LOCK ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let wl = null;
    const req = async () => {
      try { if ('wakeLock' in navigator) wl = await navigator.wakeLock.request('screen'); } catch {}
    };
    req();
    const onVis = () => { if (document.visibilityState === 'visible') req(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // ── BROWSER AUDIO UNLOCK ──────────────────────────────────────────────────
  useEffect(() => {
    const unlock = () => {
      if (actxRef.current?.state === 'suspended') actxRef.current.resume();
      if (audioElRef.current?.paused && stateRef.current.localPlayState) {
        audioElRef.current.play().catch(() => {});
      }
    };
    window.addEventListener('click', unlock);
    window.addEventListener('touchstart', unlock);
    return () => { window.removeEventListener('click', unlock); window.removeEventListener('touchstart', unlock); };
  }, []);

  // ── SLEEP ARMOR ───────────────────────────────────────────────────────────
  useEffect(() => {
    const onVis = () => {
      stateRef.current.isTransitioningOS = true;
      clearTimeout(sleepArmorTmr.current);
      sleepArmorTmr.current = setTimeout(() => { stateRef.current.isTransitioningOS = false; }, 3500);
      if (!document.hidden && socketRef.current && !stateRef.current.amHost) {
        syncClock().then(() => toast('Tab resumed — re-locking sync', 'inf'));
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── BLUETOOTH AUTO-DETECTION ──────────────────────────────────────────────
  useEffect(() => {
    const BT_PATTERNS = [
      'bluetooth','airpod','buds','bose','sony wh','sony wf',
      'jabra','beats','jbl','anker','sennheiser','plantronics',
      'poly','galaxy buds','pixel buds','nothing ear','soundcore',
    ];
    const BT_PROFILES = [
      { p:'airpod',        ms:150 },
      { p:'sony wh',       ms:210 },
      { p:'sony wf',       ms:190 },
      { p:'bose',          ms:200 },
      { p:'jabra',         ms:175 },
      { p:'beats',         ms:165 },
      { p:'buds',          ms:175 },
      { p:'jbl',           ms:215 },
      { p:'sennheiser',    ms:195 },
      { p:'anker',         ms:235 },
      { p:'nothing',       ms:165 },
      { p:'soundcore',     ms:220 },
    ];
    const isBT  = (l) => BT_PATTERNS.some(p => l.toLowerCase().includes(p));
    const btMs  = (l) => (BT_PROFILES.find(p => l.toLowerCase().includes(p.p)) || { ms:200 }).ms;

    const detect = async () => {
      if (!actxRef.current) return;
      setBtStatus(s => ({ ...s, type: 'detecting' }));
      try {
        let stream = null;
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch {}
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (stream) stream.getTracks().forEach(t => t.stop());

        const outputs = devices.filter(d => d.kind === 'audiooutput');
        const prev    = prevDevicesRef.current;

        const newDev     = outputs.filter(d => !prev.some(p => p.deviceId === d.deviceId));
        const removedDev = prev.filter(d => !outputs.some(o => o.deviceId === d.deviceId));
        prevDevicesRef.current = outputs;

        // ── DISCONNECTED ──
        if (removedDev.length > 0 && isBT(removedDev[0].label || '')) {
          // Revert to wired — outLat back to AudioContext base latency only
          const wiredLat = (actxRef.current.outputLatency || actxRef.current.baseLatency || 0.040);
          stateRef.current.outLat = wiredLat;
          stateRef.current.isCalibrated = false;
          setBtStatus({ connected:false, deviceName:'', latencyMs: Math.round(wiredLat*1000), type:'wired', synced:true });
          toast('🔌 Bluetooth disconnected — synced to wired', 'inf');
          // Re-sync immediately with correct latency
          if (stateRef.current.localPlayState && audioElRef.current) {
            const pos = audioElRef.current.currentTime - wiredLat;
            audioElRef.current.currentTime = Math.max(0, pos + wiredLat);
          }
          return;
        }

        // ── CONNECTED ──
        const target = (newDev[0] || outputs.find(d => d.deviceId === 'default') || outputs[0]);
        if (!target) { setBtStatus(s => ({ ...s, type:'wired', synced:false })); return; }

        const label = target.label || '';
        if (isBT(label)) {
          // BT latency = codec profile. outLat stores this.
          // getOutputLat() will add AudioContext pipeline on top.
          const codecMs = btMs(label);
          const name = label.replace(/\s*\(.*?\)\s*/g,'').trim() || 'Bluetooth Device';
          stateRef.current.outLat = codecMs / 1000;
          stateRef.current.isCalibrated = true;
          setBtStatus({ connected:true, deviceName:name, latencyMs:codecMs, type:'bluetooth', synced:true });
          toast(`🎧 ${name} — ${codecMs}ms BT sync applied`, 'ok');
          // Immediately re-position audio with new latency
          if (stateRef.current.localPlayState && audioElRef.current) {
            const el = audioElRef.current;
            el.currentTime = Math.max(0, el.currentTime - stateRef.current.outLat + codecMs/1000);
          }
        } else {
          const wiredLat = (actxRef.current.outputLatency || actxRef.current.baseLatency || 0.040);
          const name = label.replace(/\s*\(.*?\)\s*/g,'').trim() || 'Built-in Output';
          stateRef.current.outLat = wiredLat;
          setBtStatus({ connected:false, deviceName:name, latencyMs:Math.round(wiredLat*1000), type:'wired', synced:true });
          toast(`🔌 ${name} — ${Math.round(wiredLat*1000)}ms wired sync`, 'ok');
        }
      } catch (err) {
        console.warn('[BT Detect]', err);
        setBtStatus(s => ({ ...s, type:'wired', synced:false }));
      }
    };

    if (navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => { prevDevicesRef.current = devices.filter(d => d.kind === 'audiooutput'); })
        .then(() => detect()).catch(() => {});
    }
    if (navigator.mediaDevices?.addEventListener) navigator.mediaDevices.addEventListener('devicechange', detect);
    return () => { if (navigator.mediaDevices?.removeEventListener) navigator.mediaDevices.removeEventListener('devicechange', detect); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ORBIT 3D SPATIAL AUDIO ────────────────────────────────────────────────
  useEffect(() => {
    let raf;
    const run = () => {
      raf = requestAnimationFrame(run);
      if (!gainNodeRef.current || !pannerNodeRef.current) return;
      if (stateRef.current.orbitActive && stateRef.current.localPlayState) {
        const total = stateRef.current.members.length || 1;
        const speed = Math.max(3000, Math.min(10000, 2000 * total));
        const angle = ((sNow() % speed) / speed) * Math.PI * 2;
        const myIdx = stateRef.current.members.findIndex(m => m.id === socketRef.current?.id);
        const myAng = ((myIdx < 0 ? 0 : myIdx) / total) * Math.PI * 2;
        let diff = angle - myAng;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI)  diff -= Math.PI * 2;
        if (pannerNodeRef.current.pan) pannerNodeRef.current.pan.value = Math.sin(diff);
        gainNodeRef.current.gain.value = stateRef.current.globalVolume * Math.max(0.15, 1 - Math.abs(diff) / Math.PI);
      } else {
        if (pannerNodeRef.current.pan) pannerNodeRef.current.pan.value = 0;
        gainNodeRef.current.gain.value = stateRef.current.globalVolume;
      }
    };
    run();
    return () => cancelAnimationFrame(raf);
  }, [orbitActive, members]);

  // ── ONLINE / OFFLINE ──────────────────────────────────────────────────────
  useEffect(() => {
    const goOff = () => { setIsOnline(false); toast('📡 No internet — audio may pause', 'err'); };
    const goOn  = () => { setIsOnline(true);  toast('✅ Back online', 'ok'); };
    window.addEventListener('offline', goOff);
    window.addEventListener('online',  goOn);
    return () => { window.removeEventListener('offline', goOff); window.removeEventListener('online', goOn); };
  }, []);

  // ── KEYBOARD SHORTCUTS ───────────────────────────────────────────────────
  useEffect(() => {
    if (location.pathname !== '/room') return;
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space')      { e.preventDefault(); if (stateRef.current.amHost) togglePlay(); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); if (stateRef.current.amHost && audioElRef.current) handleSeek(Math.min(audioElRef.current.currentTime + 10, stateRef.current.songDuration - 0.5)); }
      else if (e.code === 'ArrowLeft')  { e.preventDefault(); if (stateRef.current.amHost && audioElRef.current) handleSeek(Math.max(audioElRef.current.currentTime - 10, 0)); }
      else if (e.code === 'KeyN')  { if (stateRef.current.amHost) playNext(true); }
      else if (e.code === 'KeyP')  { if (stateRef.current.amHost) playPrev(); }
      else if (e.code === 'KeyM')  {
        if (gainNodeRef.current) {
          const muted = gainNodeRef.current.gain.value === 0;
          gainNodeRef.current.gain.value = muted ? stateRef.current.globalVolume : 0;
          toast(muted ? '🔊 Unmuted' : '🔇 Muted', 'inf');
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, amHost]);

  // ── MEDIA SESSION ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title:  currentSong?.name || 'HushPod Party',
      artist: amHost ? 'DJ ' + uname : roomTitle,
      album:  'HushPod Live Session',
    });
    navigator.mediaSession.setActionHandler('play',          () => { if (amHost) togglePlay(); });
    navigator.mediaSession.setActionHandler('pause',         () => { if (amHost) togglePlay(); });
    navigator.mediaSession.setActionHandler('nexttrack',     () => { if (amHost) playNext(true); });
    navigator.mediaSession.setActionHandler('previoustrack', () => { if (amHost) playPrev(); });
  }, [currentSong, amHost, uname, roomTitle]);

  // ── SESSION RESTORE ───────────────────────────────────────────────────────
  useEffect(() => {
    const raw = sessionStorage.getItem('hushpod_session');
    if (!raw) { setIsSyncing(false); return; }
    const { code, name, isHost: wasHost } = JSON.parse(raw);
    setUname(name); setCodeInput(code);

    initSystem().catch(() => {
      sessionStorage.removeItem('hushpod_session');
      setIsSyncing(false);
      toast('Could not reach server. Please rejoin.', 'err');
    }).then(() => {
      if (!socketRef.current) return;
      socketRef.current.emit('join-room', { code, name, claimHost: !!wasHost }, (res) => {
        if (!res || res.error) {
          sessionStorage.removeItem('hushpod_session');
          setIsSyncing(false);
          toast(res?.error || 'Session expired. Please rejoin.', 'err');
          return;
        }
        setRoomCode(code); setMembers(res.members); setQueue(res.queue);
        setGuestUploads(res.guestUploads); setGlobalVolume(res.globalVolume);
        if (res.orbitActive !== undefined) setOrbitActive(res.orbitActive);
        if (res.history) setPlayHistory(res.history);
        if (res.hasPassword !== undefined) setHasPassword(res.hasPassword);
        if (res.currentSong) {
          setCurrentSong({ id: res.currentSong.songId, name: res.currentSong.name });
          loadAndPlay(SERVER + res.currentSong.streamUrl, res.playState, res.currentSong.songId, ++loadSessionId.current);
        }
        setIsSyncing(false); setRoomTab('dj'); setView('room');
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── QR URL PARSER ─────────────────────────────────────────────────────────
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const r = p.get('room');
    if (r) {
      setCodeInput(r.toUpperCase()); setView('app-entry');
      toast(`Scanned! Enter your name to join ${r.toUpperCase()}`, 'ok');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── BACKGROUND WORKER — keeps heartbeat alive when tab hidden ─────────────
  useEffect(() => {
    if (location.pathname !== '/room') return;
    const blob = new Blob([`
      let t1,t2;
      self.onmessage=e=>{
        if(e.data==='start'){
          t1=setInterval(()=>self.postMessage('hb'),800);
          t2=setInterval(()=>self.postMessage('cs'),25000);
        } else if(e.data==='stop'){clearInterval(t1);clearInterval(t2);}
      };
    `], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = (e) => {
      if (e.data === 'hb') {
        const s = stateRef.current;
        if (s.localPlayState && s.amHost && socketRef.current && audioElRef.current) {
          const pos = audioElRef.current.currentTime;
          socketRef.current.emit('heartbeat', { currentTime: pos });
          // Check for auto-advance
          const dur = s.songDuration;
          if (dur > 0 && pos >= dur - 0.5 && !s.isTransitioning) {
            s.isTransitioning = true;
            playNext(false);
          }
        }
      } else if (e.data === 'cs') {
        syncClock();
      }
    };
    worker.postMessage('start');
    return () => { worker.postMessage('stop'); worker.terminate(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // ── VISUALIZER RAF — updates progress bar + waveform ─────────────────────
  useEffect(() => {
    let raf;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const el = audioElRef.current;
      if (!el || !stateRef.current.localPlayState) return;
      const pos = el.currentTime;
      const dur = stateRef.current.songDuration || el.duration || 1;
      if (progFillRef.current) progFillRef.current.style.width = (Math.min(pos, dur) / dur * 100) + '%';
      if (tCurRef.current)     tCurRef.current.textContent = fmt(pos);
      // Waveform
      if (analyserRef.current) {
        const cvs = document.getElementById('viz-canvas');
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;
        const W = cvs.width = cvs.offsetWidth, H = cvs.height = cvs.offsetHeight;
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        ctx.clearRect(0, 0, W, H);
        const pColor = getComputedStyle(document.body).getPropertyValue('--cyan').trim() || '#4cc9f0';
        const bw = (W / data.length) * 2.5;
        let x = 0;
        for (let i = 0; i < data.length; i++) {
          const bh = (data[i] / 255) * H;
          ctx.fillStyle = pColor; ctx.fillRect(x, H - bh, bw, bh); x += bw + 1;
        }
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // ════════════════════════════════════════════════════════════════════════════
  // CORE AUDIO ENGINE — HTMLAudioElement streaming
  // ════════════════════════════════════════════════════════════════════════════

  const initAudioContext = () => {
    if (actxRef.current) return;
    actxRef.current = new (window.AudioContext || window.webkitAudioContext)();

    gainNodeRef.current   = actxRef.current.createGain();
    pannerNodeRef.current = actxRef.current.createStereoPanner
      ? actxRef.current.createStereoPanner()
      : actxRef.current.createGain();
    analyserRef.current   = actxRef.current.createAnalyser();
    analyserRef.current.fftSize = 128;

    pannerNodeRef.current.connect(analyserRef.current);
    analyserRef.current.connect(gainNodeRef.current);
    gainNodeRef.current.connect(actxRef.current.destination);
  };

  // ── stopAudio: pause and destroy the current audio element ───────────────
  const stopAudio = () => {
    cancelAnimationFrame(vizRafRef.current);
    if (mediaSourceRef.current) {
      try { mediaSourceRef.current.disconnect(); } catch {}
      mediaSourceRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = '';
      try { audioElRef.current.remove(); } catch {}
      audioElRef.current = null;
    }
    stateRef.current.localPlayState = false;
    setIsPlaying(false);
  };

  // ── loadAndPlay: create audio element, connect to Web Audio, start playing ─
  // FIX: This replaces the old fetch() + decodeAudioData() bottleneck.
  // 'canplay' fires after just a few KB are buffered — typically <500ms.
  const loadAndPlay = (url, playState, songId, expectedLoadId) => {
    const myLoadId = expectedLoadId;
    stopAudio();
    initAudioContext();
    setTrackReady(false);

    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.src = url;
    audioElRef.current = audio;

    // Connect to Web Audio graph for sync math + orbit + visualizer
    actxRef.current.resume().then(() => {
      try {
        const src = actxRef.current.createMediaElementSource(audio);
        src.connect(pannerNodeRef.current);
        mediaSourceRef.current = src;
      } catch (err) {
        console.warn('[Audio graph]', err);
      }
    });

    // 'canplay' = enough data to start. Fire sync immediately.
    audio.addEventListener('canplay', () => {
      if (loadSessionId.current !== myLoadId) return; // stale load
      stateRef.current.songDuration = audio.duration || 0;
      setTrackReady(true);
      applyPlayState(playState.playing, playState.currentTime, playState.ts, true);
    }, { once: true });

    // Update duration once metadata arrives
    audio.addEventListener('loadedmetadata', () => {
      stateRef.current.songDuration = audio.duration || 0;
    });

    // Auto-advance on natural end
    audio.addEventListener('ended', () => {
      if (!stateRef.current.amHost || stateRef.current.isTransitioning) return;
      stateRef.current.isTransitioning = true;
      playNext(false);
    });

    // Error handling
    audio.addEventListener('error', (e) => {
      if (loadSessionId.current !== myLoadId) return;
      console.error('[Audio error]', e);
      setTrackReady(true); // unblock UI
      setSyncState({ state: 'fixing', label: 'Load error — retrying' });
      // Retry once after 2 seconds
      setTimeout(() => { if (loadSessionId.current === myLoadId) loadAndPlay(url, playState, songId, myLoadId); }, 2000);
    }, { once: true });

    // Keep silent audio running so iOS doesn't kill the WebAudio context
    if (!keepAliveRef.current) {
      const silentWav = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      keepAliveRef.current = new Audio(silentWav);
      keepAliveRef.current.loop = true;
      keepAliveRef.current.play().catch(() => {});
    }
  };

  // ── applyPlayState: THE SYNC MATH ────────────────────────────────────────
  //
  // FORMULA:
  //   elapsed     = how long ago did the host send this state (seconds)
  //   targetEar   = where the host's EARS are right now = currentTime + elapsed
  //   targetEl    = what we set audio.currentTime to = targetEar + outputLatency
  //
  // WHY + outputLatency:
  //   audio.currentTime is what's being decoded. Sound exits hardware
  //   outputLatency seconds LATER. So if we want ears to hear position P,
  //   we set currentTime = P + outputLatency.
  //   This automatically fixes Bluetooth — BT outputLatency is just larger.
  //
  const applyPlayState = (playing, currentTime, ts, isNewJoiner = false) => {
    const audio = audioElRef.current;
    if (!audio) return;

    const outLat = getOutputLat();
    const elapsed = Math.max(0, (sNow() - ts) / 1000);

    if (!playing) {
      audio.pause();
      // Park at paused position accounting for output latency
      const pos = Math.max(0, currentTime + outLat);
      if (Math.abs(audio.currentTime - pos) > 0.1) audio.currentTime = pos;
      stateRef.current.localPlayState = false;
      stateRef.current.isTransitioning = false;
      setIsPlaying(false);
      if (!stateRef.current.amHost) setSyncState({ state: 'synced', label: 'Paused' });
      return;
    }

    // Where the host's ears are at this exact moment
    const targetEarPos = currentTime + elapsed;
    // What we set currentTime to (so hardware output aligns with targetEarPos)
    const targetElPos  = Math.min(targetEarPos + outLat, (stateRef.current.songDuration || audio.duration || 9999) - 0.1);
    const clampedPos   = Math.max(0, targetElPos);

    // Apply seek
    if (Math.abs(audio.currentTime - clampedPos) > 0.05) {
      audio.currentTime = clampedPos;
    }

    // Reset playback rate to 1.0 before playing
    audio.playbackRate = 1.0;

    if (actxRef.current?.state === 'suspended') actxRef.current.resume();

    audio.play().catch((err) => {
      // Autoplay blocked — wait for user tap (unlockAudio effect handles it)
      console.warn('[autoplay]', err);
    });

    stateRef.current.localPlayState = true;
    stateRef.current.isTransitioning = false;
    setIsPlaying(true);
    if (!stateRef.current.amHost) setSyncState({ state: 'synced', label: 'Locked Sync' });
  };

  // ── syncClock: NTP-style server clock offset ──────────────────────────────
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
        const rtt = t4 - t1;
        if (rtt < 500) samples.push({ offset: t + rtt / 2 - Date.now(), rtt });
      } catch {}
      await new Promise(res => setTimeout(res, 40));
    }
    if (samples.length > 0) {
      samples.sort((a, b) => a.rtt - b.rtt);
      const offs = samples.slice(0, Math.min(3, samples.length)).map(s => s.offset).sort((a, b) => a - b);
      stateRef.current.clockOff = offs[Math.floor(offs.length / 2)];
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // SOCKET EVENT LISTENERS
  // ════════════════════════════════════════════════════════════════════════════

  const setupSocketListeners = (sock) => {

    sock.on('song-changed', ({ songId, name, streamUrl, playState }) => {
      stateRef.current.isTransitioning = false;
      const lid = ++loadSessionId.current;
      setCurrentSong({ id: songId, name });
      setTrackReady(false);
      loadAndPlay(SERVER + streamUrl, playState, songId, lid);
    });

    // FIX: Atomic scheduled playback.
    // Server gives us a future UTC timestamp (targetTs) to start playing.
    // We calculate exactly how many ms from now that is, seek to the right
    // position (accounting for output latency), and use setTimeout to fire play().
    sock.on('play-scheduled', ({ currentTime, targetTs }) => {
      if (stateRef.current.amHost) return;
      const audio = audioElRef.current; if (!audio) return;

      const outLat = getOutputLat();
      const msUntil = targetTs - sNow(); // how many ms until we should start

      // Park audio at the position it should be at when we press play
      const startPos = Math.max(0, currentTime + outLat);
      audio.currentTime = startPos;
      audio.playbackRate = 1.0;

      if (!stateRef.current.amHost) setSyncState({ state: 'syncing', label: 'Locking...' });

      if (msUntil > 10) {
        // Schedule the play() call for exactly the right moment
        setTimeout(() => {
          if (audioElRef.current !== audio) return; // song changed
          audio.play().catch(() => {});
          stateRef.current.localPlayState = true;
          stateRef.current.isTransitioning = false;
          setIsPlaying(true);
          setSyncState({ state: 'synced', label: 'Locked Sync' });
        }, msUntil);
      } else {
        // We're behind — play immediately with elapsed correction
        const elapsed = Math.abs(msUntil) / 1000;
        audio.currentTime = Math.max(0, currentTime + elapsed + outLat);
        audio.play().catch(() => {});
        stateRef.current.localPlayState = true;
        stateRef.current.isTransitioning = false;
        setIsPlaying(true);
        setSyncState({ state: 'synced', label: 'Locked Sync' });
      }
    });

    sock.on('playstate', ({ playing, currentTime, ts }) => {
      if (stateRef.current.amHost) return;
      applyPlayState(playing, currentTime, ts, false);
    });

    // FIX: Heartbeat sync with correct drift math.
    //
    // PREVIOUS BUG: drift was computed as (trueHostTime - myActualTime) but
    // myActualTime was calculated using nodeStartTime offsets which accumulated
    // error. Also outputLatency wasn't subtracted from what the ears are hearing.
    //
    // NEW MATH:
    //   networkDelay = time since host sent heartbeat (clamped 0–800ms)
    //   trueHostPos  = hostAudioPos + networkDelay (where host ears are NOW)
    //   myHearPos    = audio.currentTime - outputLatency (what MY ears hear)
    //   drift        = trueHostPos - myHearPos
    //
    sock.on('heartbeat', ({ currentTime, ts }) => {
      if (stateRef.current.amHost || !audioElRef.current || !stateRef.current.localPlayState) return;
      if (stateRef.current.isTransitioningOS) return;

      const networkDelay = Math.max(0, Math.min(0.8, (sNow() - ts) / 1000));
      const outLat       = getOutputLat();
      const trueHostPos  = currentTime + networkDelay;
      const myHearPos    = audioElRef.current.currentTime - outLat;
      const drift        = trueHostPos - myHearPos;
      const absDrift     = Math.abs(drift);

      // Clear any pending rate-reset
      clearTimeout(driftCorrTmr.current);

      if (absDrift > 0.30) {
        // HARD RESYNC — drift too large for rate correction
        const targetEl = Math.max(0, trueHostPos + outLat);
        audioElRef.current.currentTime = targetEl;
        audioElRef.current.playbackRate = 1.0;
        setSyncState({ state: 'fixing', label: `Resyncing (${Math.round(drift*1000)}ms)` });
        // After resync, confirm we're locked
        setTimeout(() => {
          if (stateRef.current.localPlayState) setSyncState({ state: 'synced', label: 'Locked Sync' });
        }, 500);
      } else if (absDrift > 0.040) {
        // SOFT CORRECTION — nudge playback rate (0.95–1.05x)
        // Rate nudge: 1 ± (drift * 0.5) clamped to ±5%
        const rate = Math.max(0.95, Math.min(1.05, 1 + drift * 0.5));
        audioElRef.current.playbackRate = rate;
        setSyncState({ state: drift > 0 ? 'fixing' : 'fixing', label: `Correcting ${drift>0?'+':''}${Math.round(drift*1000)}ms` });
        // Auto-reset rate after 600ms
        driftCorrTmr.current = setTimeout(() => {
          if (audioElRef.current && Math.abs(audioElRef.current.playbackRate - 1) > 0.001) {
            audioElRef.current.playbackRate = 1.0;
          }
        }, 600);
      } else {
        // LOCKED — within 40ms deadzone. Don't touch audio.
        if (audioElRef.current.playbackRate !== 1.0) audioElRef.current.playbackRate = 1.0;
        setSyncState({ state: 'synced', label: `Locked (${Math.round(Math.abs(drift)*1000)}ms)` });
      }
    });

    sock.on('queue-updated', ({ queue }) => { setQueue(queue); });
    sock.on('history-updated', ({ history }) => { setPlayHistory(history); });

    sock.on('chat-msg', ({ name, text }) => {
      setChat(prev => [...prev, { name, text }]);
      if (name !== stateRef.current.uname) toast(`💬 ${name}: ${text}`, 'inf');
    });

    sock.on('reaction', ({ name, emoji, id }) => {
      const leftPct = 10 + Math.random() * 70;
      setReactions(prev => [...prev, { id, emoji, name, leftPct }]);
      setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 3100);
    });

    sock.on('user-typing', ({ name }) => {
      setTypingUsers(prev => [...new Set([...prev, name])]);
      clearTimeout(typingTimers.current[name]);
      typingTimers.current[name] = setTimeout(() => {
        setTypingUsers(prev => prev.filter(n => n !== name));
      }, 3000);
    });

    sock.on('settings-updated', (s) => {
      setGuestUploads(s.guestUploads);
      setGlobalVolume(s.globalVolume);
      if (s.orbitActive !== undefined) setOrbitActive(s.orbitActive);
      if (gainNodeRef.current && !s.orbitActive) gainNodeRef.current.gain.value = s.globalVolume;
    });

    sock.on('member-joined', ({ members }) => { setMembers(members); });

    sock.on('member-left', ({ members, newHostName, hostAway }) => {
      setMembers(members);
      if (hostAway) toast('Host lost connection. Waiting 30s...', 'inf');
      else if (newHostName) toast(`👑 ${newHostName} is the new Host!`, 'ok');
    });
  };

  // ── initSystem ────────────────────────────────────────────────────────────
  const initSystem = async () => {
    initAudioContext();
    if (actxRef.current?.state === 'suspended') await actxRef.current.resume();
    await syncClock();

    if (!socketRef.current) {
      socketRef.current = io(SERVER || window.location.origin, { transports: ['websocket', 'polling'] });
      setupSocketListeners(socketRef.current);
    }

    if (!socketRef.current.connected) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Server timeout — check connection')), 14000);
        socketRef.current.once('connect', () => { clearTimeout(timeout); resolve(); });
        socketRef.current.once('connect_error', (err) => { clearTimeout(timeout); reject(err); });
      });
    }

    // Reconnect handler
    socketRef.current.off('connect');
    socketRef.current.on('connect', () => {
      const s = stateRef.current;
      if (s.uname && s.roomCode) {
        socketRef.current.emit('join-room', { code: s.roomCode, name: s.uname, claimHost: s.amHost }, (res) => {
          if (!res || res.error) {
            sessionStorage.removeItem('hushpod_session');
            toast('Session expired. Please rejoin.', 'err');
            setIsSyncing(false); setView('app-entry');
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

  // ════════════════════════════════════════════════════════════════════════════
  // ROOM ACTIONS
  // ════════════════════════════════════════════════════════════════════════════

  const attemptCreateRoom = () => {
    if (!uname.trim()) return toast('Enter your name first', 'err');
    setPendingAction('create'); setTosChecked(false); setModals({ ...modals, tos: true });
  };

  const attemptJoinRoom = () => {
    if (!uname.trim() || codeInput.length < 3) return toast('Enter name and room code', 'err');
    setPendingAction('join'); setTosChecked(false); setModals({ ...modals, tos: true });
  };

  const confirmTosAndExecute = async () => {
    if (!tosChecked) return;
    setModals({ ...modals, tos: false });

    if (pendingAction === 'create') {
      setIsSyncing(true);
      try { await initSystem(); } catch (err) { setIsSyncing(false); return toast(err.message || 'Cannot connect to server', 'err'); }
      const timer = setTimeout(() => { setIsSyncing(false); toast('Server did not respond. Try again.', 'err'); }, 10000);
      socketRef.current.emit('create-room', { name: uname, password: roomPassword.trim() || null }, (res) => {
        clearTimeout(timer);
        if (!res || res.error) { setIsSyncing(false); return toast(res?.error || 'Failed to create room', 'err'); }
        setRoomCode(res.code);
        setMembers([{ id: socketRef.current.id, name: uname, isHost: true }]);
        setHasPassword(!!(roomPassword.trim()));
        sessionStorage.setItem('hushpod_session', JSON.stringify({ code: res.code, name: uname, isHost: true }));
        setIsSyncing(false); setRoomTab('dj'); setView('room'); window.scrollTo(0, 0);
      });
    } else if (pendingAction === 'join') {
      setIsSyncing(true);
      try { await initSystem(); } catch (err) { setIsSyncing(false); return toast(err.message || 'Cannot connect to server', 'err'); }
      const timer = setTimeout(() => { setIsSyncing(false); toast('Server did not respond. Try again.', 'err'); }, 10000);
      socketRef.current.emit('join-room', { code: codeInput, name: uname, claimHost: false, password: roomPassword.trim() || null }, (res) => {
        clearTimeout(timer);
        if (!res || res.error) { setIsSyncing(false); return toast(res?.error || 'Failed to join room', 'err'); }
        sessionStorage.setItem('hushpod_session', JSON.stringify({ code: codeInput, name: uname, isHost: res.isHost || false }));
        setRoomCode(codeInput); setMembers(res.members); setQueue(res.queue);
        setGuestUploads(res.guestUploads); setGlobalVolume(res.globalVolume);
        if (res.orbitActive !== undefined) setOrbitActive(res.orbitActive);
        if (res.history) setPlayHistory(res.history);
        if (res.hasPassword !== undefined) setHasPassword(res.hasPassword);
        if (res.currentSong) {
          setCurrentSong({ id: res.currentSong.songId, name: res.currentSong.name });
          loadAndPlay(SERVER + res.currentSong.streamUrl, res.playState, res.currentSong.songId, ++loadSessionId.current);
        }
        setIsSyncing(false); setRoomTab('dj'); setView('room'); window.scrollTo(0, 0);
      });
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // CONTROLS
  // ════════════════════════════════════════════════════════════════════════════

  const toggleLoopMode = () => setLoopMode(prev => prev === 'none' ? 'queue' : prev === 'queue' ? 'song' : 'none');

  const playNext = (isManualClick = false) => {
    if (!stateRef.current.amHost) return;
    const s = stateRef.current, q = s.queue;
    if (q.length === 0) return;
    if (!isManualClick && s.loopMode === 'song') {
      socketRef.current.emit('play-song', { songId: s.currentSongId, autoPlay: true }); return;
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
        setCurrentSong(null); stopAudio();
      }
    }
  };

  const playPrev = () => {
    if (!stateRef.current.amHost) return;
    const s = stateRef.current, q = s.queue;
    if (q.length === 0) return;
    const idx = q.findIndex(x => x.id === s.currentSongId);
    socketRef.current.emit('play-song', { songId: q[Math.max(0, idx - 1)].id, autoPlay: true });
  };

  const togglePlay = () => {
    if (!stateRef.current.amHost) return;
    const audio = audioElRef.current;
    const playing = stateRef.current.localPlayState;
    const pos = audio ? Math.max(0, audio.currentTime - getOutputLat()) : 0;
    if (!playing) {
      socketRef.current.emit('schedule-play', { currentTime: pos });
    } else {
      socketRef.current.emit('playstate', { playing: false, currentTime: pos, ts: sNow() });
      applyPlayState(false, pos, sNow(), false);
    }
  };

  const seekClick = (e) => {
    if (!stateRef.current.amHost) return;
    const dur = stateRef.current.songDuration || audioElRef.current?.duration || 0;
    if (!dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - r.left) / r.width;
    handleSeek(Math.max(0, Math.min(dur, pct * dur)));
  };

  const handleSeek = (newTime) => {
    if (!stateRef.current.amHost) return;
    const playing = stateRef.current.localPlayState;
    socketRef.current.emit('playstate', { playing, currentTime: newTime, ts: sNow() });
    applyPlayState(playing, newTime, sNow(), false);
  };

  const handleGlobalVolume = (e) => {
    if (!stateRef.current.amHost) return;
    const val = parseFloat(e.target.value);
    setGlobalVolume(val);
    socketRef.current.emit('set-global-volume', { volume: val });
    if (gainNodeRef.current && !orbitActive) gainNodeRef.current.gain.value = val;
  };

  const handleLocalVolume = (e) => {
    const val = parseFloat(e.target.value);
    setLocalVolume(val);
    if (gainNodeRef.current) gainNodeRef.current.gain.value = stateRef.current.globalVolume * val;
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

  const toggleMusicalChairs = () => {
    if (!stateRef.current.amHost) return;
    if (musicalChairActive) {
      clearTimeout(musicalChairTimer.current); setMusicalChairActive(false);
      if (stateRef.current.localPlayState) togglePlay();
    } else {
      setMusicalChairActive(true);
      if (!stateRef.current.localPlayState) togglePlay();
      const ms = Math.floor(Math.random() * 10000) + 5000;
      toast(`Party Roulette! Stopping in ${(ms/1000).toFixed(1)}s`, 'inf');
      musicalChairTimer.current = setTimeout(() => {
        if (!stateRef.current.amHost) return;
        setMusicalChairActive(false);
        if (stateRef.current.localPlayState) togglePlay();
        toast('🛑 MUSIC STOPPED!', 'ok');
      }, ms);
    }
  };

  const ALLOWED_AUDIO = ['audio/mpeg','audio/mp3','audio/wav','audio/flac','audio/aac','audio/ogg','audio/x-m4a','audio/mp4'];
  const ALLOWED_EXT   = ['.mp3','.wav','.flac','.aac','.ogg','.m4a'];

  const uploadSongs = (files) => {
    if (!files || files.length === 0) return;
    if (!stateRef.current.amHost && !guestUploads) return toast('Host has locked uploads', 'err');
    let toUpload = Array.from(files);
    const invalid = toUpload.filter(f => {
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      return !ALLOWED_AUDIO.includes(f.type) && !ALLOWED_EXT.includes(ext);
    });
    if (invalid.length > 0) {
      toast(`❌ ${invalid.map(f => f.name).join(', ')} — only MP3, WAV, FLAC, AAC`, 'err');
      toUpload = toUpload.filter(f => { const ext = '.' + f.name.split('.').pop().toLowerCase(); return ALLOWED_AUDIO.includes(f.type) || ALLOWED_EXT.includes(ext); });
      if (toUpload.length === 0) return;
    }
    if (toUpload.length > 10) { toast('Max 10 files. Slicing.', 'inf'); toUpload = toUpload.slice(0, 10); }
    setUploadProgress(1);
    const fd = new FormData();
    toUpload.forEach(f => fd.append('songs', f));
    fd.append('uploaderId', socketRef.current.id);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', SERVER + '/upload/' + roomCode);
    xhr.upload.onprogress = e => { if (e.lengthComputable) setUploadProgress(Math.round(e.loaded/e.total*100)); };
    xhr.onload = () => {
      setUploadProgress(0);
      if (xhr.status === 403) return toast('Host has locked uploads', 'err');
      if (xhr.status !== 200) return toast('Upload failed — try again', 'err');
      toast(`✅ ${toUpload.length} song${toUpload.length>1?'s':''} added!`, 'ok');
      const fi = document.getElementById('q-file');
      if (fi) fi.value = '';
    };
    xhr.onerror = () => { setUploadProgress(0); toast('Upload failed — check connection', 'err'); };
    xhr.send(fd);
  };

  // ── Sonar acoustic calibration ───────────────────────────────────────────
  const runSonarCalibration = async () => {
    if (!actxRef.current) return toast('Play audio first to wake up hardware', 'err');
    toast('Calibrating... keep the room quiet!', 'inf');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const mic  = actxRef.current.createMediaStreamSource(stream);
      const anl  = actxRef.current.createAnalyser();
      mic.connect(anl);
      const data = new Uint8Array(anl.frequencyBinCount);
      const osc  = actxRef.current.createOscillator();
      const og   = actxRef.current.createGain();
      osc.type = 'sine'; osc.frequency.value = 1200;
      og.gain.setValueAtTime(0, actxRef.current.currentTime);
      og.gain.linearRampToValueAtTime(1, actxRef.current.currentTime + 0.002);
      og.gain.linearRampToValueAtTime(0, actxRef.current.currentTime + 0.010);
      osc.connect(og); og.connect(actxRef.current.destination);
      osc.start(); osc.stop(actxRef.current.currentTime + 0.02);
      const start = performance.now();
      const check = () => {
        anl.getByteFrequencyData(data);
        const peak = Math.max(...data);
        if (peak > 180) {
          const latSec = (performance.now() - start) / 1000;
          stateRef.current.outLat = Math.max(0.010, Math.min(0.600, latSec));
          stateRef.current.isCalibrated = true;
          setBtStatus(s => ({ ...s, latencyMs: Math.round(latSec * 1000), synced: true }));
          toast(`🎯 Calibrated: ${Math.round(latSec*1000)}ms`, 'ok');
          stream.getTracks().forEach(t => t.stop());
        } else if (performance.now() - start < 2000) {
          requestAnimationFrame(check);
        } else {
          toast('Calibration failed — turn up volume and try again', 'err');
          stream.getTracks().forEach(t => t.stop());
        }
      };
      requestAnimationFrame(check);
    } catch { toast('Microphone access required for Sonar Calibration', 'err'); }
  };

  const sendReaction = (emoji) => { if (socketRef.current) socketRef.current.emit('react', { emoji }); };
  const sendTyping   = () => { if (socketRef.current && roomCode) socketRef.current.emit('typing'); };

  // ── EXPORTS ───────────────────────────────────────────────────────────────
  // NOTE: audioBufferRef is replaced by audioElRef internally.
  // We still export audioBufferRef as a compat shim pointing to a fake object
  // with .duration — DJDesk uses audioBufferRef.current?.duration for the timer.
  const audioBufferCompat = { current: audioElRef.current ? { duration: stateRef.current.songDuration } : null };

  return {
    setView, toastData, modals, setModals, uploadProgress, roomTab, setRoomTab,
    uname, setUname, roomCode, isSyncing, codeInput, setCodeInput, members,
    queue, setQueue, chat, playHistory, currentSong, syncState, isPlaying, trackReady,
    isOnline,
    guestUploads, setGuestUploads, globalVolume, handleGlobalVolume,
    localVolume, handleLocalVolume,
    typingUsers, reactions, sendReaction, sendTyping,
    roomPassword, setRoomPassword, hasPassword, btStatus,
    orbitActive, loopMode, toggleLoopMode, isShuffle, setIsShuffle,
    draggedIdx, setDraggedIdx, tosChecked, setTosChecked,
    socketRef, actxRef,
    audioBufferRef: audioBufferCompat,   // compat shim for DJDesk duration display
    audioElRef,                           // real audio element ref
    progFillRef, tCurRef,
    stateRef, fmt, seekClick, handleSeek, togglePlay, uploadSongs, handleDrop,
    attemptCreateRoom, attemptJoinRoom, confirmTosAndExecute, runSonarCalibration,
    amHost, roomTitle, playNext, playPrev, musicalChairActive, toggleMusicalChairs,
  };
}