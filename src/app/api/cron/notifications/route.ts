import { logger } from "@/lib/logger";
import { getFirstBusiness } from "@/modules/business";
import { runDueNotifications } from "@/modules/notifications";

// Prisma necesita el runtime de Node, no el Edge Runtime.
export const runtime = "nodejs";

/**
 * El "Scheduler" del diagrama de Notifications: no hay nada corriendo en
 * segundo plano dentro de Next.js, así que quien decide CUÁNDO se ejecuta
 * esto es un disparador externo (Vercel Cron — ver `vercel.json` — o
 * cualquier cron/uptime-check apuntando acá con el secreto correcto). Este
 * endpoint solo valida esa llamada y delega toda la lógica de "qué está
 * pendiente" en `notifications/service.ts`.
 */
export async function POST(request: Request): Promise<Response> {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    logger.error("CRON_SECRET no está configurado — no se puede autenticar al scheduler.");
    return new Response("CRON_SECRET no configurado.", { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return new Response("No autorizado.", { status: 401 });
  }

  // El cron externo no trae ninguna sesión de usuario — no hay de dónde
  // derivar "el negocio actual" más que así, hasta que exista routing
  // real por negocio para integraciones servidor-a-servidor (misma
  // limitación que el webhook de WhatsApp, ver el comentario ahí).
  const business = await getFirstBusiness();
  if (!business) {
    // Todavía no hay ningún negocio configurado — nada que notificar.
    return Response.json({ sent: 0, failed: 0, skipped: 0 });
  }

  const summary = await runDueNotifications(business, new Date());
  logger.info(summary, "Corrida de notificaciones completada.");
  return Response.json(summary);
}
