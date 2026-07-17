# ATLAS

Empleado digital para negocios locales (barberías, salones, clínicas). Ver [PLAN.md](./PLAN.md) para la arquitectura completa, el roadmap por fases y las decisiones de diseño.

**Estado actual: Fase 0 — Fundaciones.** Este repo contiene únicamente la base técnica del proyecto: el proyecto compila, tiene una estructura de carpetas modular, un schema de base de datos mínimo y las herramientas de calidad (lint, formato, tests) configuradas. **No hay todavía**: IA/agente conversacional, widget embebible, dashboard, autenticación, ni lógica de reservas. Esas piezas llegan en las fases siguientes descritas en PLAN.md.

## Stack

- [Next.js 15](https://nextjs.org/) (App Router) + TypeScript
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Prisma 7](https://www.prisma.io/) + PostgreSQL
- [Zod](https://zod.dev/) para validación
- [Vitest](https://vitest.dev/) (unit/integración) + [Playwright](https://playwright.dev/) (E2E)
- ESLint + Prettier

## Requisitos

- Node.js 20+ (probado con Node 24)
- Una base de datos PostgreSQL accesible (local o remota)

## Puesta en marcha

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Copiar el archivo de entorno y ajustar la cadena de conexión a tu Postgres:

   ```bash
   cp .env.example .env
   ```

   Editar `DATABASE_URL` en `.env` con las credenciales reales. Formato:

   ```
   postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
   ```

3. Generar el cliente de Prisma:

   ```bash
   npm run prisma:generate
   ```

4. Aplicar el schema a la base de datos (requiere que `DATABASE_URL` apunte a un Postgres real y accesible):

   ```bash
   npm run prisma:migrate
   ```

   > Este paso no se ejecutó como parte de este scaffold porque no hay una instancia de Postgres disponible en el entorno en que se generó el proyecto. El schema (`prisma/schema.prisma`) ya está validado y el cliente ya se generó; falta únicamente correr la migración contra una base real.

5. Levantar el servidor de desarrollo:

   ```bash
   npm run dev
   ```

   Abrir [http://localhost:3000](http://localhost:3000).

## Scripts disponibles

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build de producción |
| `npm run lint` | ESLint |
| `npm run format` | Formatea todo el repo con Prettier |
| `npm run format:check` | Verifica formato sin modificar archivos |
| `npm run typecheck` | Chequeo de tipos de TypeScript (`tsc --noEmit`) |
| `npm run test` | Tests unitarios/integración (Vitest) |
| `npm run test:watch` | Vitest en modo watch |
| `npm run test:e2e` | Tests E2E (Playwright) — levanta un build de producción y corre contra Chromium |
| `npm run prisma:generate` | Regenera el cliente de Prisma a partir del schema |
| `npm run prisma:migrate` | Crea y aplica una migración (requiere Postgres accesible) |
| `npm run prisma:studio` | Abre Prisma Studio |

## Estructura del proyecto

```
src/
├── app/            # Next.js App Router — grupos de rutas y API routes (esqueleto, sin implementar)
├── modules/         # Monolito modular: business, catalog, scheduling, conversation,
│                     # agent, channels, notifications, auth, audit — cada uno con su
│                     # propia capa de dominio/datos y una única puerta de entrada pública (index.ts)
├── components/       # ui / dashboard / widget (vacío en esta fase)
├── lib/              # db.ts, config.ts, logger.ts, errors.ts, llm-client.ts (infraestructura común)
└── types/            # tipos compartidos entre módulos

prisma/
├── schema.prisma     # 8 modelos mínimos: Business, StaffMember, Service, Client,
│                       Appointment, Conversation, Message, AgentAction
└── seed.ts           # placeholder, sin datos de ejemplo todavía

tests/
├── unit/             # Vitest
├── integration/       # Vitest contra Postgres real (a implementar junto con los módulos)
└── e2e/               # Playwright
```

Ver la sección 3 de [PLAN.md](./PLAN.md) para el árbol completo y el razonamiento detrás de cada límite de módulo.

## Convenciones

Ningún módulo importa el `domain/` o `data/` interno de otro módulo — solo su `index.ts` público. Ver la sección 5 de [PLAN.md](./PLAN.md) para el resto de las convenciones de código.

## Próximos pasos

Las fases siguientes (implementación de negocio/catálogo, motor de agenda, agente conversacional, acciones reales, notificaciones, dashboard) están descritas en la sección 8 de [PLAN.md](./PLAN.md) y se abordan una por una, no en este scaffold.
