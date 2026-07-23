/**
 * Cómo describirle una herramienta a un modelo de lenguaje — la forma
 * estándar (JSON Schema de sus parámetros) en la que OpenAI, Anthropic y
 * Gemini exponen "tools" al modelo. Deliberadamente propia del módulo `ai`:
 * no importa el `Tool` de `agent` para no acoplar este módulo, agnóstico
 * de proveedor, a la forma interna de otro módulo.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** El modelo pidió ejecutar una herramienta — nunca la ejecuta él mismo. */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** El resultado de haber ejecutado un `ToolCall`, para devolvérselo al modelo en el siguiente turno. */
export interface ToolResult {
  toolCallId: string;
  result: unknown;
  /** Si la ejecución falló, en vez de `result`. */
  error?: string;
}
