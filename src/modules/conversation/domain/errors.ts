import { AppError } from "@/lib/errors";

/** La conversación pedida no existe (o no pertenece a este negocio). */
export class ConversationNotFoundError extends AppError {
  readonly code = "CONVERSATION_NOT_FOUND";

  constructor(message = "Esa conversación no existe.") {
    super(message);
  }
}
