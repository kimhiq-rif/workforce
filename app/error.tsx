"use client";

import { useEffect } from "react";

export default function Error({
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
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--surface)",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 420,
          background: "white",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 24,
          boxShadow: "var(--shadow-card)",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          Something went wrong
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6 }}>
          The screen failed to load. Try again, or sign out and reconnect the owner account.
        </p>
        <button
          className="btn-primary"
          onClick={reset}
          style={{ marginTop: 18, justifyContent: "center" }}
        >
          Try again
        </button>
      </section>
    </main>
  );
}
