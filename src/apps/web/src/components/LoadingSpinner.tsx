import type { CSSProperties } from "react";

export interface LoadingSpinnerProps {
  size?: "small" | "medium" | "large";
  message?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({ size = "medium", message, fullScreen = false }: LoadingSpinnerProps) {
  const sizeMap = {
    small: "24px",
    medium: "48px",
    large: "72px"
  };

  const spinnerStyle: CSSProperties = {
    width: sizeMap[size],
    height: sizeMap[size],
    border: "3px solid rgba(255, 255, 255, 0.1)",
    borderTop: "3px solid #00d4ff",
    borderRadius: "50%",
    animation: "spin 1s linear infinite"
  };

  const containerStyle: CSSProperties = fullScreen
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 9999
      }
    : {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem"
      };

  return (
    <div style={containerStyle}>
      <div style={spinnerStyle} />
      {message && (
        <p style={{ marginTop: "1rem", color: "#fff", fontSize: "0.875rem" }}>
          {message}
        </p>
      )}
    </div>
  );
}

// Inline spinner for buttons
export function InlineSpinner({ size = 16 }: { size?: number }) {
  const spinnerStyle: CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    border: "2px solid rgba(255, 255, 255, 0.3)",
    borderTop: "2px solid #fff",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    display: "inline-block",
    marginRight: "0.5rem"
  };

  return <span style={spinnerStyle} />;
}
