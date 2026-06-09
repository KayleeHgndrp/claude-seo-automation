import { redirect } from "next/navigation";

// Root simply forwards to the outreach tool; middleware gates /admin and
// bounces unauthenticated users to /login.
export default function Home() {
  redirect("/admin/outreach");
}
