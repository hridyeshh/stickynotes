import Link from "next/link";
import { cloneElement } from "react";
import { AppWindow, Download, GitMerge, Link2, Lock, PenLine, Trash2 } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/layout";
import { Label, Notebook, type Tone } from "@/components/notebook";
import "./landing.css";

const FAQ = [
  ["Is stickynotes free?", "Yes. Add the extension, sign in with Google and start saving."],
  ["Which browsers does it work in?", "Chrome, Edge and Brave. It's one extension for all three."],
  ["What does the extension send, and when?", "Nothing until you save a note. Then it sends that note: the passage, the section it sat under and the page's address. It never records your browsing."],
  ["How does it pick the topic?", "It reads the page's main heading and matches it against your topics, on your device. Wrong pick? The Saved toast has a Change button, and the library can move or merge topics later."],
  ["Does it work offline?", "Yes. Notes are kept on your device first and sync to your library when you're back online."],
  ["Can other people see my notes?", "Only if you share a topic with a link. Make it private again and that link stops working for good."],
  ["Can I take my notes with me?", "Any time. Settings exports everything as Markdown or JSON. Deleting your account removes every note at once."],
];

export default function Landing() {
  return (
    <>
      <SiteHeader />
      <main className="landing">
        {/* On wide screens the notebook stays put while you scroll: it straightens, opens and turns its pages.
            Everywhere else the pages simply follow the hero. */}
        <section id="how" className="story">
          <div className="story-stage">
            <div className="story-copy">
              <p className="hand hero-hello">Dear readers,</p>
              <h1 className="hero-title">Read the web.<br /> Keep the parts<br /> that matter.</h1>
              <p className="hero-lede">
                A notebook that <Caret>nearly</Caret> fills itself as you read.
              </p>
              <Link href="/signin" className="btn btn-sticker">Get started free</Link>
              <p className="hero-note">A free browser extension for Chrome, Edge and Brave.</p>
            </div>

            <div className="book">
              <div className="nb nb-kraft book-board" aria-hidden="true" />

              <div className="leaf leaf-0">
                <div className="face nb nb-kraft cover" aria-hidden="true">
                  <Label topic="Consistent hashing" notes={12} sources={3} />
                  <span className="nb-emboss">s</span>
                  <div className="sticky cover-sticky">
                    <p>Each key goes to the first server clockwise.</p>
                    <span>[1]</span>
                  </div>
                  <Star className="cover-star" />
                  <span className="pencil nb-pencil stack-only" />
                  <span className="nb-loop stack-only" />
                </div>
                <Page back tone="kraft" className="face pg-name">
                  <div className="nameplate">
                    <div className="nameplate-in">
                      <span>This library belongs to</span>
                      <b>you</b>
                      <small>If found, please return to the internet.</small>
                    </div>
                  </div>
                  <span className="sticker-s pg-name-s" aria-hidden="true">s</span>
                  <Star className="pg-name-star" />
                </Page>
              </div>

              <SoftLeaf k={1}>
                <Page className="pg-welcome">
                  <Star className="pg-welcome-star" />
                  <span className="sticker-s pg-welcome-s" aria-hidden="true">s</span>
                  <Heart className="pg-welcome-heart" />
                  <p className="welcome-hello">Hello, reader!</p>
                  <h2 className="welcome-title">Welcome to your library</h2>
                  <p className="hand welcome-turn" aria-hidden="true">keep scrolling to turn the page <Arrow way="down" /></p>
                </Page>
                <Page back className="pg-select">
                  <p className="hand pg-kicker">step one,</p>
                  <h2>Select a sentence.</h2>
                  <div className="mini-page" aria-hidden="true">
                    <span className="mini-url">openreference.org / consistent-hashing</span>
                    <span className="mini-h1">Consistent hashing</span>
                    <span className="mini-p">
                      Servers and keys share one ring. <mark>Each key goes to the first server clockwise.</mark>
                    </span>
                    <span className="mini-save">+ Save note</span>
                  </div>
                  <p className="keys"><kbd>Alt</kbd> + <kbd>S</kbd> <span className="hand">works too</span></p>
                  <p>A Save note button appears beside your selection. Or turn on auto-save, and every selection is kept without a click.</p>
                </Page>
              </SoftLeaf>

              <SoftLeaf k={2}>
                <Page className="pg-files">
                  <p className="hand pg-kicker">step two,</p>
                  <h2>It files itself.</h2>
                  <div className="files-demo" aria-hidden="true">
                    <span className="files-heading"><small>the page you&rsquo;re on</small>Consistent hashing, explained</span>
                    <Arrow way="down" />
                    <span className="toast">Saved to <b>Consistent hashing</b> · <u>Change</u></span>
                  </div>
                  <p>
                    stickynotes reads the page&rsquo;s heading and files the passage under the matching topic, in the section you
                    were reading. Wrong topic? Change it in one click.
                  </p>
                </Page>
                <Page back className="pg-ten">
                  <p className="hand pg-kicker">read all you like,</p>
                  <h2>Ten articles. One note.</h2>
                  <div className="fan" aria-hidden="true">
                    {["openreference.org", "distsys.notes", "youtube.com", "systemsweekly.blog", "lecture-07.pdf"].map((site) => (
                      <span key={site}><small>{site}</small><i /><i /><i className="hl" /><i /></span>
                    ))}
                  </div>
                  <p>Pages about the same subject share one note, so a topic you keep coming back to grows in one place.</p>
                </Page>
              </SoftLeaf>

              <SoftLeaf k={3}>
                <Page tone="ruled" className="pg-sheet">
                  <p className="sheet-title">Consistent hashing</p>
                  <p className="sheet-h">Ring structure</p>
                  <p className="sheet-li bullet">Servers and keys are hashed onto the same ring. <span className="sheet-ref">[1]</span></p>
                  <p className="sheet-li bullet">
                    <svg className="sheet-doodle" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 8 61 38l31 1-24 19 8 31-26-18-27 17 9-30L8 39l31-2Z" /></svg>
                    <mark>Each key goes to the first server clockwise.</mark> <span className="sheet-ref">[2]</span>
                  </p>
                  <p className="sheet-h">Virtual nodes</p>
                  <p className="sheet-li bullet">Each server sits on the ring many times, which evens out the load. <span className="sheet-ref">[3]</span></p>
                  <p className="sheet-h">Sources</p>
                  <ol className="sheet-src">
                    <li>openreference.org</li>
                    <li>distsys.notes</li>
                    <li>youtube.com</li>
                  </ol>
                  <p className="hand sheet-more" aria-hidden="true">…and seven more, every one listed</p>
                </Page>
                <Page back className="pg-wants">
                  <h2>Everyyyything you&rsquo;d want.</h2>
                  <ul className="wants">
                    <li className="sticky">auto-save, if you like <i aria-hidden="true">✦</i></li>
                    <li className="sticky">search all of it</li>
                    <li className="sticky">works offline <i aria-hidden="true">☁</i></li>
                    <li className="sticky">syncs to every device</li>
                  </ul>
                </Page>
              </SoftLeaf>

              <SoftLeaf k={4}>
                <Page className="pg-return">
                  <p className="hand pg-kicker">step three,</p>
                  <h2>It comes back when you do.</h2>
                  <div className="mini-page" aria-hidden="true">
                    <span className="restored">Restored 2 highlights</span>
                    <span className="mini-h1">Consistent hashing</span>
                    <span className="mini-p">
                      <mark>Servers and keys share one ring.</mark> Adding a server only moves its neighbour&rsquo;s keys.{" "}
                      <mark>Each key goes to the first server clockwise.</mark>
                    </span>
                  </div>
                  <p>Go back to a page and your highlights are still on it. Every note is searchable in your library, on any device.</p>
                </Page>
                <Page back className="pg-letter">
                  <span className="sticker-lock" aria-hidden="true"><Lock strokeWidth={2.2} /></span>
                  <h2>Private by default</h2>
                  <p>
                    Your highlights reveal what you read, so they belong to you. Notes stay private unless you share a topic
                    with a link, and you can turn that link off at any time. Export everything whenever you like, or delete your
                    account and all of its data in one step.
                  </p>
                  <p className="hand letter-sign">Yours, privately,<br />stickynotes</p>
                </Page>
              </SoftLeaf>

              <SoftLeaf k={5}>
                <Page tone="ruled" className="pg-nolist">
                  <p className="hand pg-kicker">and the</p>
                  <h2>No-list</h2>
                  <ul className="nolist">
                    <li>no ads</li>
                    <li>no trackers</li>
                    <li>no selling your data</li>
                    <li>no browsing history</li>
                    <li>nothing sent until you save</li>
                    <li>no lock-in, export any time</li>
                  </ul>
                </Page>
                <Page back className="pg-cool">
                  <p className="hand cool-kicker" aria-hidden="true">soooo much</p>
                  <h2>And there&rsquo;s other cool stuff!</h2>
                  <ul className="cool">
                    <li><Link2 aria-hidden="true" />share a topic by link</li>
                    <li><Download aria-hidden="true" />export to Markdown</li>
                    <li><GitMerge aria-hidden="true" />move &amp; merge topics</li>
                    <li><PenLine aria-hidden="true" />rename anything</li>
                    <li><AppWindow aria-hidden="true" />Chrome, Edge &amp; Brave</li>
                    <li><Trash2 aria-hidden="true" />delete it all in one step</li>
                  </ul>
                </Page>
              </SoftLeaf>

              <Page className="face pg-end book-base">
                <Star className="pg-end-star" />
                <span className="sticker-s pg-end-s" aria-hidden="true">s</span>
                <h2>Start your library with the next thing you read.</h2>
                <Link href="/signin" className="btn btn-sticker">Get started free</Link>
                <p className="end-note">A free extension for Chrome, Edge and Brave.</p>
                <p className="hand end-aside" aria-hidden="true"><Arrow way="up" />no card, no catch</p>
              </Page>

              <span className="pencil book-pencil" aria-hidden="true" />
              <span className="nb-loop book-loop" aria-hidden="true" />
            </div>
          </div>
        </section>

        <section className="sky" aria-labelledby="sky-title">
          <img
            className="sky-art" src="/art/sky.jpg" width={1536} height={864} loading="lazy" decoding="async"
            alt="Two hands hold a tablet up to a summer sky. On its screen, a shelf of notebooks, each with a sticky note on its cover."
          />
          <div className="sky-card">
            <h2 id="sky-title">Your library, <mark>wherever you are</mark></h2>
            <ol className="sky-list">
              <li>Open it on any device <span aria-hidden="true">I</span></li>
              <li>Saves offline, syncs later <span aria-hidden="true">II</span></li>
              <li>Search every notebook at once <span aria-hidden="true">III</span></li>
              <li>Every note keeps its source <span aria-hidden="true">IV</span></li>
              <li>Export all of it, any time <span aria-hidden="true">V</span></li>
            </ol>
          </div>
        </section>

        {/* Scrolling down slides the shelf sideways on wide screens; elsewhere it's a row you swipe. */}
        <section className="shelf" aria-labelledby="shelf-title">
          <div className="shelf-stage">
            <div className="shelf-row">
              <div className="shelf-intro">
                <p className="hand">your library,</p>
                <h2 id="shelf-title">Every topic gets its own notebook.</h2>
                <p>It fills up as you read: one notebook per subject, each with every page it came from.</p>
              </div>
              <ShelfItem tone="kraft" topic="Consistent hashing" notes={12} sources={3} note="rename it any time" pencil />
              <ShelfItem tone="sky" topic="Black holes" notes={23} sources={10} note="merge two into one" />
              <ShelfItem tone="pink" topic="Sourdough" notes={9} sources={6} note="your sourdough phase, sorted" />
              <ShelfItem tone="sage" topic="Stoicism" notes={31} sources={8} note="share one by link" pencil />
              <ShelfItem tone="navy" topic="Jazz harmony" notes={14} sources={5} note="export it to Markdown" />
              <ShelfItem tone="tangerine" topic="Tide pools" notes={6} sources={4} note="search across all of them" />
              <div className="shelf-end">
                <p className="hand">yours could be next,</p>
                <Link href="/signin" className="btn btn-sticker">Start your library</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="hands" aria-labelledby="hands-title">
          <div className="hands-copy">
            <h2 id="hands-title">Your notes are in good hands.</h2>
            <p>Nothing is sent until you save, nothing is ever sold, and no one sees a note you haven&rsquo;t shared.</p>
          </div>
          <div className="hands-art">
            <img
              src="/art/hands.jpg" width={1536} height={864} loading="lazy" decoding="async"
              alt="One person hands a kraft notebook, a star sticker on its cover, to another."
            />
            <span className="hands-name" aria-hidden="true">you</span>
          </div>
          <p className="hand hands-aside" aria-hidden="true">made for readers,<br />with care <Heart className="hands-heart" /></p>
        </section>

        <section id="faq" className="faq wrap">
          <p className="hand faq-kicker">psst,</p>
          <h2>Questions you might have</h2>
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

type PageProps = { back?: boolean; tone?: "ruled" | "kraft"; className: string; at?: number; children: React.ReactNode };

/** One page of the notebook. A back page is the left side of a spread once its leaf has turned.
 *  `at` is which strip of a bending leaf this copy fills (see SoftLeaf). */
function Page({ back, tone, className, at, children }: PageProps) {
  const classes = ["nbpage", back && "face-back", tone && `page-${tone}`, at !== undefined && `at-${at}`, className].filter(Boolean).join(" ");
  return (
    <div className={classes}>
      <div className="page-in">{children}</div>
    </div>
  );
}

const STRIPS = 4;

/**
 * A paper leaf that bends as it turns. It's cut into hinged strips, each nested in the one before, and each strip
 * shows its slice of both pages; the copies after the first are hidden from screen readers. CSS bends every hinge
 * a little, so the free edge lifts first and lands last.
 */
function SoftLeaf({ k, children }: { k: number; children: React.ReactElement<PageProps>[] }) {
  const [front, back] = children;
  const strip = (i: number): React.ReactNode => (
    <div className={`strip strip-${i}`}>
      <div className="slice" aria-hidden={i > 0 || undefined}>{cloneElement(front, { at: i })}</div>
      <div className="slice slice-back" aria-hidden={i > 0 || undefined}>{cloneElement(back, { at: STRIPS - 1 - i })}</div>
      {i + 1 < STRIPS && strip(i + 1)}
    </div>
  );
  return <div className={`leaf leaf-soft leaf-${k}`}>{strip(0)}</div>;
}

/** A proofreader's insertion: the word is written above the line, with a caret where it goes. */
function Caret({ children }: { children: string }) {
  return (
    <span className="caret">
      <span className="hand caret-word">{children}</span>
      <svg className="caret-mark" viewBox="0 0 20 12" aria-hidden="true"><path d="M2 11 10 2l8 9" /></svg>
    </span>
  );
}

function ShelfItem({ tone, note, pencil, ...label }: {
  tone: Tone;
  topic: string;
  notes: number;
  sources: number;
  note: string;
  pencil?: boolean;
}) {
  return (
    <figure className="shelf-item" aria-hidden="true">
      <Notebook tone={tone} {...label}>
        {pencil && (
          <>
            <span className="pencil nb-pencil" />
            <span className="nb-loop" />
          </>
        )}
      </Notebook>
      <figcaption className="hand shelf-note"><Arrow way="down" />{note}</figcaption>
    </figure>
  );
}

const STAR = "M50 6 62 36 94 38 69 58 78 90 50 72 22 90 31 58 6 38 38 36Z";

/** A die-cut sticker: a star with eyes. Decorative. */
function Star({ className }: { className: string }) {
  return (
    <svg className={`sticker ${className}`} viewBox="-10 -10 120 120" aria-hidden="true">
      <path className="sticker-cut" d={STAR} />
      <path className="sticker-star" d={STAR} />
      <circle className="sticker-eye" cx="41" cy="55" r="8" />
      <circle className="sticker-eye" cx="61" cy="55" r="8" />
      <circle className="sticker-pupil" cx="44" cy="56.5" r="3.6" />
      <circle className="sticker-pupil" cx="64" cy="56.5" r="3.6" />
    </svg>
  );
}

function Heart({ className }: { className: string }) {
  return (
    <svg className={`heart ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21c-1-.8-8.4-5.6-9.7-10.2C1.3 7.3 3.4 4 6.7 4c2.1 0 3.6 1.2 5.3 3.2C13.7 5.2 15.2 4 17.3 4c3.3 0 5.4 3.3 4.4 6.8C20.4 15.4 13 20.2 12 21Z" />
    </svg>
  );
}

// Hand-drawn arrows: a stroke and its head, per direction.
const ARROWS = {
  down: { box: "0 0 64 64", paths: ["M50 4c5 22-5 42-34 54", "M10 45l5 14 14-5"] },
  up: { box: "0 0 64 64", paths: ["M58 56C40 52 24 38 18 10", "M8 20 18 8l11 11"] },
};

function Arrow({ way }: { way: keyof typeof ARROWS }) {
  const { box, paths } = ARROWS[way];
  return (
    <svg className="doodle" viewBox={box} aria-hidden="true">
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
