import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({authenticated:vi.fn(),loadWorkspace:vi.fn(),rpc:vi.fn(),from:vi.fn(),capture:vi.fn(),project:vi.fn(),history:vi.fn(),eq:vi.fn()}));
vi.mock("@/lib/server/workspace",()=>({authenticated:mocks.authenticated,loadWorkspace:mocks.loadWorkspace}));
import { GET,POST } from "@/app/api/proyectos/[id]/captura/route";
import { ApiError } from "@/lib/server/http";
import { survey,catalogue } from "./room-fixture";
import { organization,project,id } from "./fixture";
import { preparedRoomItems } from "@/lib/captura/room-draft";
const params={params:Promise.resolve({id:project})};
const request=(value:unknown={action:"save",expected_revision:0,survey:survey()},origin="https://plano.example")=>new Request(`https://plano.example/api/proyectos/${project}/captura`,{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(value)});
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.from.mockImplementation((table:string)=>{const q={select:()=>q,eq:(...args:unknown[])=>{mocks.eq(...args);return q;},order:()=>q,limit:mocks.history,maybeSingle:table==="projects"?mocks.project:mocks.capture};return q;});
  mocks.authenticated.mockResolvedValue({organizationId:organization,actor:{id:id(99),name:"Oficina",role:"office"},supabase:{from:mocks.from,rpc:mocks.rpc}});
  mocks.loadWorkspace.mockResolvedValue({projects:[{id:project}],articles:catalogue,documents:[{id:id(80),project_id:project,organization_id:organization,mime_type:"image/jpeg"},{id:id(81),project_id:project,organization_id:organization,mime_type:"image/jpeg"}]});
  mocks.project.mockResolvedValue({data:{id:project},error:null});mocks.capture.mockResolvedValue({data:{project_id:project,revision:1,survey:survey()},error:null});mocks.history.mockResolvedValue({data:[],error:null});mocks.rpc.mockResolvedValue({data:{revision:1},error:null});
});
describe("Captura privada por proyecto",()=>{
  it("guarda fuentes autorizadas y usa empresa y revisión autenticadas",async()=>{
    const response=await POST(request(),params);expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.rpc).toHaveBeenCalledWith("save_room_capture",{p_organization_id:organization,p_project_id:project,p_expected_revision:0,p_survey:survey()});
  });
  it("exige origen, sesión y permisos sin ejecutar escrituras",async()=>{
    expect((await POST(request(undefined,"https://ajeno.example"),params)).status).toBe(403);
    mocks.authenticated.mockRejectedValueOnce(new ApiError(401,"Inicia sesión"));expect((await POST(request(),params)).status).toBe(401);
    mocks.authenticated.mockResolvedValue({organizationId:organization,actor:{role:"site"}});expect((await POST(request(),params)).status).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("no admite proyectos ni fuentes ajenas",async()=>{
    const s=survey();s.sources[0].document_id=id(900);
    expect((await POST(request({action:"save",expected_revision:0,survey:s}),params)).status).toBe(400);
    mocks.loadWorkspace.mockResolvedValue({projects:[]});expect((await POST(request(),params)).status).toBe(404);expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("recalcula desde catálogo y rechaza precios manipulados",async()=>{
    const items=preparedRoomItems(survey(),organization,catalogue);
    const input={action:"apply",capture_revision:1,version_id:id(70),expected_revision:0,reviewed:true,expected_items:items};
    items[0].unit_price=1;expect((await POST(request(input),params)).status).toBe(409);expect(mocks.rpc).not.toHaveBeenCalled();
    input.expected_items=preparedRoomItems(survey(),organization,catalogue);
    expect((await POST(request(input),params)).status).toBe(200);expect(mocks.rpc).toHaveBeenCalledWith("apply_room_capture",expect.objectContaining({p_items:input.expected_items,p_reviewed:true}));
  });
  it("un conflicto no guarda ni sustituye la captura",async()=>{
    mocks.rpc.mockResolvedValue({error:{code:"40001"}});expect((await POST(request(),params)).status).toBe(409);
    const input={action:"apply",capture_revision:2,version_id:id(70),expected_revision:0,reviewed:true,expected_items:preparedRoomItems(survey(),organization,catalogue)};
    mocks.rpc.mockClear();expect((await POST(request(input),params)).status).toBe(409);expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("lee solo la empresa y el proyecto elegidos y diferencia migración pendiente",async()=>{
    const get=()=>GET(new Request("https://plano.example/captura"),params);
    expect((await get()).status).toBe(200);expect(mocks.eq).toHaveBeenCalledWith("organization_id",organization);expect(mocks.eq).toHaveBeenCalledWith("project_id",project);
    mocks.capture.mockResolvedValue({error:{code:"PGRST205"}});expect(await (await get()).json()).toEqual({available:false,capture:null,imports:[]});
    mocks.project.mockResolvedValue({data:null,error:null});expect((await get()).status).toBe(404);
  });
});
