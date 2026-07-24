export type Role = "OWNER" | "MANAGER" | "STAFF";

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Correo o contraseña incorrectos.");
    this.name = "InvalidCredentialsError";
  }
}

export class EmailAlreadyInUseError extends Error {
  constructor() {
    super("Ya existe una cuenta con ese correo.");
    this.name = "EmailAlreadyInUseError";
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super("La sesión expiró. Inicia sesión de nuevo.");
    this.name = "SessionExpiredError";
  }
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  businessId: string;
}
