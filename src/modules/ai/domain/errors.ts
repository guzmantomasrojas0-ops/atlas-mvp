import { AppError } from "@/lib/errors";

/** Se pidió un proveedor de IA que no existe (por ejemplo, un `AI_PROVIDER` mal escrito). */
export class UnknownProviderError extends AppError {
  readonly code = "UNKNOWN_AI_PROVIDER";

  constructor(message = "El proveedor de IA configurado no existe.") {
    super(message);
  }
}

/** Un proveedor real necesita una credencial (API key) que no está configurada. */
export class MissingCredentialsError extends AppError {
  readonly code = "MISSING_AI_CREDENTIALS";

  constructor(message = "Faltan las credenciales para este proveedor de IA.") {
    super(message);
  }
}
