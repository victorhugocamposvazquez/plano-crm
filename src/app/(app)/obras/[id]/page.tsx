import { redirect } from "next/navigation";

/** Ruta antigua: la ficha vive en /proyectos/[id]. */
export default async function ObraRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/proyectos/${encodeURIComponent(id)}`);
}
