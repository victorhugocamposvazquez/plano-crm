import { describe,it,expect,vi,beforeEach,afterEach } from "vitest";
import { z } from "zod";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({authenticated:vi.fn(),loadWorkspace:vi.fn(),rpc:vi.fn(),invite:vi.fn()}));
vi.mock("@supabase/supabase-js",()=>({createClient:()=>({auth:{admin:{inviteUserByEmail:mocks.invite}}})}));
vi.mock("@/lib/server/workspace",()=>({authenticated:mocks.authenticated,loadWorkspace:mocks.loadWorkspace}));
import { body,endpoint,ApiError } from "@/lib/server/http";
import { POST } from "@/app/api/commands/route";
import { demoId } from "@/lib/demo";

const input={type:"project.create",name:"Obra",client_name:"Cliente",location:"",kind:"integral"};
const request=(value:unknown=input,origin="https://plano.example")=>new Request("https://plano.example/api/commands",{method:"POST",headers:{origin,"content-type":"application/json","idempotency-key":demoId(100)},body:JSON.stringify(value)});
afterEach(()=>vi.unstubAllEnvs());
beforeEach(()=>{
  vi.stubEnv("PLANO_MEMBER_INVITES_ENABLED","");
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


describe("API de puestos y equipo",()=>{
  const update={type:"member.update",user_id:demoId(3),position:"jefe_obra",role:"manager"};
  const invite={type:"member.invite",email:"prueba@example.test",position:"equipo",role:"site"};
  it("un site no puede cambiar puestos aunque declare dirección",async()=>{
    mocks.authenticated.mockResolvedValue({organizationId:demoId(1),actor:{role:"site",position:"direccion"},supabase:{rpc:mocks.rpc}});
    expect((await POST(request(update))).status).toBe(403);expect((await POST(request(invite))).status).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.invite).not.toHaveBeenCalled();
  });
  it("rechaza destinatarios de otra empresa en la frontera SQL y no altera la aprobación",async()=>{
    mocks.rpc.mockResolvedValue({error:{code:"23503",message:"La persona no pertenece a esta empresa."}});
    const response=await POST(request({type:"task.update",id:demoId(200),assignee_id:demoId(999)}));
    expect(response.status).toBe(400);expect((await response.json()).error).toBe("La persona no pertenece a esta empresa.");
    expect(mocks.rpc).toHaveBeenCalledWith("execute_command",expect.objectContaining({p_command:{type:"task.update",id:demoId(200),assignee_id:demoId(999)}}));
  });
  it("devuelve la identidad actualizada para que el puesto real viaje al navegador",async()=>{
    mocks.loadWorkspace.mockResolvedValue({members:[{user_id:demoId(2),display_name:"Alex",position:"oficina",role:"admin"}]});
    const response=await POST(request({...update,user_id:demoId(2),position:"oficina",role:"admin"}));expect((await response.json()).actor).toEqual({id:demoId(2),name:"Alex",position:"oficina",role:"admin"});
  });
  it("sin envío configurado informa del alta manual sin preparar ni enviar correos",async()=>{
    expect((await POST(request(invite))).status).toBe(503);expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.invite).not.toHaveBeenCalled();
  });
  function configured(){vi.stubEnv("PLANO_MEMBER_INVITES_ENABLED","true");vi.stubEnv("SUPABASE_SECRET_KEY","clave-ficticia-prueba");vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://prueba.supabase.co");}
  it("envía con Auth después del reclamo y completa el alta; un reintento no reenvía",async()=>{
    configured();mocks.invite.mockResolvedValue({data:{user:{id:demoId(8)}},error:null});
    mocks.rpc.mockResolvedValueOnce({error:null}).mockResolvedValueOnce({data:{send:true,status:"sending"},error:null}).mockResolvedValueOnce({error:null});
    expect((await POST(request(invite))).status).toBe(200);expect(mocks.invite).toHaveBeenCalledExactlyOnceWith("prueba@example.test");
    expect(mocks.rpc).toHaveBeenCalledWith("complete_member_invitation",{p_organization_id:demoId(1),p_request_id:demoId(100),p_user_id:demoId(8)});
    mocks.rpc.mockResolvedValueOnce({error:null}).mockResolvedValueOnce({data:{send:false,status:"sent",user_id:demoId(8)},error:null});
    expect((await POST(request(invite))).status).toBe(200);expect(mocks.invite).toHaveBeenCalledTimes(1);
  });
  it("no anuncia éxito si Auth o el alta fallan, ni expone su mensaje interno",async()=>{
    configured();mocks.rpc.mockResolvedValueOnce({error:null}).mockResolvedValueOnce({data:{send:true,status:"sending"},error:null});
    mocks.invite.mockResolvedValue({data:{user:null},error:{message:"dato privado"}});
    const response=await POST(request(invite));expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain("dato privado");
    mocks.rpc.mockResolvedValueOnce({error:null}).mockResolvedValueOnce({data:{send:false,status:"sending",user_id:demoId(8)},error:null}).mockResolvedValueOnce({error:{code:"42501"}});
    expect((await POST(request(invite))).status).toBe(409);expect(mocks.invite).toHaveBeenCalledTimes(1);
    mocks.rpc.mockResolvedValueOnce({error:null}).mockResolvedValueOnce({data:{send:true,status:"sending"},error:null});mocks.invite.mockRejectedValueOnce(new Error("dato privado de red"));
    expect((await POST(request(invite))).status).toBe(503);
  });
});
