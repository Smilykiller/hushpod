import React, { useState, useEffect } from 'react';

export default function Home({ setView }) {
  const [activeRooms, setActiveRooms] = useState(4);
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
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
  }, []);

  return (
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
              <div className="stat-box"><div className="stat-val">&lt;100<span className="stat-unit">ms</span></div><div className="stat-label">Sync precision</div></div>
              <div className="stat-box"><div className="stat-val">500<span className="stat-unit">ms</span></div><div className="stat-label">Heartbeat interval</div></div>
              <div className="stat-box"><div className="stat-val">150<span className="stat-unit">MB</span></div><div className="stat-label">Max file size</div></div>
              <div className="stat-box"><div className="stat-val">10<span className="stat-unit"> songs</span></div><div className="stat-label">Batch upload</div></div>
              <div className="stat-box"><div className="stat-val">8<span className="stat-unit">x</span></div><div className="stat-label">Clock sync samples</div></div>
              <div className="stat-box"><div className="stat-val">0<span className="stat-unit">MB</span></div><div className="stat-label">Data retained</div></div>
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
  );
}