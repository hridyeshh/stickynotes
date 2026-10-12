import { Brand } from "@/components/layout";
import { load, type Me } from "@/lib/data";
import { Onboarding } from "./onboarding";

export const metadata = { title: "Get set up · stickynotes" };

// Signed-in only (see middleware). New accounts land here from "Get started".
export default async function OnboardingPage() {
  const me = await load<Me>("/api/v1/me");
  return (
    <div className="auth-page setup-desk">
      <Brand href="/library" />
      <Onboarding name={me.name} email={me.email} connected={!!me.extension_seen_at} />
    </div>
  );
}
