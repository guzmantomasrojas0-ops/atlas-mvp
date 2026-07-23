import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatRelativeTime } from "@/modules/conversation/domain";

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formatea minutos en español", () => {
    const fiveMinutesAgo = new Date("2026-07-20T11:55:00Z");
    expect(formatRelativeTime(fiveMinutesAgo)).toBe("hace 5 minutos");
  });

  it("formatea horas en español", () => {
    const twoHoursAgo = new Date("2026-07-20T10:00:00Z");
    expect(formatRelativeTime(twoHoursAgo)).toBe("hace alrededor de 2 horas");
  });

  it("formatea días en español", () => {
    const twoDaysAgo = new Date("2026-07-18T12:00:00Z");
    expect(formatRelativeTime(twoDaysAgo)).toBe("hace 2 días");
  });
});
