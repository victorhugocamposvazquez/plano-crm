import { z } from "zod";
import { positionSchema, roleSchema } from "./domain";

/** Alta de una cuenta que entra en Plano. La contraseña la elige administración y se la dice a la persona. */
export const altaCuenta = z.object({
  name: z.string().trim().min(1, "Escribe el nombre.").max(80),
  email: z.email("El correo no es válido.").trim().toLowerCase().max(254),
  password: z.string().min(8, "La contraseña necesita al menos 8 caracteres.").max(72),
  position: positionSchema,
  role: roleSchema
});
export type AltaCuenta = z.infer<typeof altaCuenta>;
