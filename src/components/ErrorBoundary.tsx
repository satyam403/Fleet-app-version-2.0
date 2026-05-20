import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import i18n from "../i18n/config";

interface Props {
  children: ReactNode;
}

/* Class component can't use hooks — read translations directly off the i18n
   instance. Falls back to English if a key is missing for any reason. */
const tr = (key: string, fallback: string) =>
  i18n.t(key, { defaultValue: fallback });

interface State {
  hasError: boolean;
  error: Error | null;
 
  retryCount: number;
}

const MAX_RETRIES = 2;


export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, retryCount: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console in dev; in prod, console is stripped by Vite (esbuild.drop)
    // so this becomes a no-op. If you wire Sentry/etc., do it here.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () =>
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));

  reload = () => {
    // No setState — the page is about to be replaced anyway.
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDev = import.meta.env.DEV;
    const canRetry = this.state.retryCount < MAX_RETRIES;

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          background: "#f5f5f7",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.07)",
            borderRadius: 18,
            padding: "24px 20px",
            maxWidth: 420,
            width: "100%",
            textAlign: "center",
            boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#fff5e6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
            }}
          >
            <AlertTriangle size={28} style={{ color: "#f0a500" }} />
          </div>
          <h1
            style={{
              fontSize: "1.15rem",
              fontWeight: 700,
              color: "#1d1d1f",
              margin: "0 0 6px",
              letterSpacing: "-0.02em",
            }}
          >
            {tr("errorBoundary.title", "Something went wrong")}
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#86868b",
              margin: "0 0 20px",
              lineHeight: 1.5,
            }}
          >
            {tr(
              "errorBoundary.description",
              "The app hit an unexpected error. Try reloading — your data is safe."
            )}
          </p>

          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={this.reload}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "11px 18px",
                background: "#1d1d1f",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              <RefreshCw size={14} /> {tr("errorBoundary.reload", "Reload")}
            </button>
            {canRetry && (
              <button
                onClick={this.reset}
                style={{
                  padding: "11px 18px",
                  background: "#f5f5f7",
                  color: "#1d1d1f",
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 12,
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  minHeight: 44,
                }}
              >
                {tr("errorBoundary.tryAgain", "Try again")}
              </button>
            )}
          </div>

          {isDev && this.state.error && (
            <details
              style={{
                marginTop: 18,
                textAlign: "left",
                background: "#f5f5f7",
                borderRadius: 10,
                padding: 12,
                fontSize: 12,
              }}
            >
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                {tr("errorBoundary.devDetails", "Error details (dev only)")}
              </summary>
              <pre
                style={{
                  marginTop: 8,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  color: "#cc0000",
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                }}
              >
                {this.state.error.message}
                {"\n\n"}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
