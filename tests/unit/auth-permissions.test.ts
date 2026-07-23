import { describe, expect, it } from "vitest";
import { canManageCatalog, canManagePayments, canManageUsers } from "@/modules/auth/domain";

describe("canManagePayments", () => {
  it("permite a OWNER y MANAGER, no a STAFF", () => {
    expect(canManagePayments("OWNER")).toBe(true);
    expect(canManagePayments("MANAGER")).toBe(true);
    expect(canManagePayments("STAFF")).toBe(false);
  });
});

describe("canManageCatalog", () => {
  it("permite a OWNER y MANAGER, no a STAFF", () => {
    expect(canManageCatalog("OWNER")).toBe(true);
    expect(canManageCatalog("MANAGER")).toBe(true);
    expect(canManageCatalog("STAFF")).toBe(false);
  });
});

describe("canManageUsers", () => {
  it("permite solo a OWNER", () => {
    expect(canManageUsers("OWNER")).toBe(true);
    expect(canManageUsers("MANAGER")).toBe(false);
    expect(canManageUsers("STAFF")).toBe(false);
  });
});
