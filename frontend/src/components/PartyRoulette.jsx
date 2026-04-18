import React from 'react';

export default function PartyRoulette({ engine }) {
  return (
    <div className="card" style={{ padding: '15px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text)' }}>Party Roulette</div>
          <div style={{ fontSize: '11px', color: 'var(--sub)' }}>Music will auto-cut at random intervals</div>
        </div>
        {engine.amHost && (
          <button 
            className={engine.musicalChairActive ? "btn-red" : "btn-cyan"} 
            style={{ width: 'auto', margin: 0, padding: '8px 12px', fontSize: '12px', borderRadius: '8px' }} 
            onClick={engine.toggleMusicalChairs}
          >
            {engine.musicalChairActive ? "🛑 Stop Event" : "🎲 Start Roulette"}
          </button>
        )}
      </div>

      {/* Mini DJ Controls */}
      {engine.amHost && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '15px', background: 'var(--s2)', padding: '10px', borderRadius: '8px' }}>
          <button className="btn-ghost" style={{ padding: '8px', margin: 0 }} onClick={engine.playPrev}>⏮</button>
          <button className="btn-ghost" style={{ padding: '8px', margin: 0, color: 'var(--pink)' }} onClick={engine.togglePlay}>
            {engine.isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button className="btn-ghost" style={{ padding: '8px', margin: 0 }} onClick={() => engine.playNext(true)}>⏭</button>
        </div>
      )}

      {/* 3-Item Scrollable Queue */}
      <div style={{ fontSize: '11px', color: 'var(--sub)', marginBottom: '5px' }}>Up Next:</div>
      <div style={{ maxHeight: '135px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
        {engine.queue.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--sub)', textAlign: 'center', padding: '10px 0' }}>Queue is empty</div>
        ) : (
          engine.queue.map((s) => (
            <div key={s.id} style={{ background: 'var(--s2)', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', border: engine.currentSong?.id === s.id ? '1px solid var(--pink)' : '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{s.name}</div>
              {engine.currentSong?.id === s.id && <span style={{ color: 'var(--pink)', fontWeight: 'bold', fontSize: '10px' }}>PLAYING</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}