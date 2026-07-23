import { describe, expect, it } from "vitest";
import { AI_PROVIDER_NAMES, isAIProviderName } from "@/modules/ai/domain";

describe("isAIProviderName", () => {
  it.each(AI_PROVIDER_NAMES)("%s es un proveedor válido", (name) => {
    expect(isAIProviderName(name)).toBe(true);
  });

  it("rechaza un nombre que no está en la lista", () => {
    expect(isAIProviderName("chatgpt")).toBe(false);
    expect(isAIProviderName("")).toBe(false);
    expect(isAIProviderName("OpenAI")).toBe(false); // sensible a mayúsculas a propósito
  });
});
