import { describe,it,expect,vi,beforeEach } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({authenticated:vi.fn(),loadWorkspace:vi.fn(),rpc:vi.fn()}));
vi.mock("@/lib/server/workspace",()=>({authenticated:mocks.authenticated,loadWorkspace:mocks.loadWorkspace}));
import { POST } from "../../src/app/api/estimaciones/estancias/route";
import { survey,catalogue } from "./room-fixture";
import { organization,project,id } from "./fixture";
import { ApiError } from "../../src/lib/server/http";
const documents=[{id:id(80),project_id:project,organization_id:organization,mime_type:"image/jpeg"},{id:id(81),project_id:project,organization_id:organization,mime_type:"image/jpeg"}];
const request=(data:unknown=survey(),origin="https://plano.example")=>new Request("https://plano.example/api/estimaciones/estancias",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(data)});
beforeEach(()=>{
  vi.clearAllMocks();mocks.authenticated.mockResolvedValue({organizationId:organization,actor:{role:"manager"},supabase:{rpc:mocks.rpc}});
  mocks.loadWorkspace.mockResolvedValue({projects:[{id:project,organization_id:organization}],articles:catalogue,documents});
});
describe("API de propuesta por estancias",()=>{
  it("calcula desde catálogo autorizado sin guardar ni llamar a servicios de imágenes",async()=>{
    const response=await POST(request());expect(response.status).toBe(200);
    const {proposal}=await response.json();expect(proposal.priced_subtotal.base).toBe(65000);expect(proposal.persisted).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it.each(["site","viewer"])("no expone presupuesto al perfil %s",async role=>{
    mocks.authenticated.mockResolvedValue({organizationId:organization,actor:{role}});expect((await POST(request())).status).toBe(403);
    expect(mocks.loadWorkspace).not.toHaveBeenCalled();
  });
  it("requiere sesión y origen válido",async()=>{
    expect((await POST(request(survey(),"https://otra.example"))).status).toBe(403);
    mocks.authenticated.mockRejectedValue(new ApiError(401,"Inicia sesión"));expect((await POST(request())).status).toBe(401);
  });
  it("rechaza proyecto y documentos ajenos, incluso de otro proyecto de la misma empresa",async()=>{
    expect((await POST(request({...survey(),project_id:id(99)}))).status).toBe(404);
    mocks.loadWorkspace.mockResolvedValue({projects:[{id:project,organization_id:organization}],articles:catalogue,documents:[{...documents[0],project_id:id(99)},documents[1]]});
    expect((await POST(request())).status).toBe(404);
  });
  it("exige originales adjuntos y un tipo de documento coherente",async()=>{
    const input=survey();delete input.sources[0].document_id;expect((await POST(request(input))).status).toBe(400);
    mocks.loadWorkspace.mockResolvedValue({projects:[{id:project,organization_id:organization}],articles:catalogue,documents:[{...documents[0],mime_type:"application/pdf"},documents[1]]});
    expect((await POST(request())).status).toBe(400);
  });
  it("rechaza importes y permisos inyectados en la solicitud",async()=>{
    expect((await POST(request({...survey(),articles:catalogue,role:"admin"}))).status).toBe(400);expect(mocks.loadWorkspace).not.toHaveBeenCalled();
  });
});
