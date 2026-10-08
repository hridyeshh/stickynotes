import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout";
import { api, ApiError } from "@/lib/api";
import { ACCESS_COOKIE, type User } from "@/lib/session";

export const metadata = { title: "Your notes · stickynotes" };

// Phase 2 placeholder: proves sign-in end to end. Topics arrive in phase 5.
export default async function Library() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  let user: User;
  try {
    user = await api<User>("/api/v1/me", { token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect("/signin");
    throw e;
  }

  return (
    <>
      <AppHeader user={user} />
      <main className="page">
        <h1 className="page-title">Your notes</h1>
        <div className="empty">
          <div className="empty-title">No notes yet</div>
          <p className="text-muted">Select a passage on any page and it will appear here.</p>
        </div>
      </main>
    </>
  );
}
