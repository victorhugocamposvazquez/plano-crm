import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { capabilities, deploymentLabel, documentationDate, evidenceUrl, productChanges, supervisionSteps, workBranch } from "../../src/lib/sistema/registro";

describe("Documentación verificable del producto", () => {
  it("mantiene fuentes existentes y alcance pendiente para cada capacidad", () => {
    expect(new Set(capabilities.map(item => item.id)).size).toBe(capabilities.length);
    for (const item of capabilities) {
      expect(item.available.length).toBeGreaterThan(0);
      expect(item.pending.length).toBeGreaterThan(0);
      expect(item.evidence.length).toBeGreaterThan(0);
      for (const source of item.evidence) expect(existsSync(source.path), source.path).toBe(true);
    }
    expect(capabilities.find(item => item.id === "fotos")?.status).toBe("pending");
    expect(capabilities.find(item => item.id === "virtual")?.status).toBe("partial");
  });
  it("registra revisiones concretas sin inferir su despliegue", () => {
    expect(new Set(productChanges.map(item => item.id)).size).toBe(productChanges.length);
    for (const change of productChanges) {
      expect(change.commit).toMatch(/^[a-f0-9]{7,40}$/);
      expect(change.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(change.limitation.length).toBeGreaterThan(0);
      expect(change.pullRequest).toBeGreaterThan(0);
    }
    expect(documentationDate).toBe("2026-10-29");
  });
  it("no inventa versión local ni salud o publicación de las entregas", () => {
    expect(deploymentLabel({})).toEqual({ environment: "Local / entorno no identificado", commit: null });
    expect(deploymentLabel({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_SHA: "main" })).toEqual({ environment: "Producción", commit: null });
    const sha = "abcdef1234".repeat(4);
    expect(deploymentLabel({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_SHA: sha })).toEqual({ environment: "Vista previa", commit: sha });
    expect(supervisionSteps.map(item => item.name)).toContain("Revisar y autorizar");
  });
  it("enlaza la evidencia a este despliegue o a la rama de trabajo, sin depender de main", () => {
    const path = "docs/captura/estancias-catalogo.md", sha = "abcdef1234".repeat(4);
    expect(evidenceUrl(path, sha)).toBe(`https://github.com/victorhugocamposvazquez/plano-crm/blob/${sha}/${path}`);
    expect(evidenceUrl(path)).toContain(`/blob/${workBranch}/`);
    expect(evidenceUrl(path, "main")).toContain(`/blob/${workBranch}/`);
    expect(evidenceUrl(path)).not.toContain("/blob/main/");
    expect(capabilities.find(item => item.id === "usabilidad")?.status).toBe("partial");
    expect(productChanges.some(change => change.id === "usabilidad")).toBe(true);
  });
});

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ requireSuperadmin: vi.fn() }));
vi.mock("@/lib/server/superadmin", () => ({ requireSuperadmin: mocks.requireSuperadmin }));
import { renderToStaticMarkup } from "react-dom/server";
import SystemPage from "../../src/app/(app)/sistema/page";
import { ApiError } from "../../src/lib/server/http";

describe("Protección de la documentación renderizada", () => {
  it("no incluye las capacidades ni el changelog cuando falta autorización", async () => {
    mocks.requireSuperadmin.mockRejectedValue(new ApiError(403, "Reservado"));
    const html = renderToStaticMarkup(await SystemPage());
    expect(html).toContain("Acceso reservado");
    expect(html).not.toContain("Presupuesto desde planos PDF");
    expect(html).not.toContain("ea3fadb");
  });
  it("muestra los límites y la supervisión al usuario autorizado", async () => {
    mocks.requireSuperadmin.mockResolvedValue({ actor: { id: "unused" } });
    const html = renderToStaticMarkup(await SystemPage());
    expect(html).toContain("Presupuesto desde planos PDF");
    expect(html).toContain("automatización pendiente");
    expect(html).toContain("Revisar y autorizar");
    expect(html).not.toContain("PLANO_SUPERADMIN_USER_IDS");
  });
});
