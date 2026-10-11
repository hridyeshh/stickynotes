import Link from "next/link";
import { disconnectDevice, signOut } from "@/app/actions";
import { AppHeader, initials } from "@/components/layout";
import { load, type Me } from "@/lib/data";
import { deviceLabel, timeAgo, type Device } from "@/lib/notes";
import { DeleteAccount } from "./settings";

export const metadata = { title: "Settings · stickynotes" };

export default async function Settings() {
  const [me, devices] = await Promise.all([load<Me>("/api/v1/me"), load<Device[]>("/api/v1/devices")]);
  // oxlint-disable-next-line react/purity -- a server component renders once per request
  const now = Date.now();

  return (
    <>
      <AppHeader user={me} current="settings" />
      <main className="page page-settings">
        <h1 className="page-title">Settings</h1>

        <section className="settings-section">
          <h2>Account</h2>
          <div className="settings-body account-row">
            <span className="avatar avatar-lg" aria-hidden="true">{initials(me.name || me.email)}</span>
            <div className="account-who">
              <div className="account-name">{me.name || me.email}</div>
              <div className="settings-note">{me.email} · signed in with Google</div>
            </div>
            <form action={signOut}><button className="btn btn-secondary">Sign out</button></form>
          </div>
        </section>

        <section className="settings-section">
          <h2>Devices</h2>
          <div className="settings-body">
            <p className="settings-note">
              Browsers and extensions signed in to your account. Disconnecting one signs it out within 15 minutes.
            </p>
            <ul className="device-list">
              {devices.map((d) => (
                <li key={d.id} className="device-row">
                  <div>
                    <div>{deviceLabel(d)}</div>
                    <div className="settings-note">Last active {timeAgo(d.last_active, now)}</div>
                  </div>
                  <form action={disconnectDevice}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className="btn btn-ghost">Disconnect</button>
                  </form>
                </li>
              ))}
            </ul>
            {!me.extension_seen_at && <Link href="/onboarding" className="btn btn-primary">Connect the extension</Link>}
          </div>
        </section>

        <section className="settings-section">
          <h2>Your data</h2>
          <div className="settings-body">
            <p className="settings-note">
              Download every note as Markdown, or as a backup the extension can restore (All notes → Restore).
            </p>
            <div className="row-actions">
              <a href="/export?format=md" className="btn btn-secondary">Export Markdown</a>
              <a href="/export?format=json" className="btn btn-secondary">Backup (.json)</a>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h2 className="danger">Delete account</h2>
          <div className="settings-body">
            <p className="settings-note">Permanently removes your account, every note and every share link. This can&apos;t be undone.</p>
            <DeleteAccount />
          </div>
        </section>
      </main>
    </>
  );
}
