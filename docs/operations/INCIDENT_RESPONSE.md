# Respuesta a incidentes

Cómo comunicar y coordinar un incidente en producción mientras se resuelve
técnicamente — complementa [RECOVERY.md](./RECOVERY.md) (los pasos técnicos
de recuperación) y [MONITORING.md](./MONITORING.md) (cómo te enterás de que
hay un incidente en primer lugar).

## Cómo te enterás

Hoy, con un solo operador (vos) y sin cuenta de Sentry conectada todavía, te
enterás de un incidente por uno de estos caminos:

1. **Un cliente te escribe o llama** — el camino más probable mientras no
   haya alertas automáticas configuradas.
2. **Revisando los logs de Vercel** manualmente.
3. **Sentry**, una vez conectado (ver `MONITORING.md`) — sin alertas
   configuradas ahí todavía, hoy sigue siendo "entrar y mirar", no una
   notificación proactiva.

**Esto es una limitación real**: no hay monitoreo activo/proactivo (uptime
monitoring, alertas por Slack/email) — ver el Production Readiness Report.
Antes del primer cliente real, configurar al menos una alerta de Sentry
(email) y opcionalmente un uptime monitor externo (UptimeRobot, Better
Uptime) es la recomendación de mayor prioridad de esta sección.

## Severidad — cómo clasificar rápido

| Severidad                                       | Ejemplo                                                                       | Objetivo de respuesta                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------ |
| **SEV1 — Caído para todos**                     | El sitio no carga, login roto para todos los negocios, base inaccesible.      | Inmediato — dropear lo que estés haciendo. |
| **SEV2 — Feature crítica rota, resto funciona** | No se pueden confirmar pagos, el agente de IA no responde, WhatsApp no envía. | Mismo día.                                 |
| **SEV3 — Degradado, hay workaround**            | Un negocio puntual ve datos raros, una página específica es lenta.            | Próximos días.                             |
| **SEV4 — Cosmético / no bloqueante**            | Un texto mal alineado, un ícono faltante.                                     | Backlog normal.                            |

## Durante el incidente (SEV1/SEV2)

1. **Confirmar el alcance**: ¿es un negocio o todos? ¿Es una función o todo
   el sitio? Esto decide si es un problema de datos de un tenant específico
   o algo estructural (deploy roto, Neon caído, etc. — ver `RECOVERY.md` para
   los escenarios técnicos).
2. **Comunicar, aunque sea a un solo cliente afectado**: un mensaje breve y
   honesto ("Estamos al tanto de un problema con X, estamos trabajando en
   solucionarlo") vale más que el silencio, incluso sin un canal de status
   page formal todavía (no existe uno — con la base de clientes actual, un
   mensaje directo por WhatsApp/email alcanza).
3. **Resolver siguiendo `RECOVERY.md`** según el escenario (dato corrupto,
   base inaccesible, deploy roto, código perdido).
4. **No improvisar sobre producción sin un plan**: si la solución no es
   obvia en los primeros minutos, es preferible un rollback del deploy
   (`RECOVERY.md`, Escenario C) mientras se diagnostica con calma, en vez de
   seguir probando cambios en caliente.

## Después del incidente

1. **Confirmar con el/los cliente(s) afectado(s)** que ya está resuelto.
2. **Postmortem breve por escrito** (no hace falta un template elaborado con
   un solo operador — alcanza con: qué pasó, por qué, qué cambia para que no
   vuelva a pasar). Guardarlo — es la memoria institucional de qué se rompió
   antes y cómo, algo que hoy no existe en ningún lado de este repo.
3. **Si el incidente reveló un gap de monitoreo/alertas** (te enteraste por
   un cliente, no por una alerta): esa es la acción de seguimiento de más
   alto valor, más que cualquier fix puntual — ver la sección de arriba.

## Este documento es deliberadamente simple

Con un solo operador y sin equipo de guardia, un runbook de incident
response de nivel enterprise (roles de incident commander, canales
dedicados, escalamiento entre turnos) sería teatro — no ficción útil, pero
tampoco necesaria todavía. Esto crece cuando haya un equipo real operando
ATLAS, no antes.
