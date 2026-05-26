import { Component, type ErrorInfo, type ReactNode } from "react";

// Catches any render-time crash in a page so one bad screen shows a friendly retry
// card instead of white-screening the whole app. Reset by changing `resetKey` (we key
// it on the route path, so navigating to another page clears the error).
interface Props {
  children: ReactNode;
  resetKey?: string;
}
interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    // Clear the error when the route (resetKey) changes.
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card text-center">
          <div className="text-4xl">😕</div>
          <h2 className="mt-3 text-lg font-semibold text-ink">This page hit a snag</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Something didn't load right. Your data is safe. Try again, and if it keeps happening, head back to your Dashboard.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button className="btn-primary" onClick={() => this.setState({ error: null })}>Try again</button>
            <a className="btn-ghost" href="/app">Go to Dashboard</a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
