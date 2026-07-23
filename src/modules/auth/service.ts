import {
  assertLoginAttemptAllowed,
  createOwnerAccountInputSchema,
  EmailAlreadyInUseError,
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  InvalidCredentialsError,
  loginInputSchema,
  recordFailedLoginAttempt,
  resetLoginAttempts,
  SESSION_DURATION_MS,
  verifyPassword,
  type AuthenticatedUser,
  type CreateOwnerAccountInput,
  type LoginInput,
} from "./domain";
import {
  createSession,
  createUser,
  deleteSessionByTokenHash,
  findSessionByTokenHash,
  findUserByEmail,
} from "./data";

export interface LoginResult {
  token: string;
  user: AuthenticatedUser;
}

/**
 * Verifica credenciales y abre una sesión nueva. El mensaje de error es
 * idéntico para "no existe ese correo" y "la contraseña no coincide" — dar
 * información distinta le regalaría a un atacante qué correos están
 * registrados. También limita intentos por email (`assertLoginAttemptAllowed`)
 * — la primera defensa contra fuerza bruta/credential stuffing sobre este
 * endpoint (ver el comentario de `rate-limiter.ts` para su alcance real).
 */
export async function login(input: LoginInput): Promise<LoginResult> {
  const data = loginInputSchema.parse(input);
  assertLoginAttemptAllowed(data.email);

  const user = await findUserByEmail(data.email);
  if (!user) {
    recordFailedLoginAttempt(data.email);
    throw new InvalidCredentialsError();
  }

  const passwordMatches = await verifyPassword(data.password, user.passwordHash);
  if (!passwordMatches) {
    recordFailedLoginAttempt(data.email);
    throw new InvalidCredentialsError();
  }

  resetLoginAttempts(data.email);
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await createSession(user.id, tokenHash, expiresAt);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      businessId: user.businessId,
    },
  };
}

export async function logout(token: string): Promise<void> {
  await deleteSessionByTokenHash(hashSessionToken(token));
}

/**
 * Resuelve el usuario (y su negocio) a partir del token crudo de la cookie.
 * Nunca tira: un token inválido, o una sesión vencida, simplemente no
 * resuelve a nadie — quien llama (`lib/session.ts`) decide qué hacer con eso
 * (redirigir a /login).
 */
export async function getSessionUser(
  token: string,
): Promise<{ user: AuthenticatedUser; businessName: string; businessTimezone: string } | null> {
  const session = await findSessionByTokenHash(hashSessionToken(token));
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      businessId: session.user.businessId,
    },
    businessName: session.user.business.name,
    businessTimezone: session.user.business.timezone,
  };
}

/**
 * Crea la primera cuenta (OWNER) de un negocio recién creado — el puente
 * mínimo entre "crear negocio" y "poder iniciar sesión en él", hasta que
 * exista un onboarding self-service completo (Sprint 25).
 */
export async function createOwnerAccount(businessId: string, input: CreateOwnerAccountInput) {
  const data = createOwnerAccountInputSchema.parse(input);
  const passwordHash = await hashPassword(data.password);
  try {
    return await createUser(businessId, {
      email: data.email,
      passwordHash,
      name: data.name,
      role: "OWNER",
    });
  } catch (error) {
    if (isUniqueEmailViolation(error)) throw new EmailAlreadyInUseError();
    throw error;
  }
}

/** Mismo patrón de detección por mensaje/meta que `isExclusionViolation` en scheduling/service.ts — evita acoplar este módulo a las clases de error internas de Prisma. */
function isUniqueEmailViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String((error as { message?: unknown }).message) : "";
  const meta = "meta" in error ? JSON.stringify((error as { meta?: unknown }).meta ?? {}) : "";
  const haystack = `${message} ${meta}`.toLowerCase();
  return haystack.includes("unique constraint") && haystack.includes("email");
}
