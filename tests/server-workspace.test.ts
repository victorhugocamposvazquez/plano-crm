import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({create:vi.fn(),getUser:vi.fn(),select:vi.fn(),eq:vi.fn(),range:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:mocks.create}));
import {authenticated,loadWorkspace} from "@/lib/server/workspace";
import {demoId} from "@/lib/demo";
const organization=demoId(1),user=demoId(2);
afterEach(()=>vi.unstubAllEnvs());
beforeEach(()=>{
  vi.clearAllMocks();vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://prueba.supabase.co");vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY","clave-publica-ficticia");
  const members=[{user_id:user,display_name:"Persona",position:"direccion",role:"site"}];
  mocks.getUser.mockResolvedValue({data:{user:{id:user,user_metadata:{role:"admin",position:"direccion"}}},error:null});
  mocks.create.mockResolvedValue({auth:{getUser:mocks.getUser},from:(table:string)=>{
    const q={select:(selection:string)=>{mocks.select(table,selection);return q;},eq:(...args:unknown[])=>{mocks.eq(table,...args);return q;},single:async()=>({data:{name:"Empresa"},error:null}),order:()=>q,
      range:async()=>({data:table==="organization_members"?members:[],error:null}),
      then:(resolve:(value:unknown)=>unknown,reject:(reason:unknown)=>unknown)=>Promise.resolve({data:[{organization_id:organization,...members[0]}],error:null}).then(resolve,reject)};return q;
  }});
});
describe("Contrato del equipo en el espacio autenticado",()=>{
  it("lee rol y puesto de la pertenencia, nunca de metadatos del usuario",async()=>{
    const context=await authenticated();expect(context.actor).toEqual({id:user,name:"Persona",role:"site",position:"direccion"});
    expect(mocks.select).toHaveBeenCalledWith("organization_members","organization_id,display_name,role,position");
  });
  it("proyecta solo cuatro campos del equipo y filtra la empresa de la sesión",async()=>{
    const context=await authenticated(),workspace=await loadWorkspace(context);
    expect(workspace.members).toEqual([{user_id:user,display_name:"Persona",position:"direccion",role:"site"}]);
    expect(mocks.select).toHaveBeenCalledWith("organization_members","user_id,display_name,position,role");
    expect(mocks.eq).toHaveBeenCalledWith("organization_members","organization_id",organization);
    expect(JSON.stringify(workspace.members)).not.toContain("email");
  });
});
