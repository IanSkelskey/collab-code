import { Component, type ErrorInfo, type ReactNode } from 'react';
import './ErrorBoundary.css';

interface ErrorBoundaryProps {
  /**
   * When `resetKey` changes (e.g. the user joins a different room, or switches
   * to a different file), the boundary resets and re-renders its children —
   * room- or file-scoped recovery without reloading the whole app.
   */
  resetKey?: string;
  /**
   * 'page' (default) renders a full-screen recovery card for the whole app.
   * 'pane' renders a compact in-flow fallback that fills its container, so one
   * workspace panel (editor, terminal, preview) can fail without taking down
   * its neighbors.
   */
  variant?: 'page' | 'pane';
  /** Panel name shown in the 'pane' fallback message (e.g. "editor"). */
  label?: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render-time errors from its subtree and renders a fallback UI
 * instead of unmounting the entire app. React's error boundary API is
 * class-only, so this is intentionally a class component.
 *
 * Non-optional in a collaborative app: a thrown error in the workspace
 * (Monaco, Yjs, terminal, file tree) should not leave the user stranded
 * with a blank page.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleExit = () => {
    window.location.hash = '';
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    if (this.props.variant === 'pane') {
      return (
        <div className="cc-error-pane" role="alert" aria-live="assertive">
          <div className="cc-error-pane-card">
            <p className="cc-error-pane-eyebrow">Panel error</p>
            <p className="cc-error-pane-message">
              {this.props.label ? `The ${this.props.label} panel` : 'This panel'} hit an unexpected
              error. The rest of the workspace is unaffected.
            </p>
            <div className="cc-error-pane-actions">
              <button
                type="button"
                className="cc-error-boundary-btn cc-error-boundary-btn--primary"
                onClick={this.handleReset}
              >
                Try again
              </button>
            </div>
            {import.meta.env.DEV && (
              <details className="cc-error-boundary-details">
                <summary>Error details (dev only)</summary>
                <pre className="cc-error-boundary-stack">
                  {this.state.error.message}
                  {this.state.error.stack ? `\n\n${this.state.error.stack}` : ''}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="cc-error-boundary" role="alert" aria-live="assertive">
        <div className="cc-error-boundary-card">
          <p className="cc-error-boundary-eyebrow">Something broke</p>
          <h1 className="cc-error-boundary-title">The workspace hit an unexpected error.</h1>
          <p className="cc-error-boundary-message">
            Try again, reload the page, or exit back to the landing screen. Your collaborators are
            unaffected — they'll stay in the room.
          </p>
          <div className="cc-error-boundary-actions">
            <button
              type="button"
              className="cc-error-boundary-btn cc-error-boundary-btn--primary"
              onClick={this.handleReload}
            >
              Reload page
            </button>
            <button type="button" className="cc-error-boundary-btn" onClick={this.handleReset}>
              Try again
            </button>
            <button type="button" className="cc-error-boundary-btn" onClick={this.handleExit}>
              Exit room
            </button>
          </div>
          {import.meta.env.DEV && (
            <details className="cc-error-boundary-details">
              <summary>Error details (dev only)</summary>
              <pre className="cc-error-boundary-stack">
                {this.state.error.message}
                {this.state.error.stack ? `\n\n${this.state.error.stack}` : ''}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
