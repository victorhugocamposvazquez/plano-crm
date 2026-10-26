import { redirect } from "next/navigation";

/** Ruta antigua: la visita vive en /proyectos/nueva. */
export default function NuevaObraRedirect() {
  redirect("/proyectos/nueva");
}
