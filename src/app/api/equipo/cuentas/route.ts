import { altaCuenta } from "@/lib/cuentas";
import { crearCuenta } from "@/lib/server/crear-cuenta";
import { body, endpoint, json } from "@/lib/server/http";

export async function POST(request: Request) {
  return endpoint(async () => {
    const datos = await body(request, altaCuenta);
    const workspace = await crearCuenta(datos);
    return json({ workspace });
  });
}
