import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/lib/api";
import { libraryMarkdown, toBackup, type Library } from "@/lib/notes";
import { ACCESS_COOKIE } from "@/lib/session";

// Downloads every note: ?format=md (default) or ?format=json, the extension's backup
// format. Signed-in only (see middleware, which also refreshes the token).
export async function GET(req: NextRequest) {
  const lib = await api<Library>("/api/v1/library", { token: req.cookies.get(ACCESS_COOKIE)?.value }).catch(() => null);
  if (!lib) return NextResponse.redirect(new URL("/signin?next=/settings", req.url));

  const json = req.nextUrl.searchParams.get("format") === "json";
  const body = json ? JSON.stringify(toBackup(lib), null, 2) : libraryMarkdown(lib, Date.now());
  const name = `stickynotes-${new Date().toISOString().slice(0, 10)}.${json ? "json" : "md"}`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": json ? "application/json" : "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
