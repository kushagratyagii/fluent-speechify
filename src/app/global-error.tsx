"use client";

import { useEffect } from "react";

/**
 * Only fires if the root layout itself throws (fonts, providers, etc). It
 * has to render its own <html>/<body> because it replaces the layout that
 * would normally provide them.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100dvh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "1.5rem",
            textAlign: "center",
          }}
        >
          <p style={{ fontWeight: 600 }}>Fluent hit an unexpected error</p>
          <p style={{ maxWidth: 360, color: "#6b7280", fontSize: "0.875rem" }}>
            Your practice data is saved on this device. Reloading usually
            fixes this.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              background: "#111827",
              color: "white",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
