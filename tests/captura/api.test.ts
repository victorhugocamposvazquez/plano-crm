import { describe,it,expect,vi,beforeEach } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({authenticated:vi.fn(),loadWorkspace:vi.fn(),rpc:vi.fn()}));
vi.mock("@/lib/server/workspace",()=>({authenticated:mocks.authenticated,loadWorkspace:mocks.loadWorkspace}));
import { POST } from "../../src/app/api/estimaciones/previsualizar/route";
import { ApiError } from "../../src/lib/server/http";
import { fixture,articles,organization,project,id } from "./fixture";
const request=(input:unknown=fixture(),origin="https://plano.example")=>new Request("https://plano.example/api/estimaciones/previsualizar",{
  method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(input)
});
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.authenticated.mockResolvedValue({organizationId:organization,actor:{id:id(50),role:"manager"},supabase:{rpc:mocks.rpc}});
  mocks.loadWorkspace.mockResolvedValue({projects:[{id:project,organization_id:organization}],articles,documents:[]});
});
describe("Previsualización autorizada y sin escrituras",()=>{
  it("usa el catálogo del servidor y solo devuelve una propuesta",async()=>{
    const response=await POST(request());expect(response.status).toBe(200);
    const {proposal}=await response.json();expect(proposal.priced_subtotal.base).toBe(100000);expect(proposal.persisted).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("rechaza precios y permisos suministrados por el cliente",async()=>{
    expect((await POST(request({...fixture(),articles,role:"admin"}))).status).toBe(400);
    const input=fixture();const tampered={...input,intents:[{...input.intents[0],unit_price:1}]};
    expect((await POST(request(tampered))).status).toBe(400);expect(mocks.loadWorkspace).not.toHaveBeenCalled();
  });
  it.each(["site","viewer"])("impide preparar precios al perfil %s",async(role)=>{
    mocks.authenticated.mockResolvedValue({organizationId:organization,actor:{role}});
    expect((await POST(request())).status).toBe(403);expect(mocks.loadWorkspace).not.toHaveBeenCalled();
  });
  it("requiere sesión y mismo origen",async()=>{
    expect((await POST(request(fixture(),"https://otra.example"))).status).toBe(403);
    mocks.authenticated.mockRejectedValue(new ApiError(401,"Inicia sesión"));
    expect((await POST(request())).status).toBe(401);
  });
  it("rechaza proyectos ajenos",async()=>{
    expect((await POST(request({...fixture(),project_id:id(99)}))).status).toBe(404);
  });
  it("rechaza documentos de otro proyecto incluso dentro de la misma organización",async()=>{
    const input=fixture();input.sources[0].document_id=id(70);
    mocks.loadWorkspace.mockResolvedValue({projects:[{id:project,organization_id:organization}],articles,documents:[{id:id(70),project_id:id(99),organization_id:organization}]});
    expect((await POST(request(input))).status).toBe(404);
  });
  it("una carencia de medición es una propuesta bloqueada, no una escritura parcial",async()=>{
    const input=fixture();input.measurements=[];
    const response=await POST(request(input));expect(response.status).toBe(200);
    const {proposal}=await response.json();expect(proposal.complete).toBe(false);expect(proposal.lines[0].issues[0].code).toBe("missing_measurement");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
