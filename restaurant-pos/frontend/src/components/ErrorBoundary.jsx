import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', padding: 40,
          background: '#0f0d0a', color: '#f0ead8', textAlign: 'center',
        }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, marginBottom: 16, color: '#c9a84c' }}>
            Dulce Patojo
          </h1>
          <p style={{ fontSize: 16, marginBottom: 8, color: '#e74c3c' }}>
            Algo salió mal
          </p>
          <p style={{ fontSize: 13, color: '#8a8070', marginBottom: 24, maxWidth: 400 }}>
            {this.state.error?.message || 'Error inesperado'}
          </p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.href = '/login'; }}
            style={{
              padding: '12px 32px', background: '#c9a84c', color: '#0f0d0a',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Volver al inicio
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}