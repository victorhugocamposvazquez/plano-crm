import { describe,it,expect,vi,beforeEach } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({authenticated:vi.fn(),from:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn(),rpc:vi.fn(),order:vi.fn(),range:vi.fn()}));
vi.mock("@/lib/server/workspace",()=>({authenticated:mocks.authenticated}));
import { GET } from "@/app/api/budgets/[id]/versions/[version]/changes/route";
import { ApiError } from "@/lib/server/http";
import { demoId } from "@/lib/demo";
const params={id:demoId(50),version:demoId(61)};
const get=()=>GET(new Request("https://plano.example/api/budgets/changes"),{params:Promise.resolve(params)});
beforeEach(()=>{
  vi.clearAllMocks();
  const query={select:()=>query,eq:mocks.eq,maybeSingle:mocks.maybeSingle};mocks.eq.mockReturnValue(query);mocks.from.mockReturnValue(query);
  mocks.maybeSingle.mockResolvedValue({data:{id:params.version},error:null});
  mocks.rpc.mockReturnValue({order:mocks.order});mocks.order.mockReturnValue({range:mocks.range});mocks.range.mockResolvedValue({data:[],error:null});
  mocks.authenticated.mockResolvedValue({organizationId:demoId(1),supabase:{from:mocks.from,rpc:mocks.rpc}});
});
describe("Lectura privada de fechas de partidas",()=>{
  it("rechaza una revisión no válida",async()=>{
    const response=await GET(new Request("https://plano.example/api/budgets/changes?revision=-1"),{params:Promise.resolve(params)});
    expect(response.status).toBe(400);expect(mocks.authenticated).not.toHaveBeenCalled();
  });
  it("exige sesión",async()=>{
    mocks.authenticated.mockRejectedValue(new ApiError(401,"Inicia sesión"));expect((await get()).status).toBe(401);expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("comprueba presupuesto, versión y empresa antes de leer el registro",async()=>{
    mocks.maybeSingle.mockResolvedValue({data:null,error:null});expect((await get()).status).toBe(404);
    expect(mocks.eq).toHaveBeenCalledWith("budget_id",params.id);expect(mocks.eq).toHaveBeenCalledWith("organization_id",demoId(1));
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("pagina sin truncar y no permite almacenar fechas privadas en caché",async()=>{
    const edit={item_id:demoId(100),version_id:params.version,occurred_at:"2026-10-30T09:00:00Z"};
    mocks.range.mockResolvedValueOnce({data:Array.from({length:500},()=>edit),error:null}).mockResolvedValueOnce({data:[edit],error:null});
    const response=await get();expect(response.status).toBe(200);expect((await response.json()).edits).toHaveLength(501);
    expect(mocks.range).toHaveBeenNthCalledWith(2,500,999);expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("distingue una migración pendiente de un histórico sin cambios",async()=>{
    mocks.range.mockResolvedValue({error:{code:"PGRST202"}});expect(await (await get()).json()).toEqual({available:false,edits:[]});
    mocks.range.mockResolvedValue({data:[],error:null});expect(await (await get()).json()).toEqual({available:true,edits:[]});
  });
  it("no disfraza errores de permisos como ausencia de fechas",async()=>{
    mocks.range.mockResolvedValue({error:{code:"42501"}});expect((await get()).status).toBe(403);
  });
});
