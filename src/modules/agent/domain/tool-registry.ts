import { ToolAlreadyRegisteredError } from "./errors";
import type { Tool, ToolName } from "./tool";

/**
 * Registro de herramientas disponibles para el agente. Hoy se instancia
 * vacío — a medida que existan implementaciones reales (SearchAvailability,
 * CreateReservation, etc.) se registran acá, sin tocar el resto del motor.
 */
export class ToolRegistry {
  private readonly tools = new Map<ToolName, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new ToolAlreadyRegisteredError(`La herramienta "${tool.name}" ya está registrada.`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * `string`, no `ToolName` — a nombre puede venir de un modelo real
   * (tool-calling), que no está atado en compilación a los nombres que
   * conocemos. Buscar con un nombre inexistente simplemente no encuentra
   * nada, nunca revienta.
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name as ToolName);
  }

  has(name: string): boolean {
    return this.tools.has(name as ToolName);
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }
}
