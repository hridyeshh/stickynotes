import { Brand } from "@/components/layout";
import { Connect } from "./connect";

export const metadata = { title: "Connect the extension · stickynotes" };

// Signed-in only (see middleware). The extension's popup opens this page to link
// this browser to the account.
export default function ConnectExtension() {
  return (
    <div className="auth-page setup-desk">
      <Brand />
      <Connect />
    </div>
  );
}
