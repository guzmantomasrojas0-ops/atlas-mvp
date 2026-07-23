import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Tiempo relativo ("hace 5 minutos") respecto al reloj de quien lo mira —
 * a propósito NO pasa por zona horaria del negocio como en `scheduling`,
 * porque "hace cuánto" es relativo a quien lee, no al negocio.
 */
export function formatRelativeTime(date: Date): string {
  return formatDistanceToNow(date, { locale: es, addSuffix: true });
}
