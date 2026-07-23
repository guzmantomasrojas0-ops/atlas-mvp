import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // Los specs comparten una sola base de datos de un solo negocio (sin
  // multi-tenancy en la UI todavía) — más de un worker permite que un
  // archivo pise el `businesses` de otro a mitad de test. Un worker evita
  // la condición de carrera sin necesitar aislar los datos por test.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // Dos reintentos, igual en local que en CI. No es para tapar bugs: un test
  // que falla de forma determinística (un bug real) vuelve a fallar en los
  // reintentos y rompe la corrida igual. El caso que originó esto (pagos:
  // confirmar/revertir/reprogramar haciendo un `router.refresh()` extra tras
  // la Server Action, que en un server recién arrancado a veces tardaba más
  // que el timeout de la aserción) ya se corrigió de raíz en el Sprint 24 —
  // esas Server Actions ahora devuelven el dato actualizado y el cliente lo
  // aplica directo, sin round-trip extra (ver `reservations-experience.tsx`).
  // Queda un caso análogo sin tocar (crear reserva/servicio/staff todavía usa
  // `router.refresh()`, ver `create-appointment-panel.tsx` y sus pares) — los
  // reintentos absorben esa flakiness residual mientras tanto.
  retries: 2,
  workers: 1,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
