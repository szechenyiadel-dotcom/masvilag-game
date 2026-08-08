import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, info) {
    console.error("App crashed:", error);
    console.error("React component stack:", info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100dvh",
            background: "#09080e",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            boxSizing: "border-box",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "460px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "34px",
                marginBottom: "14px",
              }}
            >
              ⚠️
            </div>

            <h2
              style={{
                margin: "0 0 10px",
                fontSize: "22px",
              }}
            >
              Something went wrong
            </h2>

            <p
              style={{
                opacity: 0.75,
                lineHeight: 1.5,
                marginBottom: "20px",
              }}
            >
              The app ran into an unexpected error. Your saved world has not
              been deleted.
            </p>

            <button
              onClick={() => window.location.reload()}
              style={{
                width: "100%",
                minHeight: "48px",
                border: "none",
                borderRadius: "12px",
                fontSize: "15px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              Reload app
            </button>

            {this.state.error?.message && (
              <div
                style={{
                  marginTop: "18px",
                  padding: "12px",
                  borderRadius: "10px",
                  background: "rgba(255,255,255,0.06)",
                  textAlign: "left",
                  fontSize: "12px",
                  opacity: 0.7,
                  overflowWrap: "anywhere",
                }}
              >
                {this.state.error.message}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);