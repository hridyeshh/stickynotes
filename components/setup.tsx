// The setup notebook, shared by onboarding and the page the extension opens to connect. Imported by client
// components only (it takes a click handler).

const STEPS = ["Add it to your browser", "Connect your account", "Save your first note"];
export const KICKERS = ["step one,", "step two,", "step three,"];

// The Chrome Web Store listing. Edge and Brave install from it too.
export const STORE_URL = "https://chromewebstore.google.com/detail/stickynotes/fciennljceeoagambkjppepghigkcnep";

/** Opens the store listing in a new tab, so this page is still here to continue from. */
export function AddToChrome() {
  return <a href={STORE_URL} target="_blank" rel="noopener noreferrer" className="btn btn-sticker">Add to Chrome</a>;
}

/** A pencil tick. */
export function Tick() {
  return (
    <svg className="doodle setup-tick" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M5 17c3 2 5 5 7 8 3-8 8-15 15-20" />
    </svg>
  );
}

/** The steps as sticky notes on the inside cover, ticked off as you go; the page beside them says what to do now. */
export function SetupBook({ hello, step, done, onStep, children }: {
  hello: string;
  step: number;
  done: boolean[];
  onStep?: (i: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="setup">
      <div className="setup-cover">
        <p className="hand setup-hello">{hello}</p>
        <p className="setup-todo">Three things, then you&rsquo;re reading.</p>
        <ol className="setup-steps">
          {STEPS.map((label, i) => {
            const body = (
              <>
                <span className="setup-n">{done[i] ? <Tick /> : i + 1}</span>
                <span className="setup-label">{label}</span>
              </>
            );
            return (
              <li key={label} className={`setup-step setup-step-${i + 1}`} data-state={done[i] ? "done" : i === step ? "now" : "next"} aria-current={i === step ? "step" : undefined}>
                {onStep ? <button type="button" onClick={() => onStep(i)}>{body}</button> : <span>{body}</span>}
              </li>
            );
          })}
        </ol>
      </div>
      <section className="setup-page">{children}</section>
    </div>
  );
}
