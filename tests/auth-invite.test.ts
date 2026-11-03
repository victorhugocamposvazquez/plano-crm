import {beforeEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({verify:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({auth:{verifyOtp:mocks.verify}})}));
import {GET} from "@/app/auth/confirm/route";
beforeEach(()=>{vi.clearAllMocks();mocks.verify.mockResolvedValue({error:null});});
describe("Aceptación de invitación",()=>{
  it("canjea solo invite y vuelve a un destino fijo sin copiar el token",async()=>{
    const token="a".repeat(64),response=await GET(new Request(`https://plano.example/auth/confirm?type=invite&token_hash=${token}&next=https://ajeno.example&role=admin`));
    expect(mocks.verify).toHaveBeenCalledWith({token_hash:token,type:"invite"});expect(response.headers.get("location")).toBe("https://plano.example/");expect(response.headers.get("cache-control")).toContain("no-store");expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it("un enlace inválido o caducado no crea una sesión ni expone errores internos",async()=>{
    expect((await GET(new Request("https://plano.example/auth/confirm?type=recovery&token_hash=abc"))).headers.get("location")).toContain("/login?invitacion=no-valida");expect(mocks.verify).not.toHaveBeenCalled();
    mocks.verify.mockResolvedValue({error:{message:"detalle privado"}});const response=await GET(new Request(`https://plano.example/auth/confirm?type=invite&token_hash=${"b".repeat(64)}`));expect(response.headers.get("location")).toBe("https://plano.example/login?invitacion=no-valida");
  });
});
