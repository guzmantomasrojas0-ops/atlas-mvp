/**
 * Base para errores de dominio tipados. Los módulos futuros extienden esta
 * clase (ej. `SlotUnavailableError`, `ServiceNotFoundError`) en vez de lanzar
 * excepciones genéricas. Ver convenciones de código en PLAN.md.
 */
export abstract class AppError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
