import React from 'react';

/**
 * ErrorBoundary — wraps any subtree and catches render errors.
 * Without this, a single crash in DJDesk or LabsTab kills the entire app.
 * With it, only that tab shows an error card, the rest keeps working.
 *
 * Usage:
 *   <ErrorBoundary name="DJ Desk">
 *     <DJDesk ... />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary: ${this.props.name}]`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          background: 'rgba(247,37,133,0.08)',
          border: '1px solid rgba(247,37,133,0.3)',
          borderRadius: '16px',
          padding: '24px',
          textAlign: 'center',
          margin: '8px 0',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--pink)', marginBottom: '6px' }}>
            {this.props.name || 'This section'} ran into a problem
          </div>
          <div style={{ fontSize: '12px', color: 'var(--sub)', marginBottom: '16px', fontFamily: "'JetBrains Mono', monospace" }}>
            {this.state.error?.message || 'Unknown error'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              background: 'var(--s2)', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '8px 18px',
              color: 'var(--text)', cursor: 'pointer', fontSize: '13px',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}