import React from 'react';

export default function NeonLoader({ text = "Syncing Audio..." }) {
  return (
    <div className="loader-overlay">
      <div className="eq-container">
        <div className="eq-bar"></div>
        <div className="eq-bar"></div>
        <div className="eq-bar"></div>
        <div className="eq-bar"></div>
        <div className="eq-bar"></div>
      </div>
      <div className="loader-text">{text}</div>
    </div>
  );
}