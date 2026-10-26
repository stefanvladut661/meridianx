import { redirect } from "next/navigation";

/** /admin/postari — coada vine în faza 4; până atunci, intrarea duce la clipuri. */
export default function PostariPage() {
  redirect("/admin/postari/clipuri");
}
