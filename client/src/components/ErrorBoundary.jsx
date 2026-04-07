import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'Inter, sans-serif' }}>
          <h2>Something went wrong</h2>
          <pre style={{ color: 'red', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
            {this.state.error?.message}
          </pre>
          <button onClick={() => (window.location.href = '/login')}>
            Back to login
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
