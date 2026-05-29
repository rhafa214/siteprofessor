import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);

    // Auto-reload for Vite chunk load errors (deployments invalidate old chunks)
    if (error.message.includes("Failed to fetch dynamically imported module") || error.message.includes("Importing a module script failed")) {
      window.location.reload();
      return;
    }

    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ backgroundColor: '#fff', padding: '20px', color: '#000', height: '100vh', overflow: 'auto' }}>
          <h1 style={{ color: 'red' }}>Ops! Algo deu errado</h1>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: '20px' }}>
            {this.state.error?.toString()}
            <br />
            {this.state.errorInfo?.componentStack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '10px 20px', fontSize: '16px' }}
          >
            Recarregar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

