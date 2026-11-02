import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({authenticated:vi.fn(),loadWorkspace:vi.fn(),rpc:vi.fn(),from:vi.fn(),capture:vi.fn(),project:vi.fn(),eq:vi.fn()}));
vi.mock("@/lib/server/workspace",()=>({authenticated:mocks.authenticated,loadWorkspace:mocks.loadWorkspace}));
import { GET,POST } from "@/app/api/proyectos/[id]/planos/borrador/route";
import { ApiError } from "@/lib/server/http";
import { planFixture } from "./plan-fixture";
import { demoActor,demoId } from "@/lib/demo";
let fixture:ReturnType<typeof planFixture>;
const params=()=>({params:Promise.resolve({id:fixture.draft.projectId})});
const request=(draft=fixture.draft,origin="https://plano.example")=>new Request(`https://plano.example/api/proyectos/${fixture.draft.projectId}/planos/borrador`,{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify({draft,expected_revision:0})});
beforeEach(()=>{
  vi.clearAllMocks();fixture=planFixture();
  mocks.from.mockImplementation((table:string)=>{const q={select:()=>q,eq:(...args:unknown[])=>{mocks.eq(...args);return q;},maybeSingle:table==="projects"?mocks.project:mocks.capture};return q;});
  mocks.authenticated.mockResolvedValue({organizationId:fixture.workspace.organization_id,actor:demoActor,supabase:{from:mocks.from,rpc:mocks.rpc}});
  mocks.loadWorkspace.mockResolvedValue(fixture.workspace);mocks.project.mockResolvedValue({data:{id:fixture.draft.projectId},error:null});
  mocks.capture.mockResolvedValue({data:{project_id:fixture.draft.projectId,revision:1,draft:fixture.draft},error:null});mocks.rpc.mockResolvedValue({data:{revision:1},error:null});
});
describe("Preparación PDF privada",()=>{
  it("guarda la lectura validada con organización de sesión y no modifica el presupuesto",async()=>{
    const response=await POST(request(),params());expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("save_plan_capture",{p_organization_id:fixture.workspace.organization_id,p_project_id:fixture.draft.projectId,p_expected_revision:0,p_draft:fixture.draft});
  });
  it("exige sesión, origen y permiso de presupuestar",async()=>{
    expect((await POST(request(undefined,"https://ajeno.example"),params())).status).toBe(403);
    mocks.authenticated.mockRejectedValueOnce(new ApiError(401,"Inicia sesión"));expect((await POST(request(),params())).status).toBe(401);
    mocks.authenticated.mockResolvedValue({actor:{role:"site"}});expect((await POST(request(),params())).status).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rechaza un PDF o un presupuesto de otro proyecto antes del RPC",async()=>{
    fixture.draft.planos[0].documentId=demoId(888);expect((await POST(request(),params())).status).toBe(400);
    fixture=planFixture();fixture.draft.budgetId=demoId(888);expect((await POST(request(),params())).status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("distingue conflicto, migración pendiente y contenido dañado sin reemplazarlo",async()=>{
    mocks.rpc.mockResolvedValue({error:{code:"40001"}});expect((await POST(request(),params())).status).toBe(409);
    const get=()=>GET(new Request("https://plano.example"),params());expect((await get()).status).toBe(200);
    expect(mocks.eq).toHaveBeenCalledWith("organization_id",fixture.workspace.organization_id);expect(mocks.eq).toHaveBeenCalledWith("project_id",fixture.draft.projectId);
    mocks.capture.mockResolvedValue({error:{code:"PGRST205"}});expect(await (await get()).json()).toEqual({available:false,capture:null});
    mocks.capture.mockResolvedValue({data:{draft:{version:0}}});expect((await get()).status).toBe(409);
    mocks.project.mockResolvedValue({data:null});expect((await get()).status).toBe(404);
  });
});
