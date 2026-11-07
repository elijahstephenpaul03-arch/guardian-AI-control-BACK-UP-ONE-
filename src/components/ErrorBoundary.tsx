import React, { ErrorInfo, ReactNode } from "react";
import { ShieldAlert, RefreshCw, Home, Sparkles } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// Ensure type-safe class component inheritance across modern React builds
const ReactComponent = React.Component as unknown as new (props: Props) => {
  props: Props;
  state: State;
  setState(state: Partial<State> | ((prevState: State) => Partial<State>)): void;
};

export default class ErrorBoundary extends ReactComponent {
  public state: State;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[GuardianAI ErrorBoundary Caught]:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public handleReload = () => {
    window.location.reload();
  };

  public handleGoHome = () => {
    window.location.href = "/";
  };

  public handleGoDemo = () => {
    window.location.href = "/demo";
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-rose-500 selection:text-white">
          <div className="w-full max-w-lg bg-slate-900/90 border border-rose-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6 text-center">
            
            <div className="mx-auto h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/20">
              <ShieldAlert className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-bold font-display text-white tracking-tight">
                Guardian AI Diagnostic Shield
              </h2>
              <p className="text-xs text-rose-300 font-mono">
                Platform Rendering Exception Recovered
              </p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-left font-mono text-xs overflow-x-auto space-y-2">
              <p className="text-rose-400 font-bold">
                {this.state.error?.name || "Runtime Error"}: {this.state.error?.message || "An unexpected error occurred during rendering."}
              </p>
              {this.state.error?.stack && (
                <details className="text-[11px] text-slate-400 cursor-pointer pt-1 border-t border-slate-800/80">
                  <summary className="text-slate-500 hover:text-slate-300 transition">View Stack Trace</summary>
                  <pre className="mt-2 whitespace-pre-wrap text-[10px] text-slate-500 leading-relaxed max-h-40 overflow-y-auto">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Our safety boundary prevented an application crash. You can reload the page or launch the Development Demo Mode.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              <button
                onClick={this.handleReload}
                className="py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center space-x-1.5 shadow-lg shadow-blue-600/30"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Reload</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer flex items-center justify-center space-x-1.5 border border-slate-700"
              >
                <Home className="h-4 w-4" />
                <span>Home</span>
              </button>

              <button
                onClick={this.handleGoDemo}
                className="py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center space-x-1.5 shadow-lg shadow-cyan-600/30"
              >
                <Sparkles className="h-4 w-4" />
                <span>Demo Hub</span>
              </button>
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
