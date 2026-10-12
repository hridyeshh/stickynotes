"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { SIGNED_IN_COOKIE } from "@/lib/session";

/** Keeps <html data-signed-in> in step with the hint cookie after navigations, since signing out redirects without
 *  a page load. The first paint is marked by the inline script in app/layout.tsx. */
export function SignedInFlag() {
  const path = usePathname();
  useLayoutEffect(() => {
    document.documentElement.toggleAttribute("data-signed-in", document.cookie.split("; ").includes(`${SIGNED_IN_COOKIE}=1`));
  }, [path]);
  return null;
}
