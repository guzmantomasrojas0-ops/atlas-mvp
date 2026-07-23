import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AIService } from "@/modules/ai";
import { createAnthropicProvider } from "@/modules/ai/providers";
import { converseWithAgent } from "@/modules/agent";
import type { BusinessRef } from "@/modules/agent";
import { createBusiness } from "@/modules/business";
import { createService, createStaffMember } from "@/modules/catalog";
import { findOrCreateConversation, listMessages } from "@/modules/conversation";

const TIMEZONE = "America/Bogota";

/**
 * El único archivo de este proyecto que le pega de verdad a la API de
 * Anthropic — se salta solo si no hay `ANTHROPIC_API_KEY` configurada (que
 * es el caso en este entorno). En cuanto se agregue una key real a `.env`,
 * este test se activa solo y valida el loop conversacional completo de
 * punta a punta contra el modelo real, sin tener que tocar nada más.
 *
 * Por diseño (ver PLAN.md): el LLM es no determinista y no pertenece al
 * camino crítico de CI — todo lo demás (mapeo de requests/responses, los
 * límites del loop) se valida con el SDK mockeado o con un modelo fake en
 * `tests/unit/ai-anthropic-provider.test.ts` y
 * `tests/integration/agent-ai.test.ts`.
 */
describe.skipIf(!process.env.ANTHROPIC_API_KEY)(
  "Anthropic real (requiere ANTHROPIC_API_KEY)",
  () => {
    let business: BusinessRef;
    let businessId: string;
    let conversationId: string;

    beforeEach(async () => {
      const created = await createBusiness({
        name: "Barbería El Buen Corte",
        phone: "+57 300 000 0000",
        address: "Calle Falsa 123",
        timezone: TIMEZONE,
        businessType: "BARBERSHOP",
      });
      business = { id: created.id, name: created.name, timezone: created.timezone };
      businessId = created.id;

      await createService(businessId, { name: "Corte de pelo", price: 25000, durationMinutes: 30 });
      await createStaffMember(businessId, { name: "Ana Gómez", role: "Barbera" });

      const client = await db.client.create({ data: { businessId, name: "María Gómez" } });
      const conversation = await findOrCreateConversation(businessId, client.id, "WHATSAPP");
      conversationId = conversation.id;
    });

    afterEach(async () => {
      await db.message.deleteMany({ where: { conversation: { businessId } } });
      await db.conversation.deleteMany({ where: { businessId } });
      await db.client.deleteMany({ where: { businessId } });
      await db.service.deleteMany({ where: { businessId } });
      await db.staffMember.deleteMany({ where: { businessId } });
      await db.business.delete({ where: { id: businessId } });
    });

    it("responde un saludo real en lenguaje natural, sin necesitar ninguna tool", async () => {
      const aiService = new AIService(createAnthropicProvider());

      const result = await converseWithAgent(
        business,
        conversationId,
        "¡Hola! Buenos días",
        aiService,
      );

      expect(result.stopReason).toBe("final_response");
      expect(result.response).toBeTruthy();

      const messages = await listMessages(conversationId);
      expect(messages.at(-1)?.sender).toBe("AGENT");
    }, 30_000);

    it("usa la tool real de precios para responder una consulta real, sin inventar el dato", async () => {
      const aiService = new AIService(createAnthropicProvider());

      const result = await converseWithAgent(
        business,
        conversationId,
        "¿Cuánto sale el corte de pelo?",
        aiService,
      );

      expect(result.stopReason).toBe("final_response");
      expect(result.steps.some((step) => step.toolName === "FIND_SERVICE")).toBe(true);
      expect(result.response).toContain("25.000");
    }, 30_000);
  },
);
