import { redirect } from "next/navigation";

/** Ruta antigua: la lista vive en /proyectos. */
export default function ObrasRedirect() {
  redirect("/proyectos");
}
