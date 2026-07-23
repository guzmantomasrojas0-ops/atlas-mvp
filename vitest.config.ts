import "dotenv/config";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    // Los tests de integración comparten una sola base Postgres viva (tablas
    // globales como `businesses`) — correr archivos de test en paralelo deja
    // que uno cuente/mute una tabla mientras otro está a mitad de su propio
    // before/after, dando falsos negativos intermitentes.
    fileParallelism: false,
  },
});
