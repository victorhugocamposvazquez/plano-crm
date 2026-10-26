import { describe,it,expect,vi,beforeEach } from "vitest";
import { z } from "zod";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({authenticated:vi.fn(),loadWorkspace:vi.fn(),rpc:vi.fn()}));
vi.mock("@/lib/server/workspace",()=>({authenticated:mocks.authenticated,loadWorkspace:mocks.loadWorkspace}));
import { body,endpoint,ApiError } from "@/lib/server/http";
import { POST } from "@/app/api/commands/route";
import { demoId } from "@/lib/demo";

const input={type:"project.create",name:"Obra",client_name:"Cliente",location:"",kind:"integral"};
const request=(value:unknown=input,origin="https://plano.example")=>new Request("https://plano.example/api/commands",{method:"POST",headers:{origin,"content-type":"application/json","idempotency-key":demoId(100)},body:JSON.stringify(value)});
beforeEach(()=>{
  vi.clearAllMocks();mocks.authenticated.mockResolvedValue({organizationId:demoId(1),actor:{id:demoId(2),name:"Alex",role:"admin"},supabase:{rpc:mocks.rpc}});
  mocks.rpc.mockResolvedValue({error:null});mocks.loadWorkspace.mockResolvedValue({projects:[]});
});
describe("Contrato HTTP y validación",()=>{
  it("rechaza solicitudes de otro origen antes de ejecutar comandos",async()=>{
    const response=await POST(request(input,"https://otra.example"));expect(response.status).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rechaza el JSON no válido y el contenido demasiado grande",async()=>{
    const broken=new Request("https://plano.example/api/commands",{method:"POST",headers:{origin:"https://plano.example","content-type":"application/json"},body:"{"});
    await expect(body(broken,z.object({}))).rejects.toMatchObject({status:400});
    await expect(body(request({large:"x".repeat(2*1024*1024)}),z.object({}))).rejects.toMatchObject({status:413});
  });
  it("no ejecuta datos no válidos",async()=>{
    const response=await POST(request({...input,name:""}));expect(response.status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("usa la organización autenticada y elimina campos no admitidos",async()=>{
    const response=await POST(request({...input,organization_id:demoId(999),role:"admin"}));expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("execute_command",{p_organization_id:demoId(1),p_command:input,p_request_id:demoId(100)});
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("comprueba permisos antes del RPC, incluso con la interfaz manipulada",async()=>{
    mocks.authenticated.mockResolvedValue({organizationId:demoId(1),actor:{role:"site"},supabase:{rpc:mocks.rpc}});
    expect((await POST(request())).status).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("devuelve conflicto para borradores obsoletos",async()=>{
    mocks.rpc.mockResolvedValue({error:{code:"40001",message:"Detalle interno"}});
    const response=await POST(request());expect(response.status).toBe(409);expect(await response.json()).toEqual({error:"Otra persona ha actualizado el borrador. Recarga antes de continuar."});
  });
  it("no expone detalles internos de SQL ni de excepciones",async()=>{
    const log=vi.spyOn(console,"error").mockImplementation(()=>{});
    try {
      mocks.rpc.mockResolvedValue({error:{code:"42P01",message:"Tabla privada y datos internos"}});
      expect(JSON.stringify(await (await POST(request())).json())).not.toContain("Tabla privada");
      const response=await endpoint(async()=>{throw new Error("secreto");});expect(response.status).toBe(500);expect(JSON.stringify(await response.json())).not.toContain("secreto");
    } finally {log.mockRestore();}
  });
  it("mantiene los errores de autenticación sin ejecutar el comando",async()=>{
    mocks.authenticated.mockRejectedValue(new ApiError(401,"Inicia sesión"));expect((await POST(request())).status).toBe(401);expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
