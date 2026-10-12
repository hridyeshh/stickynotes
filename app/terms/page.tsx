import { SiteFooter, SiteHeader } from "@/components/layout";

export const metadata = { title: "Terms · stickynotes" };

export default function Terms() {
  return (
    <>
      <SiteHeader />
      <main className="legal">
        <p className="kicker">Last updated 13 October 2026</p>
        <h1>Terms of use</h1>

        <h2>Your account</h2>
        <p>You need to be at least 13 to use stickynotes. You sign in with a Google account and are responsible for what happens under it.</p>

        <h2>Your notes</h2>
        <p>What you save stays yours. You let us store it and show it to you, and to anyone you give a share link to.</p>

        <h2>Fair use</h2>
        <p>Share links are for your own notes and short excerpts. Don&rsquo;t use them to republish content you don&rsquo;t have the right to share, and don&rsquo;t try to overload, scrape or break the service.</p>

        <h2>The service</h2>
        <p>stickynotes is provided as it is. We may change or stop features, and will give notice and a chance to export before shutting anything down.</p>

        <h2>Ending</h2>
        <p>You can delete your account at any time. We may suspend accounts that abuse the service.</p>

        <h2>Changes</h2>
        <p>If these terms change, we&rsquo;ll update this page and the date above.</p>

        <h2>Contact</h2>
        <p><a href="mailto:hridyesh2309@gmail.com">hridyesh2309@gmail.com</a></p>
      </main>
      <SiteFooter />
    </>
  );
}
