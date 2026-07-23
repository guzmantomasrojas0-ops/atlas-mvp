"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Red de última instancia: captura errores de render que ni un error.tsx de
 * segmento pudo manejar (incluye errores en el propio root layout). Next.js
 * exige que este archivo reemplace <html>/<body> por completo — no puede
 * heredar de layout.tsx porque layout.tsx podría ser la causa del error.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#09090b",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Algo salió mal</h1>
          <p style={{ fontSize: 14, color: "#a1a1aa", marginBottom: 20 }}>
            El equipo ya fue notificado. Probá recargar la página en unos segundos.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: "#6640e0",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Recargar
          </button>
        </div>
      </body>
    </html>
  );
}
