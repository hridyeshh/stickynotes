"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { ACCESS_COOKIE, REFRESH_COOKIE, SIGNED_IN_COOKIE } from "@/lib/session";

type Result = { error?: string };

const token = async () => (await cookies()).get(ACCESS_COOKIE)?.value;

function failed(e: unknown, what: string): Result {
  if (e instanceof ApiError && e.status === 401) return { error: "Your session expired. Reload the page to sign in again." };
  console.error(what, e);
  return { error: "We couldn't reach stickynotes. Try again in a moment." };
}

/** Saves the avatar picked in Settings or during setup. */
export async function setAvatar(avatar: string): Promise<Result> {
  try {
    await api("/api/v1/me", { method: "PATCH", token: await token(), body: { avatar } });
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return failed(e, "set avatar failed");
  }
}

/** Mints a single-use code for the extension's PKCE challenge (/extension/connect). */
export async function createExtensionCode(challenge: string): Promise<{ code?: string; error?: string }> {
  try {
    return await api<{ code: string }>("/api/v1/extension/codes", { method: "POST", token: await token(), body: { code_challenge: challenge } });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return { error: "Your session expired." };
    console.error("extension code failed", e);
    return { error: "We couldn't reach stickynotes." };
  }
}

// Library edits go through the push the extension uses, so every device picks them
// up on its next pull.
async function push(actions: object[]): Promise<Result> {
  try {
    const res = await api<{ rejected: { error: string }[] }>("/api/v1/sync/push", { method: "POST", token: await token(), body: { actions } });
    const why = res.rejected[0]?.error;
    if (why) return { error: why[0].toUpperCase() + why.slice(1) + "." };
  } catch (e) {
    return failed(e, "library edit failed");
  }
  revalidatePath("/", "layout");
  return {};
}

export async function deleteNote(id: string) {
  return push([{ type: "delete_highlight", id }]);
}

export async function renameTopic(id: string, title: string) {
  return push([{ type: "rename_topic", id, title }]);
}

// These two end the topic's page, so they go where its notes went.
export async function deleteTopic(id: string) {
  const r = await push([{ type: "delete_topic", id }]);
  if (!r.error) redirect("/library");
  return r;
}

export async function mergeTopic(id: string, into: string) {
  const r = await push([{ type: "merge_topic", id, topic_id: into }]);
  if (!r.error) redirect(`/t/${into}`);
  return r;
}

/** Files a page under the topic with this title. A new topic with an existing title
 *  merges into that topic on the server, so this both picks and makes. */
export async function moveSource(url: string, title: string) {
  const id = crypto.randomUUID();
  return push([{ type: "create_topic", id, title }, { type: "move_source", url, topic_id: id }]);
}

export async function setShare(id: string, isPublic: boolean): Promise<Result & { slug?: string }> {
  try {
    const res = await api<{ public: boolean; slug: string }>(`/api/v1/topics/${encodeURIComponent(id)}/share`, {
      method: "POST",
      token: await token(),
      body: { public: isPublic },
    });
    revalidatePath("/", "layout");
    return { slug: res.slug };
  } catch (e) {
    return failed(e, "share failed");
  }
}

export async function disconnectDevice(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await api(`/api/v1/devices/${encodeURIComponent(id)}`, { method: "DELETE", token: await token() }).catch((e) =>
    console.error("disconnect failed", e),
  );
  revalidatePath("/settings");
}

export async function deleteAccount(): Promise<Result> {
  try {
    await api("/api/v1/me", { method: "DELETE", token: await token() });
  } catch (e) {
    return failed(e, "delete account failed");
  }
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  jar.delete(SIGNED_IN_COOKIE);
  redirect("/");
}

export async function signOut() {
  const jar = await cookies();
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  // Revoke it server-side too, so the refresh token is dead even if a copy leaked.
  if (refresh) await api("/api/v1/auth/logout", { method: "POST", body: { refresh_token: refresh } }).catch(() => {});
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  jar.delete(SIGNED_IN_COOKIE);
  redirect("/");
}
