import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  createOwnerAccount,
  EmailAlreadyInUseError,
  getSessionUser,
  hashSessionToken,
  InvalidCredentialsError,
  login,
  logout,
  TooManyLoginAttemptsError,
} from "@/modules/auth";
import { createBusiness } from "@/modules/business";

const TIMEZONE = "America/Bogota";

let businessId: string;

beforeEach(async () => {
  const business = await createBusiness({
    name: "Barbería Sprint 21",
    phone: "+57 300 000 0004",
    address: "Calle Falsa 999",
    timezone: TIMEZONE,
    businessType: "BARBERSHOP",
  });
  businessId = business.id;
});

afterEach(async () => {
  await db.session.deleteMany({ where: { user: { businessId } } });
  await db.user.deleteMany({ where: { businessId } });
  await db.business.delete({ where: { id: businessId } });
});

const OWNER_INPUT = { email: "ana@example.com", password: "contraseña-larga", name: "Ana Gómez" };

describe("createOwnerAccount", () => {
  it("crea el usuario con role OWNER y la contraseña hasheada, nunca en texto plano", async () => {
    const user = await createOwnerAccount(businessId, OWNER_INPUT);

    expect(user.role).toBe("OWNER");
    expect(user.email).toBe("ana@example.com");
    expect(user.passwordHash).not.toBe(OWNER_INPUT.password);
    expect(user.passwordHash.length).toBeGreaterThan(20);
  });

  it("rechaza un correo ya usado por otra cuenta", async () => {
    await createOwnerAccount(businessId, OWNER_INPUT);

    await expect(createOwnerAccount(businessId, OWNER_INPUT)).rejects.toThrow(
      EmailAlreadyInUseError,
    );
  });
});

describe("login", () => {
  beforeEach(async () => {
    await createOwnerAccount(businessId, OWNER_INPUT);
  });

  it("con credenciales correctas, devuelve un token y crea una Session persistida", async () => {
    const result = await login({ email: OWNER_INPUT.email, password: OWNER_INPUT.password });

    expect(result.user.email).toBe(OWNER_INPUT.email);
    expect(result.user.role).toBe("OWNER");
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);

    const session = await db.session.findUnique({
      where: { tokenHash: hashSessionToken(result.token) },
    });
    expect(session).not.toBeNull();
    expect(session?.userId).toBe(result.user.id);
  });

  it("rechaza una contraseña incorrecta sin distinguir el motivo", async () => {
    await expect(
      login({ email: OWNER_INPUT.email, password: "contraseña-incorrecta" }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it("rechaza un correo que no existe, con el mismo error que una contraseña incorrecta", async () => {
    await expect(login({ email: "nadie@example.com", password: "cualquiera" })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });
});

describe("login — límite de intentos", () => {
  // Cada test crea su propia cuenta con un email único, no compartido ni con
  // el resto del archivo ni entre sí: el limitador es estado a nivel de
  // módulo, indexado por email — reusar un email entre dos tests dejaría al
  // segundo arrancando con los intentos fallidos que dejó el primero.
  const PASSWORD = "contraseña-real-larga";

  async function seedRateLimitedOwner(emailSuffix: string) {
    const email = `fuerza-bruta-${emailSuffix}@example.com`;
    await createOwnerAccount(businessId, { email, password: PASSWORD, name: "Beto Ruiz" });
    return email;
  }

  it("bloquea el login (incluso con la contraseña correcta) después de 5 intentos fallidos", async () => {
    const email = await seedRateLimitedOwner("bloqueo");
    for (let i = 0; i < 5; i++) {
      await expect(login({ email, password: "incorrecta" })).rejects.toThrow(
        InvalidCredentialsError,
      );
    }

    await expect(login({ email, password: PASSWORD })).rejects.toThrow(TooManyLoginAttemptsError);
  });

  it("un login exitoso no cuenta como intento fallido — no acerca al límite", async () => {
    const email = await seedRateLimitedOwner("exito");
    for (let i = 0; i < 4; i++) {
      await expect(login({ email, password: "incorrecta" })).rejects.toThrow(
        InvalidCredentialsError,
      );
    }

    // El 5to intento es el correcto — no debería bloquear.
    await expect(login({ email, password: PASSWORD })).resolves.toMatchObject({
      user: { email },
    });
  });
});

describe("getSessionUser", () => {
  beforeEach(async () => {
    await createOwnerAccount(businessId, OWNER_INPUT);
  });

  it("con un token válido, resuelve el usuario y el negocio", async () => {
    const { token } = await login({ email: OWNER_INPUT.email, password: OWNER_INPUT.password });

    const resolved = await getSessionUser(token);

    expect(resolved).not.toBeNull();
    expect(resolved?.user.email).toBe(OWNER_INPUT.email);
    expect(resolved?.businessName).toBe("Barbería Sprint 21");
    expect(resolved?.businessTimezone).toBe(TIMEZONE);
  });

  it("con un token inexistente, no resuelve nada (no tira)", async () => {
    expect(await getSessionUser("token-que-nunca-existió")).toBeNull();
  });

  it("con una sesión vencida, no resuelve nada", async () => {
    const { token } = await login({ email: OWNER_INPUT.email, password: OWNER_INPUT.password });
    await db.session.update({
      where: { tokenHash: hashSessionToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await getSessionUser(token)).toBeNull();
  });
});

describe("logout", () => {
  it("borra la sesión — un getSessionUser posterior con el mismo token ya no resuelve nada", async () => {
    await createOwnerAccount(businessId, OWNER_INPUT);
    const { token } = await login({ email: OWNER_INPUT.email, password: OWNER_INPUT.password });
    expect(await getSessionUser(token)).not.toBeNull();

    await logout(token);

    expect(await getSessionUser(token)).toBeNull();
  });

  it("es un no-op silencioso con un token que no existe", async () => {
    await expect(logout("token-inexistente")).resolves.toBeUndefined();
  });
});
