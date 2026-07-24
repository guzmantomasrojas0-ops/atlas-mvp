const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos

interface AttemptWindow {
  count: number;
  windowStartedAt: number;
}

/**
 * Limitador de intentos de login en memoria, por email. Es la primera capa
 * de defensa contra fuerza bruta/credential stuffing sobre `/login` — antes
 * de este módulo no existía ninguna. Limitación conocida y deliberada: este
 * estado vive en la memoria del proceso, así que en un despliegue con más
 * de una instancia (serverless multi-región, varios pods) cada instancia
 * lleva su propia cuenta — un atacante distribuido entre instancias no
 * queda bloqueado de verdad. Para eso hace falta un store compartido (ej.
 * Redis/Upstash), que es infraestructura nueva fuera del alcance de un
 * hardening — ver el informe de Production Readiness. Mientras tanto, esto
 * sí protege el caso común (una sola instancia, o el mismo atacante pegándole
 * siempre a la misma).
 */
const attemptsByEmail = new Map<string, AttemptWindow>();

export class TooManyLoginAttemptsError extends Error {
  constructor() {
    super("Demasiados intentos fallidos. Espera unos minutos antes de volver a intentar.");
    this.name = "TooManyLoginAttemptsError";
  }
}

function currentWindow(email: string, now: number): AttemptWindow {
  const existing = attemptsByEmail.get(email);
  if (existing && now - existing.windowStartedAt < WINDOW_MS) return existing;
  const fresh: AttemptWindow = { count: 0, windowStartedAt: now };
  attemptsByEmail.set(email, fresh);
  return fresh;
}

/** Tira `TooManyLoginAttemptsError` si ya se agotaron los intentos para este email en la ventana actual. */
export function assertLoginAttemptAllowed(email: string, now: number = Date.now()): void {
  const window = currentWindow(email, now);
  if (window.count >= MAX_ATTEMPTS) throw new TooManyLoginAttemptsError();
}

/** Se llama tras una contraseña incorrecta — cuenta el intento fallido. */
export function recordFailedLoginAttempt(email: string, now: number = Date.now()): void {
  const window = currentWindow(email, now);
  window.count += 1;
}

/** Se llama tras un login exitoso — un login real no debería seguir arrastrando intentos fallidos previos. */
export function resetLoginAttempts(email: string): void {
  attemptsByEmail.delete(email);
}
