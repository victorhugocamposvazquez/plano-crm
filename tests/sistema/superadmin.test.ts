import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ authenticated: vi.fn() }));
vi.mock("@/lib/server/workspace", () => ({ authenticated: mocks.authenticated }));
import { isSuperadminUser, requireSuperadmin } from "../../src/lib/server/superadmin";
import { ApiError } from "../../src/lib/server/http";
import { GET } from "../../src/app/(app)/sistema/acceso/route";

const authorized = "aaaaaaaa-1111-4111-8111-111111111111";
const other = "bbbbbbbb-2222-4222-8222-222222222222";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PLANO_SUPERADMIN_USER_IDS", authorized);
  mocks.authenticated.mockResolvedValue({ organizationId: "current-org", actor: { id: authorized, role: "viewer" } });
});
afterEach(() => vi.unstubAllEnvs());

describe("Supervisión del producto, independiente del rol de empresa", () => {
  it.each([undefined, "", " ", "*", "admin", `${authorized},`, `${authorized},not-a-uuid`])("deniega una allowlist vacía o incorrecta: %s", configured => {
    expect(isSuperadminUser(authorized, configured)).toBe(false);
  });
  it("compara UUID completos, sin coincidencias parciales ni correos", () => {
    expect(isSuperadminUser(other, authorized)).toBe(false);
    expect(isSuperadminUser(authorized.slice(0, 8), authorized)).toBe(false);
    expect(isSuperadminUser("admin@example.test", authorized)).toBe(false);
    expect(isSuperadminUser(authorized.toUpperCase(), ` ${other}, ${authorized} `)).toBe(true);
  });
  it("exige sesión validada aunque el ID esté configurado", async () => {
    mocks.authenticated.mockRejectedValue(new ApiError(401, "Inicia sesión"));
    await expect(requireSuperadmin()).rejects.toMatchObject({ status: 401 });
    expect((await GET()).status).toBe(401);
  });
  it("el rol admin de una organización no concede el acceso", async () => {
    mocks.authenticated.mockResolvedValue({ organizationId: "current-org", actor: { id: other, role: "admin" } });
    await expect(requireSuperadmin()).rejects.toMatchObject({ status: 403 });
    const response = await GET();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ allowed: false });
  });
  it("no modifica permisos de empresa ni devuelve la identidad en el descubrimiento", async () => {
    const context = await requireSuperadmin();
    expect(context.actor.role).toBe("viewer");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ allowed: true });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toContain("Cookie");
  });
  it("sin allowlist no habilita un acceso de demostración", async () => {
    vi.stubEnv("PLANO_SUPERADMIN_USER_IDS", "");
    await expect(requireSuperadmin()).rejects.toMatchObject({ status: 403 });
    expect(mocks.authenticated).not.toHaveBeenCalled();
  });
  it("un error de conexión no concede acceso ni filtra su mensaje", async () => {
    mocks.authenticated.mockRejectedValue(new Error("detalle interno sensible"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ allowed: false });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
