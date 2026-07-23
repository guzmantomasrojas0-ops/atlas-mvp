import { describe, expect, it } from "vitest";
import {
  assertLoginAttemptAllowed,
  recordFailedLoginAttempt,
  resetLoginAttempts,
  TooManyLoginAttemptsError,
} from "@/modules/auth/domain/rate-limiter";

// Cada test usa un email único (o un `now` bien distinto) — el limitador es
// un Map a nivel de módulo compartido entre tests de este archivo; usar el
// mismo email en dos tests distintos haría que el estado de uno contamine
// al otro.
let counter = 0;
function uniqueEmail(): string {
  counter += 1;
  return `rate-limit-test-${counter}@example.com`;
}

describe("assertLoginAttemptAllowed / recordFailedLoginAttempt", () => {
  it("permite los primeros intentos sin tirar", () => {
    const email = uniqueEmail();
    for (let i = 0; i < 4; i++) {
      expect(() => assertLoginAttemptAllowed(email)).not.toThrow();
      recordFailedLoginAttempt(email);
    }
  });

  it("bloquea al quinto intento fallido dentro de la ventana", () => {
    const email = uniqueEmail();
    for (let i = 0; i < 5; i++) {
      assertLoginAttemptAllowed(email);
      recordFailedLoginAttempt(email);
    }
    expect(() => assertLoginAttemptAllowed(email)).toThrow(TooManyLoginAttemptsError);
  });

  it("resetLoginAttempts limpia el contador — un login exitoso no deja arrastrando fallos previos", () => {
    const email = uniqueEmail();
    for (let i = 0; i < 5; i++) {
      assertLoginAttemptAllowed(email);
      recordFailedLoginAttempt(email);
    }
    expect(() => assertLoginAttemptAllowed(email)).toThrow(TooManyLoginAttemptsError);

    resetLoginAttempts(email);

    expect(() => assertLoginAttemptAllowed(email)).not.toThrow();
  });

  it("la ventana expira — pasados los 15 minutos, se puede volver a intentar", () => {
    const email = uniqueEmail();
    const start = Date.now();
    for (let i = 0; i < 5; i++) {
      assertLoginAttemptAllowed(email, start);
      recordFailedLoginAttempt(email, start);
    }
    expect(() => assertLoginAttemptAllowed(email, start)).toThrow(TooManyLoginAttemptsError);

    const afterWindow = start + 15 * 60 * 1000 + 1;
    expect(() => assertLoginAttemptAllowed(email, afterWindow)).not.toThrow();
  });

  it("cada email tiene su propio contador — uno bloqueado no afecta a otro", () => {
    const blockedEmail = uniqueEmail();
    const otherEmail = uniqueEmail();
    for (let i = 0; i < 5; i++) {
      assertLoginAttemptAllowed(blockedEmail);
      recordFailedLoginAttempt(blockedEmail);
    }
    expect(() => assertLoginAttemptAllowed(blockedEmail)).toThrow(TooManyLoginAttemptsError);
    expect(() => assertLoginAttemptAllowed(otherEmail)).not.toThrow();
  });
});
