import Link from "next/link";
import { Check } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/layout";

const STEPS = [
  ["Select", "Highlight any sentence. A small Save note button appears beside it, or you can press Alt+S. Turn on auto-save and every selection is kept without a click."],
  ["File", "The note goes under its topic, in the section you were reading. Pages about the same subject share one note, and every page you read is listed as a source."],
  ["Return", "Go back to a page and your highlights are still there. Every note is searchable in your library, on any device."],
];

export default function Landing() {
  return (
    <>
      <SiteHeader />
      <main className="landing">
        <section className="hero">
          <div>
            <div className="kicker">A browser extension with a library behind it</div>
            <h1 className="hero-title">Read the web. Keep the parts that matter.</h1>
            <p className="hero-lede">
              Select a passage on any page and stickynotes files it under the topic you&rsquo;re reading about,
              grouped by section. Ten articles on the same subject become one note, with every source listed at the
              end. Your notes sync to a library you can open anywhere, and stay private unless you share them.
            </p>
            <Link href="/signin" className="btn btn-primary btn-lg">Get started free</Link>
            <p className="hero-note">Works in Chrome, Edge and Brave.</p>
          </div>
          <HeroArt />
        </section>

        <section id="how" className="band">
          <h2>How it works</h2>
          <ol className="steps">
            {STEPS.map(([title, text], i) => (
              <li key={title}>
                <span className="step-num">{String(i + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p className="justify">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="privacy" className="band privacy">
          <h2>Private by default</h2>
          <p className="justify">
            Your highlights reveal what you read, so they belong to you. The extension sends nothing until you save a
            note. Notes are private unless you share a topic with a link, and you can turn that link off at any time.
            You can export everything to Markdown whenever you like, and delete your account and all of its data in one
            step.
          </p>
        </section>

        <section className="band cta">
          <h2>Start a library from the next thing you read.</h2>
          <Link href="/signin" className="btn btn-primary btn-lg">Get started free</Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="demo-page">
        <div className="demo-url">openreference.org / consistent-hashing</div>
        <div className="demo-h1">Consistent hashing</div>
        <div className="demo-h2">Ring structure</div>
        <p className="demo-p">
          Both servers and keys are hashed onto the same circular space.{" "}
          <mark>Each key is assigned to the first server found by walking clockwise from the key&rsquo;s position.</mark>
        </p>
        <div className="demo-save">+ Save note</div>
      </div>
      <div className="demo-library">
        <div className="kicker">Your library</div>
        <div className="demo-topic">Consistent hashing</div>
        <div className="demo-section">Ring structure</div>
        <div className="bullet">Each key is assigned to the first server found by walking clockwise from the key&rsquo;s position.</div>
        <div className="demo-synced"><Check size={13} aria-hidden="true" /> Synced just now · 3 sources</div>
      </div>
    </div>
  );
}
