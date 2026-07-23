/**
 * Solo el nombre de la cookie de sesión — nada más. Vive en su propio
 * archivo, sin ningún import de `modules/auth`/Prisma, a propósito:
 * `middleware.ts` corre en el Edge Runtime (sin Node.js APIs), y bastaba con
 * que importara CUALQUIER cosa de `lib/session.ts` para que webpack
 * arrastrara todo ese grafo (Prisma, bcrypt, node:crypto) al bundle de
 * Edge y rompiera el build (`node:fs`/`node:module` no soportados ahí). El
 * middleware nunca necesita más que el nombre para chequear si la cookie
 * existe — la validación real vive en `lib/session.ts`, que sí puede usar
 * Prisma porque corre en el runtime de Node.
 */
export const SESSION_COOKIE_NAME = "atlas_session";
