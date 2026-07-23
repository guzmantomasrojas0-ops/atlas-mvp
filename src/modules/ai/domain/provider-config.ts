/**
 * Configuración de un provider. Todavía no incluye credenciales — nada en
 * este sprint hace una llamada HTTP real — solo lo mínimo para que la
 * fábrica de cada provider tenga algo que recibir.
 */
export interface ProviderConfig {
  model?: string;
}
