import React, { useState } from 'react';

export default function LocalLibrary({ engine }) {
  const [localSongs, setLocalSongs] = useState([]);
  const [sortMode, setSortMode] = useState('newest'); 

  // --- THE FOLDER SCANNER ---
  const handleFolderSelect = (e) => {
    // Filter out everything except audio files
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('audio/'));
    
    if (files.length === 0) {
      return engine.toastData ? null : alert("No audio files found in that folder.");
    }

    const newSongs = files.map(f => ({
      id: 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      name: f.name.replace(/\.[^/.]+$/, ""), // Strips the .mp3 extension for clean UI
      file: f, // Stores the raw File object for offline playback
      lastModified: f.lastModified,
      isLocal: true
    }));

    setLocalSongs(prev => {
      const combined = [...prev, ...newSongs];
      
      // Filter out duplicate songs if the user selects the same folder twice
      const unique = Array.from(new Set(combined.map(a => a.name)))
        .map(name => combined.find(a => a.name === name));
      
      return sortSongs(unique, sortMode);
    });
  };

  // --- THE SORTING ENGINE ---
  const sortSongs = (songs, mode) => {
    const sorted = [...songs];
    if (mode === 'asc') sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (mode === 'desc') sorted.sort((a, b) => b.name.localeCompare(a.name));
    else if (mode === 'newest') sorted.sort((a, b) => b.lastModified - a.lastModified);
    else if (mode === 'oldest') sorted.sort((a, b) => a.lastModified - b.lastModified);
    return sorted;
  };

  const handleSortChange = (e) => {
    const mode = e.target.value;
    setSortMode(mode);
    setLocalSongs(prev => sortSongs(prev, mode));
  };

  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text)' }}>Offline Library</div>
          <div style={{ fontSize: '11px', color: 'var(--sub)' }}>{localSongs.length} tracks loaded</div>
        </div>

        {/* Custom Folder Select Button */}
        <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block' }}>
          <button className="btn-cyan" style={{ margin: 0, padding: '8px 14px', fontSize: '11px', borderRadius: '8px', pointerEvents: 'none' }}>
            📁 Add Folder
          </button>
          <input 
            type="file" 
            webkitdirectory="true" 
            directory="true" 
            multiple 
            onChange={handleFolderSelect}
            style={{ position: 'absolute', top: 0, left: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} 
          />
        </div>
      </div>

      {/* Sorting Controls */}
      {localSongs.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
          <select 
            value={sortMode} 
            onChange={handleSortChange}
            style={{ background: 'var(--s2)', color: 'var(--sub)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', outline: 'none', cursor: 'pointer' }}
          >
            <option value="newest">Newly Added</option>
            <option value="oldest">Oldest Added</option>
            <option value="asc">A to Z</option>
            <option value="desc">Z to A</option>
          </select>
        </div>
      )}

      {/* The Song List */}
      <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
        {localSongs.length === 0 ? (
          <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--sub)', fontSize: '12px', background: 'var(--s2)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
            Select a folder to import your offline music.
          </div>
        ) : (
          localSongs.map(song => (
            <div key={song.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--s2)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: '500', color: 'var(--text)' }}>
                {song.name}
              </div>
              <button 
                className="btn-ghost" 
                style={{ padding: '6px 12px', margin: 0, fontSize: '11px', color: 'var(--cyan)' }}
                onClick={() => console.log("Ready to play:", song.name)}
              >
                ▶ Play
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}