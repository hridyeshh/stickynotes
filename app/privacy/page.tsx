import { SiteFooter, SiteHeader } from "@/components/layout";

export const metadata = { title: "Privacy policy · stickynotes" };

export default function Privacy() {
  return (
    <>
      <SiteHeader />
      <main className="legal">
        <p className="kicker">Draft · last updated 9 October 2026</p>
        <h1>Privacy policy</h1>
        <p>stickynotes is a browser extension and website for keeping notes from what you read. This page explains what we store and why.</p>

        <h2>What we store</h2>
        <ul>
          <li><strong>Your account.</strong> When you sign in with Google we receive your name, email address and profile picture. We never see your Google password and get no access to anything else in your Google account.</li>
          <li><strong>Your notes.</strong> The text you save, the section heading it sat under, the title and address of the page it came from, and a few words around it so the extension can find the passage again.</li>
          <li><strong>Signed-in devices.</strong> For each browser you sign in on we keep the browser type, so you can see your devices and sign them out.</li>
        </ul>

        <h2>What we don&rsquo;t</h2>
        <p>We don&rsquo;t record your browsing. The extension only sends a page&rsquo;s address when you save a note on that page. There are no ads or third-party trackers, and we never sell your data.</p>

        <h2>Sharing</h2>
        <p>Notes are private. If you share a topic, anyone with its link can read that topic&rsquo;s notes and sources until you turn the link off.</p>

        <h2>Your control</h2>
        <p>You can export everything as Markdown or JSON, delete single notes or whole topics, and delete your account. Deleting your account removes your notes, share links and sessions from our database straight away.</p>

        <h2>Where it lives</h2>
        <p>Your data is stored by the infrastructure providers that host stickynotes and travels over encrypted connections.</p>

        <h2>Contact</h2>
        <p>A contact address will be published here before launch.</p>
      </main>
      <SiteFooter />
    </>
  );
}
