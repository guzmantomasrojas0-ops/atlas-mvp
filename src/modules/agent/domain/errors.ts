import { AppError } from "@/lib/errors";

/** Se intentó registrar dos veces una herramienta con el mismo nombre. */
export class ToolAlreadyRegisteredError extends AppError {
  readonly code = "TOOL_ALREADY_REGISTERED";

  constructor(message = "Esa herramienta ya está registrada.") {
    super(message);
  }
}
