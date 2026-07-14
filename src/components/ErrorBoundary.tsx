import React, {
  Component,
  type ErrorInfo,
  type ReactNode,
} from 'react';

type Props = {
  children: ReactNode;
  fallbackTitle?: string;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('App error boundary', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const title = this.props.fallbackTitle ?? 'Something went wrong';
      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-100 dark:bg-stone-950 p-6">
          <div className="max-w-md w-full space-y-4 text-center">
            <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
              {title}
            </h1>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              {this.state.error.message || 'An unexpected error occurred.'}
            </p>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md bg-stone-900 dark:bg-stone-100 px-4 py-2 text-sm font-medium text-white dark:text-stone-900"
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
