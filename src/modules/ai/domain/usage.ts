/** Consumo de tokens de una llamada — la forma común en la que todo proveedor factura. */
export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
