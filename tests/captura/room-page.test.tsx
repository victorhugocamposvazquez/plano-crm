import { describe,it,expect,vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createDemo } from "@/lib/demo";
vi.mock("next/navigation",()=>({useParams:()=>({id:"00000000-0000-4000-8000-000000000010"}),useSearchParams:()=>new URLSearchParams(),useRouter:()=>({push:vi.fn()})}));
vi.mock("@/components/workspace-provider",()=>({useWorkspace:()=>({data:createDemo(),loading:false})}));
import CapturaPage from "@/app/(app)/proyectos/[id]/captura/page";
describe("Recuperación de la captura tras recargar",()=>{
  it("conserva el estado de carga del servidor aunque el espacio ya haya llegado al cliente",()=>{
    const html=renderToStaticMarkup(<CapturaPage/>);
    expect(html).toContain("Cargando el proyecto");expect(html).not.toContain("Fotos y trabajos por zonas");
  });
});
