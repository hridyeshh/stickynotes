import { SiteFooter, SiteHeader } from "@/components/layout";

export const metadata = {
  title: "Privacy policy · stickynotes",
  description: "What stickynotes collects, why, who else handles it, and how you control it.",
  alternates: { canonical: "/privacy" },
};

const CONTACT = "contact@paperboxd.in";
const mail = <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;

// Keep this in step with the Chrome Web Store listing's privacy answers (PLAN.md, "Store listing draft").
export default function Privacy() {
  return (
    <>
      <SiteHeader />
      <main className="legal">
        <p className="kicker">Last updated 19 October 2026</p>
        <h1>Privacy policy</h1>
        <p>
          stickynotes is a browser extension and website for keeping notes from what you read. This policy explains what
          we collect, why, who else handles it, and how you control it. &ldquo;We&rdquo; means stickynotes. Questions go
          to {mail}.
        </p>

        <h2>The short version</h2>
        <ul>
          <li>The extension sends a page&rsquo;s details only when you save a note on it, and then only that note.</li>
          <li>We don&rsquo;t record your browsing, show ads, use trackers or sell your data.</li>
          <li>
            Reading suggestions are off unless you turn them on. If you do, a topic&rsquo;s title and newest notes go to
            Google, which may use them and let its people read them (<a href="#suggestions">details</a>).
          </li>
          <li>You can export everything, or delete your account and all of its data, at any time.</li>
        </ul>

        <h2>What the extension does on your device</h2>
        <p>
          The extension runs on the pages you visit so it can show a Save note button when you select text, and highlight
          the passages you saved when you come back. To pick a topic it reads your selection, the heading above it and the
          page&rsquo;s main heading, on your device only. None of that leaves your device unless you save a note.
        </p>
        <p>
          Your notes are kept in the extension&rsquo;s storage on your device, so saving works offline. If you never connect
          an account, they stay on that device. Once you connect one, the extension also checks our server every few minutes
          for notes saved on your other devices; those checks carry nothing about the pages you visit. Settings such as
          auto-save (off unless you turn it on) are kept in your browser&rsquo;s sync storage, which your browser may copy
          between your own devices. Removing the extension deletes the notes it kept on that device.
        </p>

        <h2>Extension permissions</h2>
        <ul>
          <li><strong>Read and change data on the sites you visit:</strong> to show the Save note button and highlight saved passages. It works on your device and sends nothing until you save.</li>
          <li><strong>Active tab and scripting:</strong> to save from the right-click menu or Alt+S in a tab that was open before the extension was installed.</li>
          <li><strong>Storage and unlimited storage:</strong> to keep your notes on your device, however many you save.</li>
          <li><strong>Context menus:</strong> for the &ldquo;Save to notes&rdquo; menu item.</li>
          <li><strong>Alarms:</strong> to sync with your account every few minutes.</li>
          <li><strong>Access to our API:</strong> to sync your notes with your account. The extension contacts no other server.</li>
        </ul>

        <h2>What we collect</h2>
        <ul>
          <li><strong>Your account.</strong> When you sign in with Google we receive your name, email address and profile picture, and nothing else from your Google account. We never see your Google password.</li>
          <li><strong>Notes you save.</strong> The passage, the section heading it sat under, the address, title and site name of the page it came from, its highlight colour, a few words before and after it (so the extension can find it on the page again) and when you saved it. The pages you save from are a partial record of what you read, so we treat them as private.</li>
          <li><strong>Your topics</strong>, their tags, and the changes you make to them such as renaming, moving and merging.</li>
          <li><strong>Reading suggestions</strong>, if you turn them on: the links and tag ideas found for each topic.</li>
          <li><strong>Signed-in browsers.</strong> For each browser you sign in on: its user-agent string (the browser&rsquo;s name and version), whether it&rsquo;s the website or the extension, and when it was last used. Settings lists them so you can sign them out.</li>
          <li><strong>Server logs.</strong> Our API records each request&rsquo;s IP address, time and the address requested, to keep the service running and to limit abuse. They aren&rsquo;t used to build a profile of you.</li>
          <li><strong>Cookies.</strong> The website sets only what it needs: two cookies that keep you signed in (<code>sn_access</code> and <code>sn_refresh</code>, which page scripts can&rsquo;t read), one that tells our pages you&rsquo;re signed in (<code>sn_in</code>) and one that protects a sign-in while it&rsquo;s in progress (<code>sn_oauth</code>). There are no advertising or analytics cookies.</li>
        </ul>

        <h2>How we use it</h2>
        <p>
          Only to run stickynotes: to keep your notes, sync them between your devices, show your library, serve the share
          links you create, keep you signed in and protect the service. We don&rsquo;t use your data for advertising,
          profiling, or deciding creditworthiness or lending. We don&rsquo;t use your notes to train AI models, and we never
          sell your data. If you turn on reading suggestions, Google may use the notes we send it, as{" "}
          <a href="#suggestions">below</a>.
        </p>
        <p>
          stickynotes&rsquo; use and transfer of information received from Google APIs adheres to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>,
          including the Limited Use requirements. The use of information collected by the stickynotes extension complies with
          the Chrome Web Store User Data Policy, including the Limited Use requirements.
        </p>

        <h2>Who else handles it</h2>
        <ul>
          <li><strong>People you share with.</strong> Notes are private. If you share a topic, anyone with its link can read that topic&rsquo;s notes and sources until you turn the link off. A link you turn off stops working for good.</li>
          <li><strong>Our service providers.</strong> Vercel hosts the website, Railway hosts our API and database, and Google handles sign-in. They process data only to run stickynotes for us, and may do so in countries other than yours, including the United States.</li>
          <li><strong>Google and Brave, only if you turn on reading suggestions.</strong> <a href="#suggestions">Reading suggestions</a> says what each receives.</li>
          <li><strong>The law.</strong> We&rsquo;ll disclose data if the law requires it, and only what it requires.</li>
        </ul>
        <p>We share your data with no one else.</p>

        <h2 id="suggestions">Reading suggestions</h2>
        <p>
          Reading suggestions are off unless you turn them on, in Settings or on a topic&rsquo;s page. While they&rsquo;re
          on, opening a topic sends its title and its 30 newest notes, each cut to its first 500 characters, to
          Google&rsquo;s Gemini API. Gemini writes a few web searches and some tag ideas from them. We run the searches on
          the Brave Search API and show you the top results; Brave receives the searches, not your notes. A topic is sent
          the first time you open it with suggestions on, then again only after its notes change, at most once a day.
        </p>
        <p>
          We use Gemini&rsquo;s free tier. Under Google&rsquo;s terms for it, Google may use what we send to improve its
          products, and people at Google may read it. We keep the links and tag ideas found for each topic until you turn
          suggestions off, which deletes them. Turning suggestions off stops anything more being sent; what was already sent
          stays under Google&rsquo;s and Brave&rsquo;s own terms.
        </p>

        <h2>Security</h2>
        <p>
          Everything travels over encrypted connections. Sign-in tokens live in cookies that page scripts can&rsquo;t read,
          refresh tokens are stored only as hashes, and every request is checked against the account it belongs to.
        </p>

        <h2>How long we keep it, and your control</h2>
        <p>We keep your data while your account exists. In stickynotes you can:</p>
        <ul>
          <li>export everything as Markdown or JSON from Settings;</li>
          <li>rename, move, merge, tag or delete notes and topics, and turn share links off;</li>
          <li>turn reading suggestions off, which deletes what they found;</li>
          <li>sign out any of your browsers;</li>
          <li>delete your account. That removes your notes, topics, suggestions, share links and sessions from our database straight away. Server logs, and any backups our hosting provider keeps, expire on their normal schedule.</li>
        </ul>
        <p>
          For anything else, such as a copy of your data or a correction, write to {mail}. We reply within 30 days. Depending
          on where you live, you may also have the right to object to how we use your data, or to complain to your
          data-protection authority.
        </p>

        <h2>Children</h2>
        <p>
          stickynotes isn&rsquo;t meant for children under 13, and we don&rsquo;t knowingly collect their data. If you think
          a child has an account, write to us and we&rsquo;ll delete it.
        </p>

        <h2>Changes</h2>
        <p>
          If this policy changes, we&rsquo;ll update the date at the top. If a change affects how we use data you&rsquo;ve
          already given us, we&rsquo;ll say so on this site before it takes effect.
        </p>

        <h2>Contact</h2>
        <p>{mail}</p>
      </main>
      <SiteFooter />
    </>
  );
}
