import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

/* ══════════════════════════════════════════════════════════════
   HUSHPOD — ULTRA INTERACTIVE HOME
   Interactions: custom cursor · magnetic buttons · cursor spotlight
   typewriter hero · interactive waveform · ripple clicks ·
   scroll progress bar · parallax depth layers · drag orb ·
   live room feed · noise overlay · sound wave visualizer
══════════════════════════════════════════════════════════════ */

/* ── Persistent reveal map ── */
const RM = new WeakMap();
function Reveal({ children, delay=0, y=55, x=0, scale=false, style={} }) {
  const r=useRef(null); const [v,setV]=useState(false);
  useEffect(()=>{
    const el=r.current; if(!el||RM.has(el))return;
    const obs=new IntersectionObserver(([e])=>{ if(e.isIntersecting){setV(true);obs.unobserve(el);RM.delete(el);} },{threshold:.01,rootMargin:'0px 0px -40px 0px'});
    obs.observe(el); RM.set(el,obs);
    return()=>{obs.unobserve(el);RM.delete(el);};
  },[]);
  return(
    <div ref={r} style={{opacity:v?1:0,transform:v?'none':[`translateY(${y}px)`,x?`translateX(${x}px)`:'',scale?'scale(.88)':''].filter(Boolean).join(' '),transition:`opacity .75s ease ${delay}s,transform .85s cubic-bezier(.16,1,.3,1) ${delay}s`,willChange:'transform,opacity',...style}}>
      {children}
    </div>
  );
}

/* ── Magnetic Button ── */
function Mag({ children, className='', style={}, onClick, strength=0.35 }) {
  const r=useRef(null);
  const move=useCallback(e=>{
    const el=r.current; if(!el)return;
    const b=el.getBoundingClientRect();
    const dx=(e.clientX-(b.left+b.width/2))*strength;
    const dy=(e.clientY-(b.top+b.height/2))*strength;
    el.style.transform=`translate(${dx}px,${dy}px) scale(1.06)`;
    el.style.transition='transform .15s ease';
  },[strength]);
  const leave=useCallback(()=>{
    if(r.current){r.current.style.transform='translate(0,0) scale(1)';r.current.style.transition='transform .5s cubic-bezier(.22,1,.36,1)';}
  },[]);
  return(
    <button ref={r} className={className} style={style} onClick={onClick} onMouseMove={move} onMouseLeave={leave}>
      {children}
    </button>
  );
}

/* ── Tilt ── */
function Tilt({children,s=10,style={},className=''}) {
  const r=useRef(null);
  const move=useCallback(e=>{
    const el=r.current; if(!el)return;
    const b=el.getBoundingClientRect();
    const dx=(e.clientX-(b.left+b.width/2))/(b.width/2);
    const dy=(e.clientY-(b.top+b.height/2))/(b.height/2);
    el.style.transform=`perspective(900px) rotateY(${dx*s}deg) rotateX(${-dy*s}deg) translateZ(18px)`;
    el.style.transition='transform .08s ease';
  },[s]);
  const leave=useCallback(()=>{
    if(r.current){r.current.style.transform='perspective(900px) rotateY(0) rotateX(0) translateZ(0)';r.current.style.transition='transform .6s cubic-bezier(.22,1,.36,1)';}
  },[]);
  return <div ref={r} onMouseMove={move} onMouseLeave={leave} style={{transformStyle:'preserve-3d',willChange:'transform',...style}} className={className}>{children}</div>;
}

/* ── Custom Cursor ── */
function Cursor() {
  const dot=useRef(null); const ring=useRef(null);
  const pos=useRef({x:0,y:0}); const target=useRef({x:0,y:0});
  const [hovering,setHovering]=useState(false);
  useEffect(()=>{
    const onMove=e=>{
      target.current={x:e.clientX,y:e.clientY};
      if(dot.current){dot.current.style.left=e.clientX+'px';dot.current.style.top=e.clientY+'px';}
      const el=document.elementFromPoint(e.clientX,e.clientY);
      const isHover=el&&(el.tagName==='BUTTON'||el.tagName==='A'||el.closest('button')||el.closest('a'));
      setHovering(!!isHover);
    };
    const animate=()=>{
      pos.current.x+=(target.current.x-pos.current.x)*.12;
      pos.current.y+=(target.current.y-pos.current.y)*.12;
      if(ring.current){ring.current.style.left=pos.current.x+'px';ring.current.style.top=pos.current.y+'px';}
      requestAnimationFrame(animate);
    };
    window.addEventListener('mousemove',onMove);
    animate();
    return()=>window.removeEventListener('mousemove',onMove);
  },[]);
  return(
    <>
      <div ref={dot} style={{position:'fixed',width:'6px',height:'6px',borderRadius:'50%',background:'#f72585',pointerEvents:'none',zIndex:9999,transform:'translate(-50%,-50%)',transition:'background .3s',boxShadow:'0 0 10px #f72585'}}/>
      <div ref={ring} style={{position:'fixed',width:hovering?'50px':'28px',height:hovering?'50px':'28px',borderRadius:'50%',border:`1.5px solid ${hovering?'#4cc9f0':'rgba(247,37,133,.6)'}`,pointerEvents:'none',zIndex:9998,transform:'translate(-50%,-50%)',transition:'width .25s,height .25s,border-color .25s',backdropFilter:'invert(0%)',mixBlendMode:'difference'}}/>
    </>
  );
}

/* ── Cursor Spotlight ── */
function Spotlight() {
  const r=useRef(null);
  useEffect(()=>{
    const move=e=>{
      if(r.current) r.current.style.background=`radial-gradient(300px circle at ${e.clientX}px ${e.clientY}px,rgba(247,37,133,.07),transparent 70%)`;
    };
    window.addEventListener('mousemove',move);
    return()=>window.removeEventListener('mousemove',move);
  },[]);
  return <div ref={r} style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:2,transition:'background .1s'}}/>;
}

/* ── Scroll Progress Bar ── */
function ScrollProgress() {
  const [pct,setPct]=useState(0);
  useEffect(()=>{
    const fn=()=>{
      const h=document.documentElement.scrollHeight-window.innerHeight;
      setPct(h?window.scrollY/h*100:0);
    };
    window.addEventListener('scroll',fn,{passive:true});
    return()=>window.removeEventListener('scroll',fn);
  },[]);
  return(
    <div style={{position:'fixed',top:0,left:0,right:0,height:'2px',zIndex:10000,background:'transparent'}}>
      <div style={{height:'100%',width:pct+'%',background:'linear-gradient(90deg,#f72585,#7b2ff7,#4cc9f0)',transition:'width .1s',boxShadow:'0 0 8px #f72585'}}/>
    </div>
  );
}

/* ── Typewriter ── */
function Typewriter({ words, speed=80, pause=2000 }) {
  const [text,setText]=useState('');
  const [wi,setWi]=useState(0);
  const [ci,setCi]=useState(0);
  const [del,setDel]=useState(false);
  useEffect(()=>{
    const w=words[wi];
    if(!del){
      if(ci<w.length){const t=setTimeout(()=>{setText(w.slice(0,ci+1));setCi(c=>c+1);},speed);return()=>clearTimeout(t);}
      else{const t=setTimeout(()=>setDel(true),pause);return()=>clearTimeout(t);}
    } else {
      if(ci>0){const t=setTimeout(()=>{setText(w.slice(0,ci-1));setCi(c=>c-1);},speed/2);return()=>clearTimeout(t);}
      else{setDel(false);setWi(i=>(i+1)%words.length);}
    }
  },[ci,del,wi,words,speed,pause]);
  return(
    <span style={{borderRight:'3px solid #f72585',paddingRight:'4px',animation:'blink .8s step-end infinite'}}>{text}</span>
  );
}

/* ── Ripple ── */
function useRipple() {
  const [ripples,setRipples]=useState([]);
  const add=useCallback(e=>{
    const id=Date.now()+Math.random();
    setRipples(r=>[...r,{id,x:e.clientX,y:e.clientY}]);
    setTimeout(()=>setRipples(r=>r.filter(rr=>rr.id!==id)),900);
  },[]);
  return [ripples,add];
}

/* ── Interactive Waveform ── */
function Waveform({ playing=true }) {
  const canRef=useRef(null);
  const mouse=useRef({x:.5,y:.5});
  useEffect(()=>{
    const c=canRef.current; if(!c)return;
    const ctx=c.getContext('2d');
    let t=0,raf;
    const resize=()=>{c.width=c.offsetWidth;c.height=c.offsetHeight;};
    resize(); window.addEventListener('resize',resize);
    const onMove=e=>{const b=c.getBoundingClientRect();mouse.current={x:(e.clientX-b.left)/b.width,y:(e.clientY-b.top)/b.height};};
    c.addEventListener('mousemove',onMove);
    const draw=()=>{
      raf=requestAnimationFrame(draw);
      if(!playing){ctx.clearRect(0,0,c.width,c.height);return;}
      t+=.025;
      ctx.clearRect(0,0,c.width,c.height);
      const W=c.width,H=c.height,cx=H/2;
      const mx=mouse.current.x, my=mouse.current.y;
      const waves=[
        {color:'#f72585',amp:30+my*40,freq:2+mx*2,phase:0,alpha:.9},
        {color:'#4cc9f0',amp:20+my*30,freq:3+mx*1.5,phase:1.2,alpha:.7},
        {color:'#06d6a0',amp:15+my*20,freq:4+mx,phase:2.4,alpha:.5},
        {color:'#7b2ff7',amp:10+my*15,freq:5,phase:.8,alpha:.35},
      ];
      waves.forEach(({color,amp,freq,phase,alpha})=>{
        ctx.beginPath();
        for(let x=0;x<W;x++){
          const y=cx+Math.sin((x/W)*Math.PI*2*freq+t+phase)*amp+Math.sin((x/W)*Math.PI*4+t*1.3+phase)*(amp*.4);
          x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
        }
        ctx.strokeStyle=color;
        ctx.lineWidth=2;
        ctx.globalAlpha=alpha;
        ctx.stroke();
        ctx.globalAlpha=1;
      });
    };
    draw();
    return()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',resize);c.removeEventListener('mousemove',onMove);};
  },[playing]);
  return <canvas ref={canRef} style={{width:'100%',height:'100%',display:'block'}}/>;
}

/* ── Live Room Feed ── */
const NAMES=['Arjun','Priya','Ravi','Meera','Sara','Kiran','Ananya','Dev','Shreya','Rohit','Nisha','Vikram'];
const ACTIONS=['joined a room','created a party','is now hosting','connected via BT','passed the aux','added 3 songs','is now DJing'];
function LiveFeed() {
  const [items,setItems]=useState([]);
  useEffect(()=>{
    const add=()=>{
      const n=NAMES[Math.floor(Math.random()*NAMES.length)];
      const a=ACTIONS[Math.floor(Math.random()*ACTIONS.length)];
      const id=Date.now();
      setItems(i=>[{id,n,a},...i.slice(0,4)]);
    };
    add();
    const id=setInterval(add,3200);
    return()=>clearInterval(id);
  },[]);
  return(
    <div style={{display:'flex',flexDirection:'column',gap:'8px',maxWidth:'320px'}}>
      {items.map((item,i)=>(
        <div key={item.id} style={{display:'flex',alignItems:'center',gap:'10px',background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',borderRadius:'12px',padding:'10px 14px',opacity:1-i*.18,transform:`scale(${1-i*.02})`,transition:'all .4s ease',animation:i===0?'slideIn .4s ease':'none'}}>
          <div style={{width:'28px',height:'28px',borderRadius:'50%',background:`hsl(${(item.n.charCodeAt(0)*17)%360},70%,55%)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:'800',color:'#fff',flexShrink:0}}>{item.n[0]}</div>
          <div>
            <span style={{fontSize:'12px',fontWeight:'700',color:'#e0e0ff'}}>{item.n}</span>
            <span style={{fontSize:'12px',color:'#6666aa'}}> {item.a}</span>
          </div>
          <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#06d6a0',boxShadow:'0 0 6px #06d6a0',flexShrink:0,marginLeft:'auto'}}/>
        </div>
      ))}
    </div>
  );
}

/* ── Three.js Hero (enhanced) ── */
function HeroScene({ mouseRef }) {
  const mount=useRef(null);
  useEffect(()=>{
    const el=mount.current; if(!el)return;
    const W=el.clientWidth,H=el.clientHeight,isMob=window.innerWidth<600;
    const scene=new THREE.Scene();
    const cam=new THREE.PerspectiveCamera(55,W/H,.1,300);
    cam.position.set(0,0,isMob?26:18);
    const rdr=new THREE.WebGLRenderer({antialias:!isMob,alpha:true});
    rdr.setPixelRatio(Math.min(window.devicePixelRatio,2));
    rdr.setSize(W,H); rdr.setClearColor(0,0);
    el.appendChild(rdr.domElement);
    /* Icosahedra */
    const icoA=new THREE.Mesh(new THREE.IcosahedronGeometry(5.5,2),new THREE.MeshBasicMaterial({color:0xf72585,wireframe:true,transparent:true,opacity:.15}));
    const icoB=new THREE.Mesh(new THREE.IcosahedronGeometry(3.8,1),new THREE.MeshBasicMaterial({color:0x4cc9f0,wireframe:true,transparent:true,opacity:.12}));
    const icoC=new THREE.Mesh(new THREE.IcosahedronGeometry(7.2,1),new THREE.MeshBasicMaterial({color:0x7b2ff7,wireframe:true,transparent:true,opacity:.07}));
    scene.add(icoA,icoB,icoC);
    /* Knot */
    const knot=new THREE.Mesh(new THREE.TorusKnotGeometry(2,0.42,140,18,3,5),new THREE.MeshStandardMaterial({color:0xf72585,emissive:0xf72585,emissiveIntensity:.5,metalness:.9,roughness:.1}));
    scene.add(knot);
    /* Rings */
    const N=isMob?100:200,R=8;
    const mkRing=(col,sc=1,rx=0)=>{
      const geo=new THREE.BufferGeometry();
      const pos=new Float32Array(N*3),base=[];
      for(let i=0;i<N;i++){const a=(i/N)*Math.PI*2;pos[i*3]=Math.cos(a)*R*sc;pos[i*3+1]=0;pos[i*3+2]=Math.sin(a)*R*sc;base.push(a);}
      geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
      const loop=new THREE.LineLoop(geo,new THREE.LineBasicMaterial({color:col}));
      loop.rotation.x=rx; scene.add(loop); return{geo,loop,base};
    };
    const r1=mkRing(0xf72585,1,0),r2=mkRing(0x4cc9f0,.78,Math.PI/5),r3=mkRing(0x06d6a0,.55,-Math.PI/4);
    /* Particles */
    const NP=isMob?300:600,pPos=new Float32Array(NP*3),pCol=new Float32Array(NP*3);
    const PC=[[247,37,133],[76,201,240],[6,214,160],[123,47,247]];
    for(let i=0;i<NP;i++){
      const rr=8+Math.random()*18,th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1);
      pPos[i*3]=rr*Math.sin(ph)*Math.cos(th);pPos[i*3+1]=rr*Math.sin(ph)*Math.sin(th);pPos[i*3+2]=rr*Math.cos(ph);
      const c=PC[Math.floor(Math.random()*PC.length)];pCol[i*3]=c[0]/255;pCol[i*3+1]=c[1]/255;pCol[i*3+2]=c[2]/255;
    }
    const pGeo=new THREE.BufferGeometry();
    pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));
    pGeo.setAttribute('color',new THREE.BufferAttribute(pCol,3));
    const pts=new THREE.Points(pGeo,new THREE.PointsMaterial({size:.1,vertexColors:true,transparent:true,opacity:.9}));
    scene.add(pts);
    /* Lights */
    scene.add(new THREE.AmbientLight(0xffffff,.4));
    const lP=new THREE.PointLight(0xf72585,5,40);lP.position.set(8,5,5);scene.add(lP);
    const lC=new THREE.PointLight(0x4cc9f0,5,40);lC.position.set(-8,-5,5);scene.add(lC);
    const lG=new THREE.PointLight(0x7b2ff7,3,30);lG.position.set(0,10,-5);scene.add(lG);
    /* Resize */
    const onResize=()=>{const w=el.clientWidth,h=el.clientHeight;cam.aspect=w/h;cam.updateProjectionMatrix();rdr.setSize(w,h);};
    window.addEventListener('resize',onResize);
    let fid,t=0;
    const amp=[1.4,.9,.7,1.1,1,1.3];
    const animate=()=>{
      fid=requestAnimationFrame(animate);t+=.016;
      [r1,r2,r3].forEach(({geo,loop,base},gi)=>{
        const sc=[R,R*.78,R*.55][gi];const pos=geo.attributes.position;
        for(let i=0;i<N;i++){
          const a=base[i];
          const w=Math.sin(a*8+t*2.2+gi*1.4)*amp[i%6]*.55+Math.sin(a*3-t*1.8+gi*.9)*.35;
          const rr=sc+w;
          pos.setXYZ(i,Math.cos(a)*rr+w*.12,Math.sin(a*5+t*1.3+gi)*.5,Math.sin(a)*rr);
        }
        pos.needsUpdate=true;
      });
      r1.loop.rotation.y=t*.16;r1.loop.rotation.z=t*.05;
      r2.loop.rotation.y=-t*.20;r2.loop.rotation.z=t*.09;r2.loop.rotation.x=Math.PI/5+Math.sin(t*.25)*.1;
      r3.loop.rotation.y=t*.26;r3.loop.rotation.x=-Math.PI/4+Math.sin(t*.3)*.12;
      knot.rotation.x=t*.22;knot.rotation.y=t*.32;knot.scale.setScalar(1+Math.sin(t*1.4)*.045);
      icoA.rotation.x=t*.07;icoA.rotation.y=t*.11;
      icoB.rotation.x=-t*.09;icoB.rotation.y=t*.13;icoB.rotation.z=t*.05;
      icoC.rotation.y=t*.04;icoC.rotation.z=t*.03;
      pts.rotation.y=t*.035;pts.rotation.x=Math.sin(t*.08)*.04;
      /* Mouse parallax from ref */
      const mx=(mouseRef?.current?.x||.5)*2-1;
      const my=(mouseRef?.current?.y||.5)*2-1;
      scene.rotation.y+=(mx*.3-scene.rotation.y)*.04;
      scene.rotation.x+=(-my*.15-scene.rotation.x)*.04;
      lP.intensity=4+Math.sin(t*2.1)*2;lC.intensity=4+Math.sin(t*1.7+1)*2;lG.intensity=2+Math.sin(t*1.3+2)*1;
      rdr.render(scene,cam);
    };
    animate();
    return()=>{cancelAnimationFrame(fid);window.removeEventListener('resize',onResize);rdr.dispose();if(el.contains(rdr.domElement))el.removeChild(rdr.domElement);};
  },[]);
  return <div ref={mount} style={{position:'absolute',inset:0,zIndex:0,pointerEvents:'none'}}/>;
}

/* ── Marquee ── */
function Marquee({items,dir=1,speed=30}) {
  return(
    <div style={{overflow:'hidden',padding:'14px 0'}}>
      <div style={{display:'flex',gap:'48px',animation:`marquee${dir>0?'L':'R'} ${speed}s linear infinite`,width:'max-content'}}>
        {[...items,...items,...items].map((item,i)=>(
          <span key={i} style={{fontSize:'12px',fontWeight:'800',color:'#555577',letterSpacing:'2.5px',textTransform:'uppercase',flexShrink:0,whiteSpace:'nowrap'}}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Interactive Feature Demo ── */
function FeatureDemo() {
  const [active,setActive]=useState(0);
  const demos=[
    {icon:'🔴',title:'Dead Reckoning Sync',color:'#f72585',
      vis:<div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
        {['Host','Guest A','Guest B','Guest C'].map((n,i)=>(
          <div key={n} style={{display:'flex',alignItems:'center',gap:'12px'}}>
            <span style={{fontSize:'12px',color:'#888899',width:'62px',fontFamily:"'JetBrains Mono',monospace"}}>{n}</span>
            <div style={{flex:1,height:'6px',background:'rgba(255,255,255,.06)',borderRadius:'6px',overflow:'hidden',position:'relative'}}>
              <div style={{position:'absolute',top:0,left:0,height:'100%',borderRadius:'6px',background:i===0?'linear-gradient(90deg,#f72585,#7b2ff7)':'linear-gradient(90deg,#4cc9f0,#06d6a0)',width:`${75+i*2}%`,animation:`barPulse ${1.2+i*.3}s ease-in-out infinite alternate`}}/>
            </div>
            <span style={{fontSize:'11px',color:'#06d6a0',fontFamily:"'JetBrains Mono',monospace",width:'36px',textAlign:'right'}}>{i===0?'0ms':`${i*2}ms`}</span>
          </div>
        ))}
        <style>{`@keyframes barPulse{from{width:72%}to{width:78%}}`}</style>
      </div>
    },
    {icon:'🎧',title:'BT Auto-Detection',color:'#4cc9f0',
      vis:<div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
        {[['AirPods Pro','160ms','#4cc9f0',true],['Sony WH-1000XM5','220ms','#7b2ff7',true],['JBL Charge 5','240ms','#ffd60a',false],['Wired / Built-in','40ms','#06d6a0',true]].map(([d,l,c,ok])=>(
          <div key={d} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',background:'rgba(255,255,255,.03)',borderRadius:'10px',border:`1px solid ${ok?c+'33':'rgba(255,255,255,.05)'}`}}>
            <span style={{fontSize:'13px',color:'#c0c0e0'}}>{d}</span>
            <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
              <span style={{fontSize:'12px',color:c,fontFamily:"'JetBrains Mono',monospace",fontWeight:'700'}}>{l}</span>
              <span style={{fontSize:'11px',fontWeight:'800',color:ok?'#06d6a0':'#666688',letterSpacing:'1px'}}>{ok?'SYNCED':'—'}</span>
            </div>
          </div>
        ))}
      </div>
    },
    {icon:'💬',title:'Live Chat + Reactions',color:'#06d6a0',
      vis:<div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {[{n:'Arjun',t:'this bass drop is 🔥',c:'#f72585'},{n:'Priya',t:'match the vibe!!',c:'#4cc9f0'},{n:'Ravi',t:'Next — Daft Punk pls',c:'#06d6a0'}].map((m,i)=>(
          <div key={i} style={{display:'flex',gap:'10px',alignItems:'flex-start'}}>
            <div style={{width:'28px',height:'28px',borderRadius:'50%',background:`hsl(${m.c==='#f72585'?330:m.c==='#4cc9f0'?195:160},70%,55%)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:'800',color:'#fff',flexShrink:0}}>{m.n[0]}</div>
            <div style={{background:'rgba(255,255,255,.04)',borderRadius:'0 12px 12px 12px',padding:'8px 14px',maxWidth:'200px'}}>
              <div style={{fontSize:'11px',fontWeight:'800',color:m.c,marginBottom:'3px'}}>{m.n}</div>
              <div style={{fontSize:'13px',color:'#c0c0e0'}}>{m.t}</div>
            </div>
          </div>
        ))}
        <div style={{display:'flex',gap:'8px',justifyContent:'center',marginTop:'6px'}}>
          {['🔥','❤️','🎵','🎉','😂','👏'].map(e=>(
            <span key={e} style={{fontSize:'22px',cursor:'pointer',display:'inline-block',transition:'transform .15s',userSelect:'none'}}
              onMouseEnter={ev=>ev.target.style.transform='scale(1.4) translateY(-4px)'}
              onMouseLeave={ev=>ev.target.style.transform='scale(1)'}>{e}</span>
          ))}
        </div>
      </div>
    },
    {icon:'🎛️',title:'DJ Desk Controls',color:'#7b2ff7',
      vis:<div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
        <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:'12px'}}>
          {['⏮','⏪','⏸','⏩','⏭'].map((ic,i)=>(
            <div key={ic} style={{width:i===2?'52px':'38px',height:i===2?'52px':'38px',borderRadius:'50%',background:i===2?'linear-gradient(135deg,#f72585,#7b2ff7)':'rgba(255,255,255,.06)',border:i===2?'none':'1px solid rgba(255,255,255,.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:i===2?'20px':'15px',cursor:'pointer',transition:'all .2s',userSelect:'none'}}
              onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.12)';e.currentTarget.style.background=i===2?'linear-gradient(135deg,#ff4d9e,#9b4fff)':'rgba(255,255,255,.12)';}}
              onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.background=i===2?'linear-gradient(135deg,#f72585,#7b2ff7)':'rgba(255,255,255,.06)';}}
            >{ic}</div>
          ))}
        </div>
        <div style={{height:'6px',background:'rgba(255,255,255,.06)',borderRadius:'6px',overflow:'hidden',cursor:'pointer',position:'relative'}}
          onMouseMove={e=>{const b=e.currentTarget.getBoundingClientRect();e.currentTarget.children[0].style.width=((e.clientX-b.left)/b.width*100)+'%';}}>
          <div style={{height:'100%',width:'40%',background:'linear-gradient(90deg,#f72585,#4cc9f0)',borderRadius:'6px',transition:'width .1s',pointerEvents:'none'}}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:'11px',color:'#555577',fontFamily:"'JetBrains Mono',monospace"}}>
          <span>1:24</span><span>Blinding Lights — The Weeknd</span><span>3:20</span>
        </div>
      </div>
    },
  ];
  return(
    <div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:'16px',alignItems:'start'}}>
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {demos.map((d,i)=>(
          <button key={i} onClick={()=>setActive(i)} style={{display:'flex',alignItems:'center',gap:'12px',padding:'14px 18px',background:active===i?`rgba(${d.color==='#f72585'?'247,37,133':d.color==='#4cc9f0'?'76,201,240':d.color==='#06d6a0'?'6,214,160':'123,47,247'},.12)`:'rgba(255,255,255,.03)',border:`1px solid ${active===i?d.color+'44':'rgba(255,255,255,.07)'}`,borderRadius:'14px',cursor:'pointer',transition:'all .2s',textAlign:'left',color:'inherit',fontFamily:'inherit'}}>
            <span style={{fontSize:'22px'}}>{d.icon}</span>
            <span style={{fontSize:'13px',fontWeight:'700',color:active===i?d.color:'#8888aa'}}>{d.title}</span>
          </button>
        ))}
      </div>
      <div style={{background:'rgba(255,255,255,.025)',border:`1px solid ${demos[active].color}33`,borderRadius:'20px',padding:'28px',minHeight:'200px',transition:'border-color .3s'}}>
        <div style={{fontSize:'13px',fontWeight:'700',color:demos[active].color,marginBottom:'18px',letterSpacing:'1px',textTransform:'uppercase'}}>Live Preview</div>
        {demos[active].vis}
      </div>
      <style>{`@media(max-width:700px){.feat-demo{grid-template-columns:1fr!important;}}`}</style>
    </div>
  );
}

/* ── Stat with animated bar ── */
function StatBar({label,value,max,color,unit='',delay=0}) {
  const [v,setV]=useState(0);const ref=useRef(null);
  useEffect(()=>{
    const obs=new IntersectionObserver(([e])=>{if(e.isIntersecting){setTimeout(()=>setV(value),delay*1000);obs.disconnect();}},{threshold:.01});
    obs.observe(ref.current);return()=>obs.disconnect();
  },[value,delay]);
  return(
    <div ref={ref} style={{marginBottom:'22px'}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}>
        <span style={{fontSize:'13px',color:'#a0a0c0',fontWeight:'600'}}>{label}</span>
        <span style={{fontSize:'13px',color:color,fontWeight:'800',fontFamily:"'JetBrains Mono',monospace"}}>{v}{unit}</span>
      </div>
      <div style={{height:'6px',background:'rgba(255,255,255,.06)',borderRadius:'6px',overflow:'hidden'}}>
        <div style={{height:'100%',width:`${(v/max)*100}%`,background:`linear-gradient(90deg,${color},${color}99)`,borderRadius:'6px',boxShadow:`0 0 10px ${color}88`,transition:`width 1.2s cubic-bezier(.22,1,.36,1) ${delay}s`}}/>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════ */
export default function Home({ setView }) {
  const [stats,setStats]=useState({rooms:0,listeners:0});
  const [openFaq,setOpenFaq]=useState(null);
  const [navSolid,setNavSolid]=useState(false);
  const [waving,setWaving]=useState(true);
  const [ripples,addRipple]=useRipple();
  const mousePos=useRef({x:.5,y:.5});

  useEffect(()=>{
    fetch('/stats').then(r=>r.json()).then(setStats).catch(()=>{});
    const id=setInterval(()=>fetch('/stats').then(r=>r.json()).then(setStats).catch(()=>{}),30000);
    const onScroll=()=>setNavSolid(window.scrollY>60);
    const onMouse=e=>mousePos.current={x:e.clientX/window.innerWidth,y:e.clientY/window.innerHeight};
    window.addEventListener('scroll',onScroll,{passive:true});
    window.addEventListener('mousemove',onMouse);
    return()=>{clearInterval(id);window.removeEventListener('scroll',onScroll);window.removeEventListener('mousemove',onMouse);};
  },[]);

  const go=()=>{setView('app-entry');window.scrollTo(0,0);};
  const nav=id=>document.getElementById(id)?.scrollIntoView({behavior:'smooth'});

  const handleRipple=(e)=>{
    addRipple(e);
    go();
  };

  return(
    <div style={{background:'#050510',color:'#e8e8ff',overflowX:'hidden',cursor:'none'}} onClick={e=>{/* global ripple on empty areas */}}>

      <Cursor/>
      <Spotlight/>
      <ScrollProgress/>

      {/* Click ripples */}
      {ripples.map(r=>(
        <div key={r.id} style={{position:'fixed',left:r.x,top:r.y,width:'6px',height:'6px',borderRadius:'50%',background:'transparent',border:'2px solid #f72585',pointerEvents:'none',zIndex:9990,transform:'translate(-50%,-50%)',animation:'rippleOut .9s ease forwards'}}/>
      ))}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,600;0,9..40,700;0,9..40,800&family=JetBrains+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{cursor:none!important;}
        a,button{cursor:none!important;}
        ::selection{background:#f7258555;color:#fff;}

        @keyframes blink{0%,100%{border-color:#f72585;}50%{border-color:transparent;}}
        @keyframes rippleOut{0%{width:6px;height:6px;opacity:1;}100%{width:200px;height:200px;opacity:0;}}
        @keyframes slideIn{from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:translateY(0);}}
        @keyframes marqueeL{from{transform:translateX(0)}to{transform:translateX(-33.33%)}}
        @keyframes marqueeR{from{transform:translateX(-33.33%)}to{transform:translateX(0)}}
        @keyframes pulseGlow{0%,100%{box-shadow:0 0 32px #f7258555,0 0 80px #f7258520;}50%{box-shadow:0 0 64px #f7258588,0 0 140px #f7258540;}}
        @keyframes floatY{0%,100%{transform:translateY(0);}50%{transform:translateY(-12px);}}
        @keyframes orbDrift{0%,100%{transform:translate(0,0);}25%{transform:translate(30px,-20px);}50%{transform:translate(-20px,30px);}75%{transform:translate(20px,20px);}}
        @keyframes noise{0%,100%{background-position:0 0;}20%{background-position:-5% -10%;}40%{background-position:-15% 5%;}60%{background-position:7% -25%;}80%{background-position:20% 25%;}}

        .nav{position:fixed;top:0;left:0;right:0;z-index:998;display:flex;align-items:center;justify-content:space-between;padding:0 44px;height:68px;transition:background .4s,border-color .4s;}
        .nav.solid{background:rgba(5,5,16,.88);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);border-bottom:1px solid rgba(255,255,255,.07);}
        .nav-logo{font-family:'Bebas Neue',sans-serif;font-size:32px;letter-spacing:5px;background:linear-gradient(135deg,#f72585,#4cc9f0);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .nav-links{display:flex;gap:36px;}
        .nav-links a{font-size:13px;font-weight:700;color:#6060a0;text-decoration:none;letter-spacing:.5px;transition:color .2s;}
        .nav-links a:hover{color:#e8e8ff;}
        .nav-cta{background:linear-gradient(135deg,#f72585,#7b2ff7);color:#fff;border:none;border-radius:12px;padding:11px 26px;font-size:13px;font-weight:800;letter-spacing:.5px;box-shadow:0 0 28px #f7258550;transition:transform .2s,box-shadow .2s;}
        .nav-cta:hover{transform:scale(1.07) translateY(-1px);box-shadow:0 0 48px #f7258580;}
        @media(max-width:768px){.nav-links{display:none;}.nav{padding:0 22px;}}

        .btn-p{background:linear-gradient(135deg,#f72585,#7b2ff7);border:none;border-radius:16px;padding:18px 44px;font-size:17px;font-weight:800;color:#fff;box-shadow:0 10px 36px #f7258555,0 0 0 1px rgba(255,255,255,.08) inset;letter-spacing:.3px;font-family:inherit;}
        .btn-g{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:18px 44px;font-size:17px;font-weight:700;color:#d0d0f0;backdrop-filter:blur(10px);letter-spacing:.3px;font-family:inherit;}
        .btn-g:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.28);color:#fff;}

        .sec{padding:130px 44px;max-width:1240px;margin:0 auto;}
        .sec-title{font-family:'Bebas Neue',sans-serif;font-size:clamp(52px,8vw,96px);line-height:.9;color:#fff;letter-spacing:-2px;margin:0 0 20px;}
        .sec-sub{font-size:18px;color:#8888aa;line-height:1.78;max-width:520px;}
        .sec-eye{display:inline-flex;align-items:center;gap:8px;border-radius:24px;padding:7px 18px;margin-bottom:20px;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;}

        .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;}
        .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
        .grid-feat{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:18px;}
        @media(max-width:900px){.grid-4{grid-template-columns:1fr 1fr;}.grid-3{grid-template-columns:1fr 1fr;}}
        @media(max-width:600px){.grid-4{grid-template-columns:1fr 1fr;}.grid-3{grid-template-columns:1fr;}}

        .faq-item{border:1px solid rgba(255,255,255,.08);border-radius:18px;margin-bottom:12px;cursor:pointer;overflow:hidden;transition:border-color .3s,background .3s;}
        .faq-item:hover{border-color:rgba(247,37,133,.3);background:rgba(247,37,133,.03);}
        .faq-q{padding:22px 26px;font-size:15px;font-weight:700;color:#e8e8ff;display:flex;justify-content:space-between;align-items:center;gap:16px;}
        .faq-a{padding:0 26px;font-size:14px;color:#8888a8;line-height:1.8;max-height:0;overflow:hidden;transition:max-height .45s ease,padding .3s;}
        .faq-a.open{max-height:220px;padding:0 26px 22px;}
        .faq-arrow{font-size:20px;color:#444466;transition:transform .3s,color .3s;flex-shrink:0;}
        .faq-arrow.open{transform:rotate(180deg);color:#f72585;}

        .footer-link{display:block;font-size:14px;color:#555577;text-decoration:none;margin-bottom:14px;transition:color .2s;}
        .footer-link:hover{color:#c0c0e0;}
        .footer-label{font-size:10px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#333355;margin-bottom:20px;}

        .divider{height:1px;background:linear-gradient(90deg,transparent,rgba(247,37,133,.25),rgba(76,201,240,.25),transparent);}

        .noise{position:fixed;inset:0;pointer-events:none;z-index:3;opacity:.03;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:200px;animation:noise 8s steps(2) infinite;}

        @media(max-width:860px){.tech-split{grid-template-columns:1fr!important;gap:50px!important;}}
        @media(max-width:700px){.feat-demo-grid{grid-template-columns:1fr!important;}}
      `}</style>

      {/* Noise overlay */}
      <div className="noise"/>

      {/* ══ NAV ══ */}
      <nav className={`nav ${navSolid?'solid':''}`}>
        <div className="nav-logo" style={{cursor:'pointer'}} onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}>HUSHPOD</div>
        <div className="nav-links">
          {[['how','How It Works'],['features','Features'],['cases','Use Cases'],['tech','Tech'],['faq','FAQ']].map(([id,l])=>(
            <a key={id} href={`#${id}`} onClick={e=>{e.preventDefault();nav(id);}}>{l}</a>
          ))}
        </div>
        <Mag className="nav-cta" onClick={go} strength={0.3}>Start Free →</Mag>
      </nav>

      {/* ══ HERO ══ */}
      <section style={{position:'relative',minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',overflow:'hidden',padding:'120px 28px 80px',textAlign:'center'}}>
        <HeroScene mouseRef={mousePos}/>

        {/* Atmospheric glows */}
        <div style={{position:'absolute',top:'30%',left:'20%',width:'600px',height:'600px',background:'radial-gradient(circle,rgba(247,37,133,.10),transparent 65%)',pointerEvents:'none',zIndex:1,animation:'orbDrift 18s ease-in-out infinite'}}/>
        <div style={{position:'absolute',top:'50%',right:'15%',width:'500px',height:'500px',background:'radial-gradient(circle,rgba(76,201,240,.07),transparent 65%)',pointerEvents:'none',zIndex:1,animation:'orbDrift 22s ease-in-out infinite reverse'}}/>
        <div style={{position:'absolute',inset:0,backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.02) 3px,rgba(0,0,0,.02) 4px)',pointerEvents:'none',zIndex:1}}/>

        <div style={{position:'relative',zIndex:2,maxWidth:'900px',width:'100%'}}>

          {/* Eyebrow */}
          <Reveal>
            <div style={{display:'inline-flex',alignItems:'center',gap:'10px',background:'rgba(247,37,133,.1)',border:'1px solid rgba(247,37,133,.35)',borderRadius:'30px',padding:'8px 20px',marginBottom:'36px',fontSize:'12px',fontWeight:'800',letterSpacing:'3px',textTransform:'uppercase',color:'#ff6eb5'}}>
              <span style={{width:8,height:8,borderRadius:'50%',background:'#f72585',display:'inline-block',animation:'pulseGlow 2s infinite'}}/>
              Real-time · Synchronized · Private
            </div>
          </Reveal>

          {/* Typewriter headline */}
          <Reveal delay={0.1} y={70} scale>
            <h1 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(80px,16vw,180px)',lineHeight:.86,letterSpacing:'-4px',margin:'0 0 16px',color:'#fff',filter:'drop-shadow(0 0 50px rgba(247,37,133,.4))'}}>
              <span style={{background:'linear-gradient(170deg,#fff 0%,#fff 40%,#f72585 70%,#4cc9f0 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>HEAR</span>
              <br/>
              <span style={{background:'linear-gradient(170deg,#fff 0%,#fff 40%,#7b2ff7 70%,#4cc9f0 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>TOGETHER</span>
            </h1>
          </Reveal>

          {/* Dynamic sub with typewriter */}
          <Reveal delay={0.2}>
            <p style={{fontSize:'clamp(16px,2.4vw,20px)',color:'#b0b0d0',lineHeight:1.8,maxWidth:'600px',margin:'0 auto 20px',fontWeight:400}}>
              Real-time synchronized audio for groups.
            </p>
            <p style={{fontSize:'clamp(16px,2.4vw,20px)',color:'#c0c0e0',lineHeight:1.8,maxWidth:'600px',margin:'0 auto 48px',fontWeight:600,minHeight:'2em'}}>
              Perfect for{' '}
              <Typewriter
                words={['silent disco parties 🎉','road trip convoys 🚗','gym classes 🏋️','remote study groups 📚','audio tours 🏛️','watch parties 🎬']}
                speed={70}
                pause={2200}
              />
            </p>
          </Reveal>

          {/* Magnetic CTA buttons */}
          <Reveal delay={0.3}>
            <div style={{display:'flex',gap:'16px',justifyContent:'center',flexWrap:'wrap',marginBottom:'64px'}}>
              <Mag className="btn-p" style={{animation:'pulseGlow 3s ease-in-out infinite'}} onClick={handleRipple} strength={0.4}>
                🎉 Create a Room Free
              </Mag>
              <Mag className="btn-g" onClick={()=>nav('how')} strength={0.3}>
                See How It Works ↓
              </Mag>
            </div>
          </Reveal>

          {/* Live stats */}
          <Reveal delay={0.4}>
            <div className="grid-4" style={{marginBottom:'48px'}}>
              {[
                {v:stats.rooms||'—',u:'',l:'Active Rooms',c:'#f72585'},
                {v:stats.listeners||'—',u:'',l:'Live Now',c:'#4cc9f0'},
                {v:'<100',u:'ms',l:'Sync Precision',c:'#06d6a0'},
                {v:'0',u:'',l:'Data Stored',c:'#ffd60a'},
              ].map(({v,u,l,c},i)=>(
                <Tilt key={l} s={14}>
                  <div style={{textAlign:'center',padding:'28px 20px',background:'rgba(255,255,255,.025)',border:`1px solid ${c}22`,borderRadius:'22px',boxShadow:`0 0 28px ${c}14,inset 0 0 20px ${c}08`,transition:'all .3s'}}
                    onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 0 50px ${c}30,inset 0 0 30px ${c}14`;e.currentTarget.style.borderColor=`${c}44`;}}
                    onMouseLeave={e=>{e.currentTarget.style.boxShadow=`0 0 28px ${c}14,inset 0 0 20px ${c}08`;e.currentTarget.style.borderColor=`${c}22`;}}>
                    <div style={{fontSize:'clamp(30px,4vw,48px)',fontFamily:"'Bebas Neue',sans-serif",fontWeight:900,color:c,lineHeight:1,textShadow:`0 0 28px ${c}88`}}>{v}{u}</div>
                    <div style={{fontSize:'10px',fontWeight:'800',letterSpacing:'2.5px',textTransform:'uppercase',color:'#444466',marginTop:'10px'}}>{l}</div>
                  </div>
                </Tilt>
              ))}
            </div>
          </Reveal>

          {/* Live feed */}
          <Reveal delay={0.5}>
            <div style={{display:'flex',justifyContent:'center'}}>
              <LiveFeed/>
            </div>
          </Reveal>
        </div>

        {/* Scroll arrow */}
        <div style={{position:'absolute',bottom:'32px',left:'50%',transform:'translateX(-50%)',zIndex:2,display:'flex',flexDirection:'column',alignItems:'center',gap:'8px',opacity:.4}}>
          <span style={{fontSize:'10px',letterSpacing:'4px',textTransform:'uppercase',color:'#666688',fontFamily:"'JetBrains Mono',monospace"}}>Scroll to explore</span>
          <div style={{fontSize:'22px',color:'#666688',animation:'floatY 2s ease-in-out infinite'}}>↓</div>
        </div>
      </section>

      {/* ══ MARQUEE STRIPS ══ */}
      <div className="divider"/>
      <Marquee dir={1} items={['🎵 Dead Reckoning Sync','⚡ Atomic Playback','🎧 BT Auto-Detect','🔒 Zero Data Storage','📲 QR Invite','🌙 Wake Lock API','💬 Live Chat','🔔 Lock Screen Controls','🔑 Password Rooms','👑 Admin Controls','🎛️ DJ Desk','🌍 Works Anywhere']}/>
      <Marquee dir={-1} items={['SILENT DISCO','ROAD TRIPS','GYM CLASSES','STUDY GROUPS','AUDIO TOURS','WATCH PARTIES','HOUSE PARTIES','GLOBAL SYNC','ZERO LAG','NO APP NEEDED','FREE FOREVER']}/>
      <div className="divider"/>

      {/* ══ INTERACTIVE WAVEFORM ══ */}
      <section style={{padding:'100px 0 0',position:'relative',overflow:'hidden'}}>
        <div style={{textAlign:'center',marginBottom:'40px',padding:'0 44px'}}>
          <Reveal>
            <p style={{fontSize:'13px',fontWeight:'800',letterSpacing:'3px',textTransform:'uppercase',color:'#555577',marginBottom:'12px'}}>MOVE YOUR MOUSE OVER THE WAVE</p>
            <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(44px,7vw,80px)',color:'#fff',letterSpacing:'-2px',lineHeight:.9}}>The Sync Engine</h2>
          </Reveal>
        </div>
        <Reveal y={0}>
          <div style={{height:'160px',position:'relative',cursor:'crosshair'}}
            onMouseEnter={()=>setWaving(true)}
            onMouseLeave={()=>setWaving(true)}>
            <Waveform playing={waving}/>
          </div>
        </Reveal>
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section id="how" style={{padding:'100px 44px 130px',background:'linear-gradient(180deg,#050510,#0a0a20 50%,#050510)'}}>
        <div style={{maxWidth:'1240px',margin:'0 auto'}}>
          <Reveal style={{textAlign:'center',marginBottom:'72px'}}>
            <div className="sec-eye" style={{background:'rgba(247,37,133,.1)',border:'1px solid rgba(247,37,133,.3)',color:'#ff6eb5'}}>⚡ Four Steps</div>
            <h2 className="sec-title">Zero friction.<br/>Instant sync.</h2>
            <p className="sec-sub" style={{margin:'0 auto'}}>No downloads. No accounts. Works in any browser on any device, anywhere.</p>
          </Reveal>

          <div className="grid-4">
            {[
              {n:'01',icon:'🎙️',t:'Create a Room',c:'#f72585',d:'Enter your name, tap Create. Get a 5-char code. Upload up to 10 songs — MP3, WAV, FLAC, AAC all supported instantly.'},
              {n:'02',icon:'📲',t:'Share the Code',c:'#4cc9f0',d:'Send the room code or QR. Friends open HushPod in any browser and type the code — they\'re synced in seconds.'},
              {n:'03',icon:'🎧',t:'Listen Together',c:'#06d6a0',d:'Everyone hears the same audio at the exact same millisecond. Host controls. Guests react, suggest songs, chat live.'},
              {n:'04',icon:'👑',t:'Pass the Aux',c:'#ffd60a',d:'Promote guests to DJ. Transfer host crown. If host leaves, next listener auto-promotes. Party never stops.'},
            ].map((s,i)=>(
              <Reveal key={s.n} delay={i*.1} scale>
                <Tilt s={8} style={{height:'100%'}}>
                  <div style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.08)',borderRadius:'28px',padding:'36px 30px',height:'100%',position:'relative',overflow:'hidden',transition:'border-color .3s,box-shadow .3s'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=`${s.c}55`;e.currentTarget.style.boxShadow=`0 28px 70px ${s.c}20`;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,.08)';e.currentTarget.style.boxShadow='none';}}>
                    <div style={{position:'absolute',right:'-8px',top:'-12px',fontFamily:"'Bebas Neue',sans-serif",fontSize:'140px',lineHeight:1,color:'rgba(255,255,255,.03)',userSelect:'none'}}>{s.n}</div>
                    <div style={{position:'absolute',top:0,left:0,width:'80px',height:'80px',background:`radial-gradient(circle at 0 0,${s.c}25,transparent)`,borderRadius:'28px 0 0 0'}}/>
                    <div style={{fontSize:'40px',marginBottom:'20px'}}>{s.icon}</div>
                    <div style={{fontSize:'11px',fontWeight:'800',letterSpacing:'3px',textTransform:'uppercase',color:s.c,marginBottom:'12px'}}>{s.n}</div>
                    <div style={{fontSize:'20px',fontWeight:'800',color:'#f0f0ff',marginBottom:'14px',lineHeight:1.2}}>{s.t}</div>
                    <div style={{fontSize:'14px',color:'#9090b0',lineHeight:1.75}}>{s.d}</div>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ INTERACTIVE FEATURE DEMO ══ */}
      <section id="features" className="sec">
        <Reveal style={{marginBottom:'56px'}}>
          <div className="sec-eye" style={{background:'rgba(76,201,240,.1)',border:'1px solid rgba(76,201,240,.3)',color:'#4cc9f0'}}>✨ Live Preview</div>
          <h2 className="sec-title">Click to explore<br/>every feature</h2>
          <p className="sec-sub">Interact with each panel to see exactly how the app works — before you even create a room.</p>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="feat-demo-grid" style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:'16px'}}>
            <FeatureDemo/>
          </div>
        </Reveal>

        {/* Feature grid */}
        <div className="grid-feat" style={{marginTop:'64px'}}>
          {[
            {icon:'🔴',t:'Dead Reckoning',d:'Mathematical sync between heartbeats. Drift never accumulates.',live:true,c:'#f72585'},
            {icon:'📦',t:'Batch Upload',d:'10 songs at once. Auto-advance. Drag-and-drop queue.',live:true,c:'#4cc9f0'},
            {icon:'🌙',t:'Wake Lock',d:'OS won\'t kill audio. Tab restore re-syncs in milliseconds.',live:true,c:'#06d6a0'},
            {icon:'🔒',t:'Zero Data',d:'Audio deleted the moment your room ends. No logs. Nothing.',live:true,c:'#ffd60a'},
            {icon:'🔔',t:'Lock Screen',d:'Media Session API — full OS native controls.',live:true,c:'#7b2ff7'},
            {icon:'♾️',t:'Unlimited',d:'Premium with unlimited listeners coming soon.',live:false,c:'#f72585'},
          ].map((f,i)=>(
            <Reveal key={f.t} delay={(i%3)*.08}>
              <Tilt s={7} style={{height:'100%'}}>
                <div style={{background:'rgba(255,255,255,.02)',border:'1px solid rgba(255,255,255,.07)',borderRadius:'22px',padding:'26px',height:'100%',transition:'all .3s'}}
                  onMouseEnter={e=>{e.currentTarget.style.background=`rgba(${f.c==='#f72585'?'247,37,133':f.c==='#4cc9f0'?'76,201,240':f.c==='#06d6a0'?'6,214,160':f.c==='#ffd60a'?'255,214,10':'123,47,247'},.06)`;e.currentTarget.style.borderColor=`${f.c}44`;e.currentTarget.style.boxShadow=`0 20px 60px ${f.c}15`;}}
                  onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.02)';e.currentTarget.style.borderColor='rgba(255,255,255,.07)';e.currentTarget.style.boxShadow='none';}}>
                  <div style={{fontSize:'28px',marginBottom:'14px'}}>{f.icon}</div>
                  <div style={{fontSize:'16px',fontWeight:'800',color:'#eeeeff',marginBottom:'10px'}}>{f.t}</div>
                  <div style={{fontSize:'13px',color:'#7070a0',lineHeight:1.75,marginBottom:'14px'}}>{f.d}</div>
                  <span style={{display:'inline-block',padding:'4px 12px',borderRadius:'20px',fontSize:'10px',fontWeight:'800',letterSpacing:'1.5px',background:f.live?'rgba(6,214,160,.15)':'rgba(255,214,10,.1)',color:f.live?'#06d6a0':'#ffd60a',border:f.live?'1px solid rgba(6,214,160,.3)':'1px solid rgba(255,214,10,.25)'}}>{f.live?'LIVE':'SOON'}</span>
                </div>
              </Tilt>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══ USE CASES ══ */}
      <section id="cases" style={{padding:'130px 44px',background:'linear-gradient(180deg,#050510,#08081a 50%,#050510)'}}>
        <div style={{maxWidth:'1240px',margin:'0 auto'}}>
          <Reveal style={{textAlign:'center',marginBottom:'72px'}}>
            <div className="sec-eye" style={{background:'rgba(6,214,160,.1)',border:'1px solid rgba(6,214,160,.3)',color:'#06d6a0'}}>🌍 Use Cases</div>
            <h2 className="sec-title">Made for every<br/>shared moment</h2>
            <p className="sec-sub" style={{margin:'0 auto'}}>From silent discos to gym classes — HushPod makes group audio effortless.</p>
          </Reveal>
          <div className="grid-3">
            {[
              {e:'🎉',t:'Silent Disco',d:'Replace FM transmitters. Everyone dances to the same beat through their own earphones. No hardware, no clashes.',g:'linear-gradient(135deg,rgba(247,37,133,.14),rgba(123,47,247,.14))',b:'rgba(247,37,133,.25)'},
              {e:'📚',t:'Study Sessions',d:'Friends across locations hear the same lo-fi at the same moment — shared focus atmosphere without distractions.',g:'linear-gradient(135deg,rgba(76,201,240,.14),rgba(0,180,216,.14))',b:'rgba(76,201,240,.25)'},
              {e:'🚗',t:'Road Trips',d:'Different cars, same song, same millisecond. The convoy moves to one beat. Host controls the vibe for all.',g:'linear-gradient(135deg,rgba(6,214,160,.14),rgba(0,168,107,.14))',b:'rgba(6,214,160,.25)'},
              {e:'🏋️',t:'Gym Classes',d:'Sync workout music to every participant simultaneously — no expensive sound system required.',g:'linear-gradient(135deg,rgba(255,214,10,.14),rgba(247,127,0,.14))',b:'rgba(255,214,10,.25)'},
              {e:'🎬',t:'Remote Parties',d:'Sync ambient music for virtual events. Everyone feels in the same room even continents apart.',g:'linear-gradient(135deg,rgba(247,37,133,.10),rgba(76,201,240,.10))',b:'rgba(247,37,133,.20)'},
              {e:'🏛️',t:'Audio Tours',d:'Museums sync narration to every visitor simultaneously. Guide controls the pace. Perfect sync.',g:'linear-gradient(135deg,rgba(123,47,247,.14),rgba(76,201,240,.14))',b:'rgba(123,47,247,.25)'},
            ].map((c,i)=>(
              <Reveal key={c.t} delay={(i%3)*.1} y={60} scale>
                <Tilt s={7} style={{height:'100%'}}>
                  <div style={{background:c.g,border:`1px solid ${c.b}`,borderRadius:'28px',padding:'40px 32px',height:'100%',transition:'box-shadow .3s,transform .3s'}}
                    onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 32px 80px ${c.b.replace('0.25','0.18')}`;}}
                    onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';}}>
                    <div style={{fontSize:'44px',marginBottom:'20px'}}>{c.e}</div>
                    <div style={{fontSize:'19px',fontWeight:'800',color:'#f4f4ff',marginBottom:'14px'}}>{c.t}</div>
                    <div style={{fontSize:'14px',color:'#9898ba',lineHeight:1.75}}>{c.d}</div>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TECH ══ */}
      <section id="tech" className="sec">
        <div className="tech-split" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'80px',alignItems:'start'}}>
          <div>
            <Reveal x={-50}>
              <div className="sec-eye" style={{background:'rgba(123,47,247,.1)',border:'1px solid rgba(123,47,247,.35)',color:'#bb86fc'}}>🔬 Tech Deep Dive</div>
              <h2 className="sec-title">Engineered for<br/>precision</h2>
              <p className="sec-sub" style={{marginBottom:'44px'}}>Every millisecond matters. Our sync engine eliminates every source of drift from first principles.</p>
            </Reveal>
            <StatBar label="Sync Accuracy" value={96} max={100} color="#f72585" unit="%" delay={0}/>
            <StatBar label="BT Coverage (of devices)" value={89} max={100} color="#4cc9f0" unit="%" delay={0.1}/>
            <StatBar label="Re-sync Speed" value={200} max={500} color="#06d6a0" unit="ms" delay={0.2}/>
            <StatBar label="Max File Size" value={150} max={200} color="#ffd60a" unit="MB" delay={0.3}/>
            <StatBar label="Listeners (free)" value={15} max={20} color="#7b2ff7" unit="" delay={0.4}/>
          </div>
          <Reveal x={50}>
            <div style={{background:'rgba(255,255,255,.02)',border:'1px solid rgba(255,255,255,.07)',borderRadius:'24px',padding:'32px',marginBottom:'20px'}}>
              <div style={{fontSize:'13px',fontWeight:'800',letterSpacing:'2px',textTransform:'uppercase',color:'#555577',marginBottom:'20px'}}>Sync Engine Flow</div>
              {[
                {step:'01',label:'Clock Sync',desc:'8 server polls, median of 3 fastest → offset stored',c:'#f72585'},
                {step:'02',label:'Schedule Play',desc:'Future timestamp broadcast → all devices start atomically',c:'#4cc9f0'},
                {step:'03',label:'Heartbeat Loop',desc:'Host emits position every 500ms via WebSocket',c:'#06d6a0'},
                {step:'04',label:'Dead Reckoning',desc:'Guests calculate exact position mathematically at 60fps',c:'#ffd60a'},
                {step:'05',label:'Drift Correction',desc:'Rate nudge (±1.5%) for small drift, seek for >250ms',c:'#7b2ff7'},
              ].map((item,i)=>(
                <Reveal key={item.step} delay={i*.08} x={20}>
                  <div style={{display:'flex',gap:'16px',marginBottom:'16px',padding:'14px 18px',borderRadius:'14px',background:'rgba(255,255,255,.03)',border:`1px solid ${item.c}22`,transition:'border-color .2s'}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=`${item.c}55`}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=`${item.c}22`}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'24px',color:`${item.c}88`,flexShrink:0,lineHeight:1,marginTop:'2px'}}>{item.step}</div>
                    <div>
                      <div style={{fontWeight:'800',fontSize:'14px',color:item.c,marginBottom:'3px'}}>{item.label}</div>
                      <div style={{fontSize:'12px',color:'#6666a0',lineHeight:1.6}}>{item.desc}</div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ FAQ ══ */}
      <section id="faq" style={{padding:'130px 44px',background:'linear-gradient(180deg,#050510,#08081a 50%,#050510)'}}>
        <div style={{maxWidth:'780px',margin:'0 auto'}}>
          <Reveal style={{textAlign:'center',marginBottom:'60px'}}>
            <div className="sec-eye" style={{background:'rgba(255,214,10,.08)',border:'1px solid rgba(255,214,10,.25)',color:'#ffd60a'}}>❓ FAQ</div>
            <h2 className="sec-title">Common questions</h2>
          </Reveal>
          {[
            {q:'Do guests need to download an app?',a:'No. HushPod works entirely in the browser. Guests open the link, enter the room code, and they\'re synced instantly — no installation, no account needed.'},
            {q:'Does everyone need the same WiFi?',a:'No. HushPod works over the internet — different networks, mobile data, different cities, countries. The sync engine handles network variance automatically.'},
            {q:'What happens if the host leaves?',a:'The longest-connected listener auto-promotes to host. Hosts get a 30-second grace period to reconnect and reclaim their crown without disrupting the session.'},
            {q:'Is my music stored on HushPod servers?',a:'Never permanently. Audio is held in server RAM only during your active session. The moment your room ends, everything is permanently deleted. Zero data retained.'},
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
      <section style={{padding:'160px 44px',textAlign:'center',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'900px',height:'700px',background:'radial-gradient(ellipse,rgba(247,37,133,.18) 0%,rgba(123,47,247,.10) 40%,transparent 70%)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(247,37,133,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(247,37,133,.04) 1px,transparent 1px)',backgroundSize:'60px 60px',pointerEvents:'none'}}/>
        <div style={{position:'relative',zIndex:1}}>
          <Reveal>
            <div className="sec-eye" style={{background:'rgba(247,37,133,.12)',border:'1px solid rgba(247,37,133,.35)',color:'#ff6eb5',justifyContent:'center',display:'inline-flex'}}>🎧 Start Free Today</div>
          </Reveal>
          <Reveal delay={0.1} y={80} scale>
            <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(80px,14vw,180px)',lineHeight:.86,letterSpacing:'-4px',background:'linear-gradient(160deg,#fff 0%,#fff 30%,#f72585 60%,#4cc9f0 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',filter:'drop-shadow(0 0 60px rgba(247,37,133,.4))',margin:'24px 0 32px'}}>
              LISTEN<br/>TOGETHER<br/>NOW
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p style={{fontSize:'20px',color:'#9090b0',marginBottom:'52px',lineHeight:1.8,maxWidth:'500px',margin:'0 auto 52px'}}>
              Create your first room in under 10 seconds. No sign-up. No credit card. Just music, perfectly in sync.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <Mag className="btn-p" style={{fontSize:'19px',padding:'22px 60px',animation:'pulseGlow 3s ease-in-out infinite'}} onClick={handleRipple} strength={0.35}>
              🎉 Create a Free Room
            </Mag>
          </Reveal>
          <Reveal delay={0.45}>
            <div style={{display:'flex',flexWrap:'wrap',gap:'20px',justifyContent:'center',marginTop:'48px',opacity:.65}}>
              {[['✅','No credit card'],['✅','No download'],['✅','No account'],['✅','Works globally'],['✅','Free forever']].map(([ic,l])=>(
                <span key={l} style={{fontSize:'13px',color:'#6060a0',fontWeight:'700',display:'flex',alignItems:'center',gap:'6px'}}><span style={{color:'#06d6a0'}}>{ic}</span>{l}</span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <div className="divider"/>
      <footer style={{padding:'72px 44px 48px',maxWidth:'1240px',margin:'0 auto'}}>
        <div style={{display:'grid',gridTemplateColumns:'2.5fr 1fr 1fr',gap:'60px',marginBottom:'56px'}}>
          <div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'36px',letterSpacing:'5px',background:'linear-gradient(135deg,#f72585,#4cc9f0)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:'18px'}}>HUSHPOD</div>
            <p style={{fontSize:'14px',color:'#555577',lineHeight:1.8,maxWidth:'320px',marginBottom:'20px'}}>Synchronized private group audio. Listen together in perfect sync — no app, no account, no lag.</p>
            <p style={{fontSize:'12px',color:'#333355'}}>Built by <span style={{color:'#bb86fc',fontWeight:'800'}}>Zentry Hub Pvt Ltd</span></p>
          </div>
          <div>
            <div className="footer-label">Product</div>
            {[['Launch App',()=>go()],['Features',()=>nav('features')],['How It Works',()=>nav('how')],['Technology',()=>nav('tech')]].map(([l,fn])=>(
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
        <style>{`@media(max-width:768px){footer .fg{grid-template-columns:1fr!important;gap:32px!important;}}`}</style>
        <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:'12px',paddingTop:'28px',borderTop:'1px solid rgba(255,255,255,.06)',fontSize:'12px',color:'#333355'}}>
          <span>© 2026 HushPod · Built with ♥ in India</span>
          <span style={{fontFamily:"'JetBrains Mono',monospace"}}>v2.0.0 · Node.js + Socket.io · Zero data retained</span>
        </div>
      </footer>

    </div>
  );
}