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
        <div className="error-boundary">
          <h1 className="error-boundary-title">Dulce Patojo</h1>
          <p className="error-boundary-sub">Algo salió mal</p>
          <p className="error-boundary-msg">{this.state.error?.message || 'Error inesperado'}</p>
          <button className="error-boundary-btn" onClick={() => { this.setState({ error: null }); window.location.href = '/login'; }}>
            Volver al inicio
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}