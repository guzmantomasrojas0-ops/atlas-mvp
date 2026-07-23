import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import type { ToolRegistry } from "./tool-registry";

export type ToolExecutionErrorCode =
  "TOOL_NOT_FOUND" | "INVALID_INPUT" | "BUSINESS_ERROR" | "INTERNAL_ERROR";

export interface ToolExecutionError {
  code: ToolExecutionErrorCode;
  message: string;
}

/**
 * Resultado uniforme de correr una Tool — sin importar cuál, ni si salió
 * bien o mal. `payload` y `error` son mutuamente excluyentes según
 * `success`. Nunca es una excepción: todo lo que puede pasar al ejecutar
 * una Tool queda representado acá. `toolName` es `string`, no `ToolName` —
 * puede reflejar un nombre que un modelo real inventó y que no existe.
 */
export interface ToolExecutionResult<TPayload = unknown> {
  success: boolean;
  toolName: string;
  executionTimeMs: number;
  payload: TPayload | null;
  error: ToolExecutionError | null;
  metadata: Record<string, unknown>;
}

function classifyError(error: unknown): Pick<ToolExecutionResult, "error" | "metadata"> {
  if (error instanceof ZodError) {
    return {
      error: {
        code: "INVALID_INPUT",
        message: "Los parámetros para esta herramienta no son válidos.",
      },
      metadata: { issues: error.issues.map((issue) => issue.message) },
    };
  }

  if (error instanceof AppError) {
    return {
      error: { code: "BUSINESS_ERROR", message: error.message },
      metadata: { appErrorCode: error.code },
    };
  }

  return {
    error: {
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Error desconocido.",
    },
    metadata: {},
  };
}

/**
 * El Execution Engine: localiza la Tool en el registro, valida el input
 * contra el `inputSchema` que ella misma declara, la ejecuta, y devuelve
 * siempre el mismo formato — nunca deja escapar una excepción hacia quien
 * llama. `toolName` es `string`, no `ToolName`: puede venir de un modelo
 * real vía tool-calling, que no está atado en compilación a los nombres
 * que registramos — "herramienta inexistente" es, a propósito, el mismo
 * camino que "no encontrada" para cualquier nombre desconocido.
 */
export async function executeTool(
  toolName: string,
  input: unknown,
  toolRegistry: ToolRegistry,
): Promise<ToolExecutionResult> {
  const startedAt = Date.now();
  const tool = toolRegistry.get(toolName);

  if (!tool) {
    return {
      success: false,
      toolName,
      executionTimeMs: Date.now() - startedAt,
      payload: null,
      error: {
        code: "TOOL_NOT_FOUND",
        message: `No existe una herramienta registrada con el nombre "${toolName}".`,
      },
      metadata: {},
    };
  }

  try {
    const parsedInput = tool.inputSchema.parse(input);
    const payload = await tool.execute(parsedInput);
    return {
      success: true,
      toolName,
      executionTimeMs: Date.now() - startedAt,
      payload,
      error: null,
      metadata: {},
    };
  } catch (error) {
    const { error: executionError, metadata } = classifyError(error);
    return {
      success: false,
      toolName,
      executionTimeMs: Date.now() - startedAt,
      payload: null,
      error: executionError,
      metadata,
    };
  }
}
