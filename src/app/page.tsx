import { redirect } from "next/navigation";

/** «Hoy» llegará con la agenda; mientras tanto la entrada es la lista de obras. */
export default function HomePage() {
  redirect("/obras");
}
