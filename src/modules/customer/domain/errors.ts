import { AppError } from "@/lib/errors";

/** El cliente no existe, o no pertenece a este negocio. */
export class CustomerNotFoundError extends AppError {
  readonly code = "CUSTOMER_NOT_FOUND";

  constructor(message = "Ese cliente no existe.") {
    super(message);
  }
}
