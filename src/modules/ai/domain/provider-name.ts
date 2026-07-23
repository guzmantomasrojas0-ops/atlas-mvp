/** Los proveedores soportados. Es el único lugar donde este listado existe. */
export const AI_PROVIDER_NAMES = ["openai", "anthropic", "gemini"] as const;

export type AIProviderName = (typeof AI_PROVIDER_NAMES)[number];

/** ¿Este string es uno de los proveedores soportados? Usado al leer `AI_PROVIDER` desde el entorno. */
export function isAIProviderName(value: string): value is AIProviderName {
  return (AI_PROVIDER_NAMES as readonly string[]).includes(value);
}
