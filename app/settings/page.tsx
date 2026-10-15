import Link from "next/link";
import { Archive, Download, FileText, LogOut, Monitor, Puzzle, Smartphone } from "lucide-react";
import { disconnectDevice, signOut } from "@/app/actions";
import { AvatarPicker } from "@/components/avatar-picker";
import { AppHeader, AvatarImg } from "@/components/layout";
import { load, type Me } from "@/lib/data";
import { avatarOf, deviceLabel, timeAgo, type Device } from "@/lib/notes";
import { DeleteAccount } from "./settings";

export const metadata = { title: "Settings · stickynotes" };

export default async function Settings() {
  const [me, devices] = await Promise.all([load<Me>("/api/v1/me"), load<Device[]>("/api/v1/devices")]);
  // oxlint-disable-next-line react/purity -- a server component renders once per request
  const now = Date.now();
  const seed = me.name || me.email;

  return (
    <>
      <AppHeader user={me} current="settings" />
      {/* The prototype's layout: each section's name and what it's for on the left; on the right a row per thing,
          with a button that says what it does. */}
      <main className="page page-settings">
        <h1 className="page-title">Settings</h1>

        <section className="settings-section">
          <h2>Account</h2>
          <div className="settings-rows">
            <div className="settings-row">
              <span className="avatar avatar-lg" aria-hidden="true"><AvatarImg pick={me.avatar} seed={seed} /></span>
              <div className="settings-what">
                <div className="settings-name">{me.name || me.email}</div>
                <div className="settings-note">{me.name && `${me.email} · `}signed in with Google</div>
              </div>
              <form action={signOut}>
                <button className="btn btn-secondary"><LogOut size={15} aria-hidden="true" />Sign out</button>
              </form>
            </div>
            <div className="settings-row avatar-pick">
              <div className="settings-name">Avatar</div>
              <div className="settings-note">Shows beside your name here and on topics you share.</div>
              <AvatarPicker current={avatarOf(me.avatar, seed)} />
            </div>
          </div>
        </section>

        <section className="settings-section">
          <div>
            <h2>Devices</h2>
            <p className="settings-note">Browsers and extensions signed in to your account. Disconnecting one signs it out within 15 minutes.</p>
          </div>
          <ul className="settings-rows">
            {devices.map((d) => {
              const Icon = d.client === "extension" ? Puzzle : /iPhone|iPad|Android/.test(d.user_agent) ? Smartphone : Monitor;
              return (
                <li key={d.id} className="settings-row">
                  <span className="settings-icon"><Icon size={19} aria-hidden="true" /></span>
                  <div className="settings-what">
                    <div className="settings-name">{deviceLabel(d)}</div>
                    <div className="settings-note">Last active {timeAgo(d.last_active, now)}</div>
                  </div>
                  <form action={disconnectDevice}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className="btn btn-secondary" aria-label={`Disconnect ${deviceLabel(d)}`}>Disconnect</button>
                  </form>
                </li>
              );
            })}
            {!me.extension_seen_at && (
              <li className="settings-row">
                <span className="settings-icon"><Puzzle size={19} aria-hidden="true" /></span>
                <div className="settings-what">
                  <div className="settings-name">No extension yet</div>
                  <div className="settings-note">Highlight on any page and the notes land here.</div>
                </div>
                <Link href="/onboarding" className="btn btn-primary">Connect the extension</Link>
              </li>
            )}
          </ul>
        </section>

        <section className="settings-section">
          <div>
            <h2>Your data</h2>
            <p className="settings-note">Every note, with its topic and source, downloaded as one file.</p>
          </div>
          <ul className="settings-rows">
            <li className="settings-row">
              <span className="settings-icon"><FileText size={19} aria-hidden="true" /></span>
              <div className="settings-what">
                <div className="settings-name">Markdown (.md)</div>
                <div className="settings-note">Reads in any text editor or notes app.</div>
              </div>
              <a href="/export?format=md" className="btn btn-secondary" aria-label="Download Markdown"><Download size={15} aria-hidden="true" />Download</a>
            </li>
            <li className="settings-row">
              <span className="settings-icon"><Archive size={19} aria-hidden="true" /></span>
              <div className="settings-what">
                <div className="settings-name">Backup (.json)</div>
                <div className="settings-note">The extension can restore it: All notes → Restore.</div>
              </div>
              <a href="/export?format=json" className="btn btn-secondary" aria-label="Download backup"><Download size={15} aria-hidden="true" />Download</a>
            </li>
          </ul>
        </section>

        <section className="settings-section">
          <div>
            <h2 className="danger">Delete account</h2>
            <p className="settings-note">Permanently removes your account, every note and every share link. This can&apos;t be undone.</p>
          </div>
          <div><DeleteAccount /></div>
        </section>
      </main>
    </>
  );
}
