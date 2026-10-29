import { Component, type ReactNode } from 'react';
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="empty">
        <h1 className="page-title">Something went wrong.</h1>
        <p className="my-5">Refresh the page to restore your workspace.</p>
        <a href="/" className="underline">
          Return to workspace
        </a>
      </main>
    ) : (
      this.props.children
    );
  }
}
