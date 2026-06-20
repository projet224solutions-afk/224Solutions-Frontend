import React from "react";

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error | null;
  info?: React.ErrorInfo | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log complet en console pour le diagnostic (visible via F12)
    console.error("PDG Tab Error:", error, info?.componentStack);
    this.setState({ info });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, info: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const message = this.state.error?.message || String(this.state.error || "Erreur inconnue");
      const stack = this.state.error?.stack || "";
      const componentStack = this.state.info?.componentStack || "";

      return (
        <div className="p-4 rounded-lg border border-orange-200 bg-orange-50 text-sm space-y-3">
          <div className="font-semibold text-[#ff4000]">
            Une erreur est survenue lors du chargement de cet onglet.
          </div>

          {/* Message d'erreur — affiché directement pour le diagnostic */}
          <div className="rounded-md bg-white/70 border border-orange-200 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Message :</p>
            <p className="font-mono text-xs text-[#ff4000] break-words whitespace-pre-wrap">
              {message}
            </p>
          </div>

          {(stack || componentStack) && (
            <details className="rounded-md bg-white/70 border border-orange-200 p-3">
              <summary className="text-xs font-medium text-muted-foreground cursor-pointer">
                Détails techniques (pile d'appel)
              </summary>
              {stack && (
                <pre className="mt-2 max-h-48 overflow-auto text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
                  {stack}
                </pre>
              )}
              {componentStack && (
                <pre className="mt-2 max-h-48 overflow-auto text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
                  {componentStack}
                </pre>
              )}
            </details>
          )}

          <button
            type="button"
            onClick={this.handleReset}
            className="text-xs px-3 py-1.5 rounded-md border border-orange-300 bg-white hover:bg-orange-100 transition-colors"
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
