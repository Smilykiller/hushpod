import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

/* ══════════════════════════════════════════════════════════════
   HUSHPOD — ULTRA PRO MAX HOME PAGE
   Aesthetic: Dark Rave × Brutalist Neon × Spatial 3D
   Every section has its own 3D moment. Scroll = cinema.
══════════════════════════════════════════════════════════════ */

/* ── Persistent IntersectionObserver map (survives StrictMode) ── */
const revealMap = new WeakMap();

function Reveal({ children, delay=0, y=60, x=0, scale=false, rotate=false, style={} }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el || revealMap.has(el)) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVis(true); obs.unobserve(el); revealMap.delete(el); }
    }, { threshold: 0.01, rootMargin: '0px 0px -50px 0px' });
    obs.observe(el); revealMap.set(el, obs);
    return () => { obs.unobserve(el); revealMap.delete(el); };
  }, []);
  return (
    <div ref={ref} style={{
      opacity: vis ? 1 : 0,
      transform: vis ? 'none' : [
        `translateY(${y}px)`,
        x ? `translateX(${x}px)` : '',
        scale ? 'scale(0.88)' : '',
        rotate ? 'rotate(-4deg)' : '',
      ].filter(Boolean).join(' '),
      transition: `opacity .8s ease ${delay}s, transform .9s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      willChange: 'transform,opacity', ...style,
    }}>{children}</div>
  );
}

/* ── Tilt ── */
function Tilt({ children, s=10, style={}, className='' }) {
  const r = useRef(null);
  const move = useCallback(e => {
    const el = r.current; if (!el) return;
    const b=el.getBoundingClientRect();
    const dx=(e.clientX-(b.left+b.width/2))/(b.width/2);
    const dy=(e.clientY-(b.top+b.height/2))/(b.height/2);
    el.style.transform=`perspective(800px) rotateY(${dx*s}deg) rotateX(${-dy*s}deg) translateZ(16px)`;
    el.style.transition='transform .08s ease';
  },[s]);
  const leave = useCallback(()=>{
    if(r.current){ r.current.style.transform='perspective(800px) rotateY(0) rotateX(0) translateZ(0)'; r.current.style.transition='transform .6s cubic-bezier(.22,1,.36,1)'; }
  },[]);
  return <div ref={r} onMouseMove={move} onMouseLeave={leave} style={{transformStyle:'preserve-3d',willChange:'transform',...style}} className={className}>{children}</div>;
}

/* ── Animated Counter ── */
function Count({ value, unit='', color='#f72585', size='clamp(40px,6vw,72px)', delay=0 }) {
  const [n, setN] = useState(0);
  const [vis, setVis] = useState(false);
  const ref = useRef(null);
  useEffect(()=>{
    const obs=new IntersectionObserver(([e])=>{ if(e.isIntersecting){setVis(true);obs.disconnect();} },{threshold:.01,rootMargin:'0px 0px -30px 0px'});
    obs.observe(ref.current); return()=>obs.disconnect();
  },[]);
  useEffect(()=>{
    if(!vis||isNaN(parseInt(value)))return;
    const t=parseInt(value),steps=60;let s=0;
    const id=setInterval(()=>{ s++; setN(Math.round(t*(s/steps))); if(s>=steps)clearInterval(id); },1200/steps);
    return()=>clearInterval(id);
  },[vis,value]);
  return (
    <div ref={ref} style={{
      opacity:vis?1:0, transform:vis?'none':'translateY(24px)',
      transition:`all .7s cubic-bezier(.22,1,.36,1) ${delay}s`,
    }}>
      <div style={{ fontSize:size, fontFamily:"'Bebas Neue',sans-serif", fontWeight:900, color, lineHeight:1, textShadow:`0 0 30px ${color}88` }}>
        {isNaN(parseInt(value))?value:n}{unit}
      </div>
    </div>
  );
}

/* ── Three.js Hero ── */
function HeroScene() {
  const mount = useRef(null);
  useEffect(()=>{
    const el=mount.current; if(!el)return;
    const W=el.clientWidth, H=el.clientHeight, isMob=window.innerWidth<600;
    const scene=new THREE.Scene();
    const cam=new THREE.PerspectiveCamera(55,W/H,0.1,300);
    cam.position.set(0,0,isMob?26:18);
    const rdr=new THREE.WebGLRenderer({antialias:!isMob,alpha:true});
    rdr.setPixelRatio(Math.min(devicePixelRatio,2));
    rdr.setSize(W,H); rdr.setClearColor(0,0);
    el.appendChild(rdr.domElement);

    /* Icosahedron wireframe */
    const icoMat=new THREE.MeshBasicMaterial({color:0xf72585,wireframe:true,transparent:true,opacity:.18});
    const ico=new THREE.Mesh(new THREE.IcosahedronGeometry(5.5,2),icoMat); scene.add(ico);
    const ico2=new THREE.Mesh(new THREE.IcosahedronGeometry(3.8,1),new THREE.MeshBasicMaterial({color:0x4cc9f0,wireframe:true,transparent:true,opacity:.14})); scene.add(ico2);

    /* Torus knot core */
    const knot=new THREE.Mesh(new THREE.TorusKnotGeometry(2,0.45,140,18,3,5),new THREE.MeshStandardMaterial({color:0xf72585,emissive:0xf72585,emissiveIntensity:.5,metalness:.9,roughness:.1}));
    scene.add(knot);

    /* Waveform rings */
    const N=isMob?100:200, R=8;
    const mkRing=(col,scale=1,rx=0)=>{
      const geo=new THREE.BufferGeometry(); const pos=new Float32Array(N*3); const base=[];
      for(let i=0;i<N;i++){const a=(i/N)*Math.PI*2; pos[i*3]=Math.cos(a)*R*scale; pos[i*3+1]=0; pos[i*3+2]=Math.sin(a)*R*scale; base.push(a);}
      geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
      const loop=new THREE.LineLoop(geo,new THREE.LineBasicMaterial({color:col})); loop.rotation.x=rx;
      scene.add(loop); return{geo,loop,base};
    };
    const ring1=mkRing(0xf72585,1.0,0);
    const ring2=mkRing(0x4cc9f0,0.78,Math.PI/5);
    const ring3=mkRing(0x06d6a0,0.55,-Math.PI/4);

    /* Particles */
    const NP=isMob?300:700; const pPos=new Float32Array(NP*3); const pCol=new Float32Array(NP*3);
    const PC=[[247,37,133],[76,201,240],[6,214,160],[123,47,247]];
    for(let i=0;i<NP;i++){
      const r2=8+Math.random()*18,th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1);
      pPos[i*3]=r2*Math.sin(ph)*Math.cos(th); pPos[i*3+1]=r2*Math.sin(ph)*Math.sin(th); pPos[i*3+2]=r2*Math.cos(ph);
      const c=PC[Math.floor(Math.random()*PC.length)]; pCol[i*3]=c[0]/255; pCol[i*3+1]=c[1]/255; pCol[i*3+2]=c[2]/255;
    }
    const pGeo=new THREE.BufferGeometry();
    pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));
    pGeo.setAttribute('color',new THREE.BufferAttribute(pCol,3));
    const pts=new THREE.Points(pGeo,new THREE.PointsMaterial({size:.11,vertexColors:true,transparent:true,opacity:.88}));
    scene.add(pts);

    /* Lights */
    scene.add(new THREE.AmbientLight(0xffffff,.4));
    const lP=new THREE.PointLight(0xf72585,5,40); lP.position.set(8,5,5); scene.add(lP);
    const lC=new THREE.PointLight(0x4cc9f0,5,40); lC.position.set(-8,-5,5); scene.add(lC);
    const lG=new THREE.PointLight(0x06d6a0,3,30); lG.position.set(0,10,-5); scene.add(lG);

    let mx=0,my=0;
    const onMouse=e=>{mx=(e.clientX/innerWidth-.5)*2; my=(e.clientY/innerHeight-.5)*2;};
    addEventListener('mousemove',onMouse);
    const onResize=()=>{const w=el.clientWidth,h=el.clientHeight; cam.aspect=w/h; cam.updateProjectionMatrix(); rdr.setSize(w,h);};
    addEventListener('resize',onResize);

    let fid,t=0,lastT=0;
    const amp=[1.4,.9,.7,1.1,1.0,1.3];
    const animate=()=>{
      fid=requestAnimationFrame(animate); t+=.016;
      /* Waveform */
      [ring1,ring2,ring3].forEach(({geo,loop,base},gi)=>{
        const sc=[R,R*.78,R*.55][gi]; const pos=geo.attributes.position;
        for(let i=0;i<N;i++){
          const a=base[i];
          const w=Math.sin(a*8+t*2.2+gi*1.4)*amp[i%6]*.55+Math.sin(a*3-t*1.8+gi*.9)*.35;
          const rr=sc+w;
          pos.setXYZ(i,Math.cos(a)*rr+w*.12,Math.sin(a*5+t*1.3+gi)*.5,Math.sin(a)*rr);
        }
        pos.needsUpdate=true;
      });
      ring1.loop.rotation.y=t*.16; ring1.loop.rotation.z=t*.05;
      ring2.loop.rotation.y=-t*.20; ring2.loop.rotation.z=t*.09; ring2.loop.rotation.x=Math.PI/5+Math.sin(t*.25)*.1;
      ring3.loop.rotation.y=t*.26; ring3.loop.rotation.x=-Math.PI/4+Math.sin(t*.3)*.12;
      /* Knot */
      knot.rotation.x=t*.22; knot.rotation.y=t*.32; knot.scale.setScalar(1+Math.sin(t*1.4)*.045);
      /* Ico */
      ico.rotation.x=t*.07; ico.rotation.y=t*.11;
      ico2.rotation.x=-t*.09; ico2.rotation.y=t*.13; ico2.rotation.z=t*.05;
      /* Particles */
      pts.rotation.y=t*.035; pts.rotation.x=Math.sin(t*.08)*.04;
      /* Mouse parallax */
      scene.rotation.y+=(mx*.25-scene.rotation.y)*.04;
      scene.rotation.x+=(-my*.12-scene.rotation.x)*.04;
      /* Lights pulse */
      lP.intensity=4+Math.sin(t*2.1)*2; lC.intensity=4+Math.sin(t*1.7+1)*2; lG.intensity=2+Math.sin(t*1.3+2)*1;
      rdr.render(scene,cam);
    };
    animate();

    return()=>{
      cancelAnimationFrame(fid);
      removeEventListener('mousemove',onMouse);
      removeEventListener('resize',onResize);
      rdr.dispose();
      if(el.contains(rdr.domElement))el.removeChild(rdr.domElement);
    };
  },[]);
  return <div ref={mount} style={{position:'absolute',inset:0,zIndex:0,pointerEvents:'none'}}/>;
}

/* ── Floating Tag ── */
function Tag({name,device,color,style}){
  return(
    <div style={{display:'inline-flex',alignItems:'center',gap:'8px',background:`rgba(${color},.1)`,border:`1px solid rgba(${color},.35)`,borderRadius:'30px',padding:'7px 16px',backdropFilter:'blur(12px)',whiteSpace:'nowrap',...style}}>
      <span style={{width:7,height:7,borderRadius:'50%',background:`rgb(${color})`,display:'inline-block',boxShadow:`0 0 8px rgb(${color})`}}/>
      <span style={{fontSize:'12px',fontWeight:'700',color:`rgb(${color})`}}>{name}</span>
      <span style={{fontSize:'11px',color:`rgba(${color},.65)`,fontFamily:"'JetBrains Mono',monospace"}}>{device}</span>
    </div>
  );
}

/* ── Horizontal Scroll Strip ── */
function MarqueeStrip(){
  const items=['🎵 Dead Reckoning Sync','⚡ Atomic Playback','🎧 BT Auto-Detect','🔒 Zero Data Storage','📲 QR Invite','🌙 Wake Lock API','💬 Live Chat','🔔 Lock Screen Controls','🔑 Password Rooms','👑 Admin Controls','🎛️ DJ Desk','🌍 Works Anywhere'];
  return(
    <div style={{overflow:'hidden',padding:'18px 0',borderTop:'1px solid rgba(255,255,255,0.07)',borderBottom:'1px solid rgba(255,255,255,0.07)',background:'rgba(0,0,0,0.3)'}}>
      <div style={{display:'flex',gap:'40px',animation:'marqueeScroll 28s linear infinite',width:'max-content'}}>
        {[...items,...items].map((item,i)=>(
          <span key={i} style={{fontSize:'13px',fontWeight:'700',color:'#888899',letterSpacing:'1.5px',textTransform:'uppercase',flexShrink:0,whiteSpace:'nowrap'}}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Step Card with 3D number ── */
function StepCard({n,icon,title,desc,color,delay}){
  return(
    <Reveal delay={delay} scale>
      <Tilt s={8} style={{height:'100%'}}>
        <div style={{background:'rgba(255,255,255,0.025)',border:`1px solid rgba(255,255,255,0.08)`,borderRadius:'28px',padding:'36px 32px',height:'100%',position:'relative',overflow:'hidden',transition:'border-color .3s,box-shadow .3s',cursor:'default'}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=`${color}55`;e.currentTarget.style.boxShadow=`0 28px 70px ${color}20`;}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.08)';e.currentTarget.style.boxShadow='none';}}>
          {/* Giant background number */}
          <div style={{position:'absolute',right:'-8px',top:'-12px',fontFamily:"'Bebas Neue',sans-serif",fontSize:'140px',lineHeight:1,color:'rgba(255,255,255,0.03)',userSelect:'none',pointerEvents:'none'}}>{n}</div>
          {/* Glow corner */}
          <div style={{position:'absolute',top:0,left:0,width:'80px',height:'80px',background:`radial-gradient(circle at 0 0,${color}25,transparent)`,borderRadius:'28px 0 0 0'}}/>
          <div style={{fontSize:'40px',marginBottom:'20px'}}>{icon}</div>
          <div style={{fontSize:'11px',fontWeight:'800',letterSpacing:'3px',textTransform:'uppercase',color,marginBottom:'12px'}}>{n}</div>
          <div style={{fontSize:'20px',fontWeight:'800',color:'#f0f0ff',marginBottom:'14px',lineHeight:1.2}}>{title}</div>
          <div style={{fontSize:'14px',color:'#a0a0c0',lineHeight:1.75}}>{desc}</div>
        </div>
      </Tilt>
    </Reveal>
  );
}

/* ── Feature Card ── */
function FeatCard({icon,title,desc,live,delay}){
  return(
    <Reveal delay={delay} y={50}>
      <Tilt s={6} style={{height:'100%'}}>
        <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'22px',padding:'28px 26px',height:'100%',transition:'all .3s',cursor:'default'}}
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(76,201,240,0.04)';e.currentTarget.style.borderColor='rgba(76,201,240,0.3)';e.currentTarget.style.boxShadow='0 20px 60px rgba(76,201,240,0.10)';}}
          onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.02)';e.currentTarget.style.borderColor='rgba(255,255,255,0.07)';e.currentTarget.style.boxShadow='none';}}>
          <div style={{fontSize:'30px',marginBottom:'16px'}}>{icon}</div>
          <div style={{fontSize:'15px',fontWeight:'800',color:'#eeeeff',marginBottom:'10px'}}>{title}</div>
          <div style={{fontSize:'13px',color:'#8888aa',lineHeight:1.75,marginBottom:'16px'}}>{desc}</div>
          <span style={{display:'inline-block',padding:'4px 12px',borderRadius:'20px',fontSize:'10px',fontWeight:'800',letterSpacing:'1.5px',background:live?'rgba(6,214,160,0.15)':'rgba(255,214,10,0.1)',color:live?'#06d6a0':'#ffd60a',border:live?'1px solid rgba(6,214,160,0.3)':'1px solid rgba(255,214,10,0.25)'}}>{live?'LIVE':'SOON'}</span>
        </div>
      </Tilt>
    </Reveal>
  );
}

/* ── Use Case Card ── */
function CaseCard({emoji,title,desc,grad,border,delay}){
  return(
    <Reveal delay={delay} y={60} scale>
      <Tilt s={7} style={{height:'100%'}}>
        <div style={{background:grad,border:`1px solid ${border}`,borderRadius:'28px',padding:'40px 32px',height:'100%',transition:'transform .3s,box-shadow .3s',cursor:'default'}}
          onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 32px 80px ${border.replace('0.22','0.18')}`;}}
          onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';}}>
          <div style={{fontSize:'44px',marginBottom:'20px'}}>{emoji}</div>
          <div style={{fontSize:'19px',fontWeight:'800',color:'#f4f4ff',marginBottom:'14px'}}>{title}</div>
          <div style={{fontSize:'14px',color:'#aaaacc',lineHeight:1.75}}>{desc}</div>
        </div>
      </Tilt>
    </Reveal>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════ */
export default function Home({ setView }) {
  const [stats,   setStats]   = useState({ rooms:0, listeners:0 });
  const [openFaq, setOpenFaq] = useState(null);
  const [navSolid,setNavSolid]= useState(false);

  useEffect(()=>{
    fetch('/stats').then(r=>r.json()).then(setStats).catch(()=>{});
    const id=setInterval(()=>fetch('/stats').then(r=>r.json()).then(setStats).catch(()=>{}),30000);
    const onScroll=()=>setNavSolid(window.scrollY>60);
    addEventListener('scroll',onScroll,{passive:true});
    return()=>{ clearInterval(id); removeEventListener('scroll',onScroll); };
  },[]);

  const go  = ()=>{ setView('app-entry'); window.scrollTo(0,0); };
  const nav = id=>document.getElementById(id)?.scrollIntoView({behavior:'smooth'});

  return(
    <div style={{background:'#050510',color:'#e8e8ff',overflowX:'hidden',fontFamily:"'DM Sans',sans-serif"}}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=JetBrains+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::selection{background:#f7258555;color:#fff;}

        /* ── Nav ── */
        .nav{position:fixed;top:0;left:0;right:0;z-index:999;display:flex;align-items:center;justify-content:space-between;padding:0 44px;height:68px;transition:background .4s,border-color .4s,backdrop-filter .4s;}
        .nav.solid{background:rgba(5,5,16,.85);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);border-bottom:1px solid rgba(255,255,255,0.07);}
        .nav-logo{font-family:'Bebas Neue',sans-serif;font-size:32px;letter-spacing:5px;background:linear-gradient(135deg,#f72585,#4cc9f0);-webkit-background-clip:text;-webkit-text-fill-color:transparent;cursor:pointer;}
        .nav-links{display:flex;gap:36px;}
        .nav-links a{font-size:13px;font-weight:700;color:#7070a0;text-decoration:none;letter-spacing:.5px;transition:color .2s;}
        .nav-links a:hover{color:#e8e8ff;}
        .nav-cta{background:linear-gradient(135deg,#f72585,#7b2ff7);color:#fff;border:none;border-radius:12px;padding:11px 26px;font-size:13px;font-weight:800;cursor:pointer;letter-spacing:.5px;box-shadow:0 0 28px #f7258550;transition:transform .2s,box-shadow .2s;}
        .nav-cta:hover{transform:scale(1.07) translateY(-1px);box-shadow:0 0 48px #f7258580;}
        @media(max-width:768px){.nav-links{display:none;}.nav{padding:0 22px;}}

        /* ── Buttons ── */
        .btn-primary{background:linear-gradient(135deg,#f72585,#7b2ff7);border:none;border-radius:16px;padding:18px 44px;font-size:17px;font-weight:800;color:#fff;cursor:pointer;box-shadow:0 10px 36px #f7258555,0 0 0 1px rgba(255,255,255,0.08) inset;transition:transform .2s,box-shadow .2s;letter-spacing:.3px;}
        .btn-primary:hover{transform:translateY(-4px) scale(1.04);box-shadow:0 20px 56px #f7258577;}
        .btn-ghost{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.14);border-radius:16px;padding:18px 44px;font-size:17px;font-weight:700;color:#d0d0f0;cursor:pointer;backdrop-filter:blur(10px);transition:all .2s;letter-spacing:.3px;}
        .btn-ghost:hover{background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.28);color:#fff;transform:translateY(-2px);}

        /* ── Marquee ── */
        @keyframes marqueeScroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}

        /* ── Glows ── */
        @keyframes pulseGlow{0%,100%{box-shadow:0 0 32px #f7258555,0 0 80px #f7258520;}50%{box-shadow:0 0 64px #f7258588,0 0 140px #f7258540;}}
        @keyframes floatY{0%,100%{transform:translateY(0);}50%{transform:translateY(-14px);}}
        @keyframes spinSlow{to{transform:rotate(360deg);}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}

        /* ── Grids ── */
        .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;}
        .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
        .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
        .grid-auto{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;}
        .grid-feat{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:18px;}
        @media(max-width:900px){.grid-4{grid-template-columns:1fr 1fr;}.grid-3{grid-template-columns:1fr 1fr;}.grid-2{grid-template-columns:1fr;}}
        @media(max-width:600px){.grid-4{grid-template-columns:1fr 1fr;}.grid-3{grid-template-columns:1fr;}}

        /* ── Section ── */
        .section{padding:130px 40px;max-width:1200px;margin:0 auto;}
        @media(max-width:768px){.section{padding:90px 22px;}}

        /* ── FAQ ── */
        .faq-item{border:1px solid rgba(255,255,255,0.08);border-radius:18px;margin-bottom:12px;overflow:hidden;cursor:pointer;transition:border-color .3s,background .3s;}
        .faq-item:hover{border-color:rgba(247,37,133,.3);background:rgba(247,37,133,.03);}
        .faq-q{padding:22px 26px;font-size:15px;font-weight:700;color:#e8e8ff;display:flex;justify-content:space-between;align-items:center;gap:16px;}
        .faq-a{padding:0 26px;font-size:14px;color:#9090b0;line-height:1.8;max-height:0;overflow:hidden;transition:max-height .45s ease,padding .3s;}
        .faq-a.open{max-height:220px;padding:0 26px 22px;}
        .faq-arrow{font-size:20px;color:#555577;transition:transform .3s,color .3s;flex-shrink:0;}
        .faq-arrow.open{transform:rotate(180deg);color:#f72585;}

        /* ── Footer ── */
        .footer-link{display:block;font-size:14px;color:#606088;text-decoration:none;margin-bottom:14px;transition:color .2s;}
        .footer-link:hover{color:#c0c0e0;}
        .footer-label{font-size:10px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#444466;margin-bottom:20px;}

        /* ── Divider ── */
        .divider{height:1px;background:linear-gradient(90deg,transparent,rgba(247,37,133,.3),rgba(76,201,240,.3),transparent);margin:0;}

        /* ── Scroll indicator ── */
        @keyframes scrollBounce{0%,100%{transform:translateY(0);}50%{transform:translateY(8px);}}

        /* ── Stat block ── */
        .stat-block{text-align:center;padding:32px 24px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:24px;backdrop-filter:blur(20px);}
      `}</style>

      {/* ══ NAV ══ */}
      <nav className={`nav ${navSolid?'solid':''}`}>
        <div className="nav-logo" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}>HUSHPOD</div>
        <div className="nav-links">
          {[['how','How It Works'],['features','Features'],['cases','Use Cases'],['tech','Tech'],['faq','FAQ']].map(([id,l])=>(
            <a key={id} href={`#${id}`} onClick={e=>{e.preventDefault();nav(id);}}>{l}</a>
          ))}
        </div>
        <button className="nav-cta" onClick={go}>Start Free →</button>
      </nav>

      {/* ══ HERO ══ */}
      <section style={{position:'relative',minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',overflow:'hidden',padding:'120px 28px 80px',textAlign:'center'}}>
        <HeroScene/>

        {/* Deep space glow */}
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'900px',height:'900px',background:'radial-gradient(circle,rgba(247,37,133,.12) 0%,rgba(76,201,240,.06) 40%,transparent 70%)',pointerEvents:'none',zIndex:1}}/>
        {/* Scanline */}
        <div style={{position:'absolute',inset:0,backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.02) 3px,rgba(0,0,0,.02) 4px)',pointerEvents:'none',zIndex:1}}/>

        <div style={{position:'relative',zIndex:2,maxWidth:'880px',width:'100%'}}>

          {/* Live badge */}
          <Reveal delay={0}>
            <div style={{display:'inline-flex',alignItems:'center',gap:'10px',background:'rgba(247,37,133,.1)',border:'1px solid rgba(247,37,133,.35)',borderRadius:'30px',padding:'8px 20px',marginBottom:'36px',fontSize:'12px',fontWeight:'800',letterSpacing:'3px',textTransform:'uppercase',color:'#ff6eb5'}}>
              <span style={{width:8,height:8,borderRadius:'50%',background:'#f72585',display:'inline-block',animation:'pulseGlow 2s infinite'}}/>
              Live · Synchronized · Private
            </div>
          </Reveal>

          {/* Main title */}
          <Reveal delay={0.1} y={80} scale>
            <h1 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(88px,17vw,190px)',lineHeight:.86,letterSpacing:'-4px',margin:'0 0 32px',background:'linear-gradient(170deg,#ffffff 0%,#ffffff 30%,#f72585 65%,#4cc9f0 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',filter:'drop-shadow(0 0 60px rgba(247,37,133,.45))'}}>
              HEAR<br/>TOGETHER
            </h1>
          </Reveal>

          {/* Sub */}
          <Reveal delay={0.2}>
            <p style={{fontSize:'clamp(16px,2.4vw,21px)',color:'#c0c0e0',lineHeight:1.8,maxWidth:'640px',margin:'0 auto 48px',fontWeight:400}}>
              Real-time synchronized audio for groups.<br/>
              <strong style={{color:'#ffffff',fontWeight:800}}>No app. No account. No lag.</strong><br/>
              Create a room and everyone hears the same beat at the exact same millisecond.
            </p>
          </Reveal>

          {/* CTA buttons */}
          <Reveal delay={0.3}>
            <div style={{display:'flex',gap:'16px',justifyContent:'center',flexWrap:'wrap',marginBottom:'70px'}}>
              <button className="btn-primary" style={{animation:'pulseGlow 3s ease-in-out infinite'}} onClick={go}>🎉 Create a Room Free</button>
              <button className="btn-ghost" onClick={()=>nav('how')}>See How It Works ↓</button>
            </div>
          </Reveal>

          {/* Live stats row */}
          <Reveal delay={0.4}>
            <div className="grid-4" style={{marginBottom:'48px'}}>
              {[
                {v:stats.rooms,u:'',l:'Active Rooms',c:'#f72585'},
                {v:stats.listeners,u:'',l:'Live Listeners',c:'#4cc9f0'},
                {v:'<100',u:'ms',l:'Sync Precision',c:'#06d6a0'},
                {v:'0',u:'KB',l:'Data Stored',c:'#ffd60a'},
              ].map(({v,u,l,c},i)=>(
                <div key={l} className="stat-block">
                  <Count value={v} unit={u} color={c} delay={.4+i*.08} size="clamp(32px,5vw,52px)"/>
                  <div style={{fontSize:'11px',fontWeight:'700',letterSpacing:'2px',textTransform:'uppercase',color:'#555577',marginTop:'8px'}}>{l}</div>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Floating user tags */}
          <Reveal delay={0.55}>
            <div style={{display:'flex',flexWrap:'wrap',gap:'10px',justifyContent:'center'}}>
              {[['Arjun','iPhone 15','247,37,133'],['Priya','Galaxy S24','76,201,240'],['Meera','Pixel 8','6,214,160'],['Ravi','MacBook','255,214,10'],['Sara','OnePlus 12','123,47,247']].map(([n,d,c])=>(
                <Tag key={n} name={n} device={d} color={c}/>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Scroll hint */}
        <div style={{position:'absolute',bottom:'30px',left:'50%',transform:'translateX(-50%)',zIndex:2,display:'flex',flexDirection:'column',alignItems:'center',gap:'8px',opacity:.4}}>
          <span style={{fontSize:'10px',letterSpacing:'4px',textTransform:'uppercase',color:'#888899',fontFamily:"'JetBrains Mono',monospace"}}>Scroll</span>
          <div style={{fontSize:'24px',color:'#888899',animation:'scrollBounce 2s ease-in-out infinite'}}>↓</div>
        </div>
      </section>

      {/* ══ MARQUEE STRIP ══ */}
      <div className="divider"/>
      <MarqueeStrip/>
      <div className="divider"/>

      {/* ══ HOW IT WORKS ══ */}
      <section id="how" style={{padding:'130px 40px',background:'linear-gradient(180deg,#050510 0%,#0a0a20 50%,#050510 100%)'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto'}}>
          <Reveal>
            <div style={{textAlign:'center',marginBottom:'72px'}}>
              <div style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'rgba(247,37,133,.1)',border:'1px solid rgba(247,37,133,.3)',borderRadius:'24px',padding:'7px 18px',marginBottom:'20px',fontSize:'11px',fontWeight:'800',letterSpacing:'3px',textTransform:'uppercase',color:'#ff6eb5'}}>⚡ Four Steps</div>
              <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(52px,8vw,96px)',lineHeight:.9,color:'#fff',marginBottom:'20px',letterSpacing:'-2px'}}>Zero friction.<br/>Instant sync.</h2>
              <p style={{fontSize:'18px',color:'#9090b0',lineHeight:1.75,maxWidth:'520px',margin:'0 auto'}}>No downloads. No accounts. Works in any browser on any device, anywhere in the world.</p>
            </div>
          </Reveal>

          <div className="grid-4">
            <StepCard n="01" icon="🎙️" title="Create a Room" color="#f72585" delay={0}
              desc="Enter your name, tap Create. Get a unique 5-char code. Upload up to 10 songs — MP3, WAV, FLAC, AAC all supported." />
            <StepCard n="02" icon="📲" title="Share the Code" color="#4cc9f0" delay={0.1}
              desc="Send the room code or scan the QR. Friends open HushPod in any browser, type the code — they're in instantly." />
            <StepCard n="03" icon="🎧" title="Listen Together" color="#06d6a0" delay={0.2}
              desc="Everyone hears the same audio at the same millisecond. Host controls playback. Guests react and suggest songs." />
            <StepCard n="04" icon="👑" title="Pass the Aux" color="#ffd60a" delay={0.3}
              desc="Promote guests to DJ. Transfer host crown. If host leaves, next listener auto-promotes. Party never stops." />
          </div>
        </div>
      </section>

      {/* ══ FEATURES ══ */}
      <section id="features" className="section">
        <Reveal style={{textAlign:'center',marginBottom:'72px'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'rgba(76,201,240,.1)',border:'1px solid rgba(76,201,240,.3)',borderRadius:'24px',padding:'7px 18px',marginBottom:'20px',fontSize:'11px',fontWeight:'800',letterSpacing:'3px',textTransform:'uppercase',color:'#4cc9f0'}}>✨ Everything Included</div>
          <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(52px,8vw,96px)',lineHeight:.9,color:'#fff',marginBottom:'20px',letterSpacing:'-2px'}}>Built for real<br/>group experiences</h2>
          <p style={{fontSize:'18px',color:'#9090b0',lineHeight:1.75,maxWidth:'520px',margin:'0 auto'}}>Every feature engineered for precision, reliability, and zero friction.</p>
        </Reveal>

        <div className="grid-feat">
          {[
            {icon:'🔴',t:'Dead Reckoning Sync',d:'Between heartbeats, guests mathematically calculate the host\'s exact playback position — drift never accumulates.',live:true},
            {icon:'⚡',t:'Atomic Playback Start',d:'All devices receive a future timestamp to begin simultaneously — true atomic sync from the very first beat.',live:true},
            {icon:'🎧',t:'BT Auto-Detection',d:'Bluetooth headphones auto-detected. Latency profile applied instantly using 13-device codec database. Mid-session swaps handled.',live:true},
            {icon:'📦',t:'Batch Upload (10 Songs)',d:'Full setlist upload at once. Auto-advance plays next song. Drag-and-drop reorder. Guest upvoting system.',live:true},
            {icon:'💬',t:'Chat + Emoji Reactions',d:'Real-time chat. Floating emoji reactions (🔥❤️🎵🎉) animate over the screen. Typing indicators. Instant delivery.',live:true},
            {icon:'🔗',t:'QR Code Sharing',d:'One tap generates a QR code for your room. Anyone scans to join instantly. URL auto-fills room code on landing.',live:true},
            {icon:'🌙',t:'Screen-off Resilience',d:'Wake Lock prevents OS from killing audio. Tab restore re-syncs to the exact correct millisecond within 200ms.',live:true},
            {icon:'🔒',t:'Zero Data Retention',d:'Audio lives in RAM only. Room ends → everything permanently deleted. No logs, no storage, no accounts, ever.',live:true},
            {icon:'🔔',t:'Lock Screen Controls',d:'Full Media Session API — play, pause, skip from your lock screen or notification shade. Custom artwork per room.',live:true},
            {icon:'🔑',t:'Password Protection',d:'Optionally lock rooms with a password. 30-second host reconnect grace period. Admin and DJ permission system.',live:true},
            {icon:'📊',t:'Play History',d:'Full session history of every song played with timestamps. Collapsible in the DJ Desk. Persists for late joiners.',live:true},
            {icon:'♾️',t:'Unlimited Rooms',d:'Premium plans with unlimited listeners, rooms, and lossless audio quality coming soon for larger events.',live:false},
          ].map((f,i)=><FeatCard key={f.t} {...f} delay={(i%4)*.07}/>)}
        </div>
      </section>

      {/* ══ USE CASES ══ */}
      <section id="cases" style={{padding:'130px 40px',background:'linear-gradient(180deg,#050510 0%,#08081a 50%,#050510 100%)'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto'}}>
          <Reveal style={{textAlign:'center',marginBottom:'72px'}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'rgba(6,214,160,.1)',border:'1px solid rgba(6,214,160,.3)',borderRadius:'24px',padding:'7px 18px',marginBottom:'20px',fontSize:'11px',fontWeight:'800',letterSpacing:'3px',textTransform:'uppercase',color:'#06d6a0'}}>🌍 Use Cases</div>
            <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(52px,8vw,96px)',lineHeight:.9,color:'#fff',marginBottom:'20px',letterSpacing:'-2px'}}>Made for every<br/>shared moment</h2>
            <p style={{fontSize:'18px',color:'#9090b0',lineHeight:1.75,maxWidth:'520px',margin:'0 auto'}}>From silent discos to gym classes — HushPod makes group audio effortless.</p>
          </Reveal>

          <div className="grid-3">
            <CaseCard emoji="🎉" title="Silent Disco Parties" delay={0}
              desc="Replace expensive FM transmitters. Everyone dances to the same beat through their own earphones. No hardware, no clashes."
              grad="linear-gradient(135deg,rgba(247,37,133,.14),rgba(123,47,247,.14))" border="rgba(247,37,133,.25)"/>
            <CaseCard emoji="📚" title="Synchronized Study" delay={0.1}
              desc="Study with friends across locations. Everyone hears the same lo-fi at the same moment — shared focus atmosphere."
              grad="linear-gradient(135deg,rgba(76,201,240,.14),rgba(0,180,216,.14))" border="rgba(76,201,240,.25)"/>
            <CaseCard emoji="🚗" title="Road Trips" delay={0.2}
              desc="Different cars, same song, same millisecond. The convoy moves to one beat. Host controls the vibe for the whole group."
              grad="linear-gradient(135deg,rgba(6,214,160,.14),rgba(0,168,107,.14))" border="rgba(6,214,160,.25)"/>
            <CaseCard emoji="🏋️" title="Gym Classes" delay={0.3}
              desc="Sync workout music to every participant. No expensive sound system — just HushPod and everyone's Bluetooth speakers."
              grad="linear-gradient(135deg,rgba(255,214,10,.14),rgba(247,127,0,.14))" border="rgba(255,214,10,.25)"/>
            <CaseCard emoji="🎬" title="Remote Watch Parties" delay={0.4}
              desc="Sync ambient music for virtual gatherings. Everyone feels like they're in the same room even when continents apart."
              grad="linear-gradient(135deg,rgba(247,37,133,.10),rgba(76,201,240,.10))" border="rgba(247,37,133,.20)"/>
            <CaseCard emoji="🏛️" title="Audio Tours" delay={0.5}
              desc="Museums sync audio guides to every visitor simultaneously. Guide controls the pace. Everyone hears the same narration."
              grad="linear-gradient(135deg,rgba(123,47,247,.14),rgba(76,201,240,.14))" border="rgba(123,47,247,.25)"/>
          </div>
        </div>
      </section>

      {/* ══ TECH DEEP DIVE ══ */}
      <section id="tech" className="section">
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'80px',alignItems:'center'}}>
          <div>
            <Reveal x={-50}>
              <div style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'rgba(123,47,247,.1)',border:'1px solid rgba(123,47,247,.35)',borderRadius:'24px',padding:'7px 18px',marginBottom:'20px',fontSize:'11px',fontWeight:'800',letterSpacing:'3px',textTransform:'uppercase',color:'#bb86fc'}}>🔬 Under the Hood</div>
              <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(44px,6vw,80px)',lineHeight:.9,color:'#fff',marginBottom:'24px',letterSpacing:'-1px'}}>Engineered for<br/>precision</h2>
              <p style={{fontSize:'17px',color:'#8888a8',lineHeight:1.8,marginBottom:'44px'}}>Every millisecond matters. Our sync engine is built from first principles to eliminate every source of drift.</p>
            </Reveal>
            {[
              {icon:'⏱️',t:'Server-stamped timestamps',d:'Every event stamped with server Date.now() — all guests reference the same clock, eliminating per-device drift.'},
              {icon:'📐',t:'Seeked-event recalculation',d:'After seeking, we wait for the browser\'s seeked event then recalculate — absorbing 100–200ms mobile seek latency.'},
              {icon:'🧭',t:'Dead reckoning at 60fps',d:'Between heartbeats, the sync engine calculates the exact position mathematically — drift never accumulates.'},
              {icon:'🎙️',t:'Sonar acoustic calibration',d:'Optional physical ping-and-measure latency calibration using the device microphone — physical air delay measured.'},
            ].map((item,i)=>(
              <Reveal key={item.t} delay={i*.1} x={-30}>
                <div style={{display:'flex',gap:'18px',marginBottom:'20px',padding:'20px 22px',borderRadius:'18px',background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.07)',transition:'border-color .3s'}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(123,47,247,.3)'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(255,255,255,.07)'}>
                  <span style={{fontSize:'26px',flexShrink:0,marginTop:'2px'}}>{item.icon}</span>
                  <div>
                    <div style={{fontWeight:'800',fontSize:'14px',color:'#e0e0ff',marginBottom:'6px'}}>{item.t}</div>
                    <div style={{fontSize:'13px',color:'#8080a0',lineHeight:1.75}}>{item.d}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal x={50}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
              {[
                {v:'100',u:'ms',l:'Sync Precision',c:'#f72585',d:.1},
                {v:'500',u:'ms',l:'Heartbeat Rate',c:'#4cc9f0',d:.2},
                {v:'150',u:'MB',l:'Max File Size',c:'#06d6a0',d:.3},
                {v:'10',u:'',l:'Songs Per Batch',c:'#ffd60a',d:.4},
                {v:'8',u:'x',l:'Clock Samples',c:'#7b2ff7',d:.5},
                {v:'0',u:'KB',l:'Data Retained',c:'#f72585',d:.6},
              ].map(s=>(
                <Tilt key={s.l} s={12}>
                  <div style={{background:'rgba(255,255,255,.025)',border:`1px solid ${s.c}25`,borderRadius:'20px',padding:'28px 20px',textAlign:'center',boxShadow:`0 0 30px ${s.c}15,inset 0 0 20px ${s.c}08`,transition:'box-shadow .3s'}}
                    onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 0 50px ${s.c}30,inset 0 0 30px ${s.c}12`}
                    onMouseLeave={e=>e.currentTarget.style.boxShadow=`0 0 30px ${s.c}15,inset 0 0 20px ${s.c}08`}>
                    <Count value={s.v} unit={s.u} color={s.c} delay={s.d} size="clamp(32px,4vw,48px)"/>
                    <div style={{fontSize:'10px',fontWeight:'800',letterSpacing:'2px',textTransform:'uppercase',color:'#555577',marginTop:'10px'}}>{s.l}</div>
                  </div>
                </Tilt>
              ))}
            </div>
          </Reveal>
        </div>

        <style>{`@media(max-width:860px){#tech .section>div{grid-template-columns:1fr!important;gap:50px;}}`}</style>
      </section>

      {/* ══ FAQ ══ */}
      <section id="faq" style={{padding:'130px 40px',background:'linear-gradient(180deg,#050510 0%,#08081a 50%,#050510 100%)'}}>
        <div style={{maxWidth:'780px',margin:'0 auto'}}>
          <Reveal style={{textAlign:'center',marginBottom:'60px'}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'rgba(255,214,10,.08)',border:'1px solid rgba(255,214,10,.25)',borderRadius:'24px',padding:'7px 18px',marginBottom:'20px',fontSize:'11px',fontWeight:'800',letterSpacing:'3px',textTransform:'uppercase',color:'#ffd60a'}}>❓ FAQ</div>
            <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(52px,8vw,96px)',lineHeight:.9,color:'#fff',letterSpacing:'-2px'}}>Common questions</h2>
          </Reveal>

          {[
            {q:'Do guests need to download an app?',a:'No. HushPod works entirely in the browser. Guests open the link, enter the room code, and they\'re synced instantly — no installation, no account needed.'},
            {q:'Does everyone need the same WiFi?',a:'No. HushPod works over the internet — different networks, mobile data, different cities, countries. The sync engine handles network variance automatically.'},
            {q:'What audio formats are supported?',a:'MP3, WAV, FLAC, AAC and most common audio formats. Files up to 150MB each. Upload up to 10 songs at a time for a full session setlist.'},
            {q:'Is my music stored on HushPod servers?',a:'Never permanently. Audio is held in server RAM only during your active session. The moment your room ends, everything is permanently deleted. Zero data retained.'},
            {q:'What happens if the host leaves?',a:'The longest-connected listener auto-promotes to host. Hosts get a 30-second grace period to reconnect and reclaim their crown without disrupting the session.'},
            {q:'How many people can join a room?',a:'Free rooms support up to 15 simultaneous listeners. Premium plans with unlimited listeners are coming soon for larger events and enterprise use.'},
            {q:'Can I use copyrighted music?',a:'You are responsible for any content you upload. By accepting our Terms of Service, you confirm you own or have the rights to share any audio in HushPod rooms.'},
          ].map((f,i)=>(
            <Reveal key={i} delay={i*.05}>
              <div className="faq-item" onClick={()=>setOpenFaq(openFaq===i?null:i)}>
                <div className="faq-q"><span>{f.q}</span><span className={`faq-arrow ${openFaq===i?'open':''}`}>▾</span></div>
                <div className={`faq-a ${openFaq===i?'open':''}`}>{f.a}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══ FINAL CTA ══ */}
      <section style={{padding:'160px 40px',textAlign:'center',position:'relative',overflow:'hidden'}}>
        {/* Massive glow */}
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'900px',height:'600px',background:'radial-gradient(ellipse,rgba(247,37,133,.18) 0%,rgba(123,47,247,.10) 40%,transparent 70%)',pointerEvents:'none'}}/>
        {/* Grid lines */}
        <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(247,37,133,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(247,37,133,.04) 1px,transparent 1px)',backgroundSize:'60px 60px',pointerEvents:'none'}}/>

        <div style={{position:'relative',zIndex:1}}>
          <Reveal>
            <div style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'rgba(247,37,133,.12)',border:'1px solid rgba(247,37,133,.35)',borderRadius:'30px',padding:'8px 20px',marginBottom:'32px',fontSize:'12px',fontWeight:'800',letterSpacing:'3px',textTransform:'uppercase',color:'#ff6eb5'}}>🎧 Start Free Today</div>
          </Reveal>

          <Reveal delay={0.1} y={80} scale>
            <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(80px,15vw,180px)',lineHeight:.86,letterSpacing:'-4px',background:'linear-gradient(160deg,#ffffff 0%,#ffffff 30%,#f72585 60%,#4cc9f0 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',filter:'drop-shadow(0 0 60px rgba(247,37,133,.4))',marginBottom:'32px'}}>
              LISTEN<br/>TOGETHER<br/>NOW
            </h2>
          </Reveal>

          <Reveal delay={0.2}>
            <p style={{fontSize:'20px',color:'#a0a0c0',marginBottom:'52px',lineHeight:1.8,maxWidth:'560px',margin:'0 auto 52px'}}>
              Create your first room in under 10 seconds.<br/>No sign-up. No credit card. Just music, perfectly in sync.
            </p>
          </Reveal>

          <Reveal delay={0.3}>
            <button className="btn-primary" style={{fontSize:'19px',padding:'22px 60px',animation:'pulseGlow 3s ease-in-out infinite'}} onClick={go}>
              🎉 Create a Free Room
            </button>
          </Reveal>

          {/* Social proof tags below CTA */}
          <Reveal delay={0.45}>
            <div style={{display:'flex',flexWrap:'wrap',gap:'10px',justifyContent:'center',marginTop:'48px',opacity:.7}}>
              {[['✅','No credit card'],['✅','No download'],['✅','No account'],['✅','Works globally'],['✅','Free forever (15 users)']].map(([ic,l])=>(
                <span key={l} style={{fontSize:'13px',color:'#7070a0',fontWeight:'600',display:'flex',alignItems:'center',gap:'6px'}}><span style={{color:'#06d6a0'}}>{ic}</span>{l}</span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <div className="divider"/>
      <footer style={{padding:'72px 40px 48px',maxWidth:'1200px',margin:'0 auto'}}>
        <div style={{display:'grid',gridTemplateColumns:'2.5fr 1fr 1fr',gap:'60px',marginBottom:'56px'}}>
          <div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'36px',letterSpacing:'5px',background:'linear-gradient(135deg,#f72585,#4cc9f0)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:'18px'}}>HUSHPOD</div>
            <p style={{fontSize:'14px',color:'#606088',lineHeight:1.8,maxWidth:'320px',marginBottom:'20px'}}>Synchronized private group audio. Listen together in perfect sync — no app, no account, no lag.</p>
            <p style={{fontSize:'12px',color:'#444466'}}>Built by <span style={{color:'#bb86fc',fontWeight:'800'}}>Zentry Hub Pvt Ltd</span></p>
          </div>
          <div>
            <div className="footer-label">Product</div>
            {[['Launch App',go],['Features',()=>nav('features')],['How It Works',()=>nav('how')],['Technology',()=>nav('tech')]].map(([l,fn])=>(
              <a key={l} className="footer-link" href="#" onClick={e=>{e.preventDefault();fn();}}>{l}</a>
            ))}
          </div>
          <div>
            <div className="footer-label">Company</div>
            <a className="footer-link" href="#" onClick={e=>{e.preventDefault();nav('faq');}}>FAQ</a>
            <a className="footer-link" href="#">Terms of Service</a>
            <a className="footer-link" href="mailto:contact@hushpod.app">Contact Us</a>
          </div>
        </div>
        <style>{`@media(max-width:768px){footer>div:first-child>div:first-child{grid-template-columns:1fr!important;gap:36px;}}`}</style>
        <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:'12px',paddingTop:'28px',borderTop:'1px solid rgba(255,255,255,.06)',fontSize:'12px',color:'#333355'}}>
          <span>© 2026 HushPod · Built with ♥ in India</span>
          <span style={{fontFamily:"'JetBrains Mono',monospace"}}>v2.0.0 · Node.js + Socket.io · Zero data retention</span>
        </div>
      </footer>

    </div>
  );
}