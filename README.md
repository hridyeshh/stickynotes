# stickynotes

> *Read the web. Keep the parts that matter.*

stickynotes is a browser extension and a web library for keeping what you read. Select a passage on any page and it is saved as a note under the page's section heading, filed into a **topic**: one note per subject, not per URL. Ten articles on consistent hashing become one "Consistent hashing" note, with every source listed at the end.

**Website:** [stickynotes.in](https://www.stickynotes.in) · **Extension:** [Chrome Web Store](https://chromewebstore.google.com/detail/stickynotes/fciennljceeoagambkjppepghigkcnep) · **API:** [stickynotes-backend-production.up.railway.app](https://stickynotes-backend-production.up.railway.app/health) · **Contact:** contact@paperboxd.in

---

## Table of Contents

- [What is stickynotes?](#what-is-stickynotes)
- [Repository Map](#repository-map)
- [System Architecture](#system-architecture)
- [How a Note Travels](#how-a-note-travels)
- [Browser Extension](#browser-extension)
- [Web App (Next.js)](#web-app-nextjs)
- [Backend (Go + PostgreSQL)](#backend-go--postgresql)
- [Design System](#design-system)
- [SEO](#seo)
- [Privacy & Security](#privacy--security)
- [Build History](#build-history)
- [Deployment](#deployment)
- [Development Setup](#development-setup)
- [Testing](#testing)
- [Known Limits](#known-limits)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)

---

## What is stickynotes?

stickynotes keeps the sentences worth keeping from what you read, grouped the way you think about them: by subject.

- **Save without leaving the page.** Select text and click *Save note*, press Alt+S, or right-click → *Save to notes*. Four highlighter colours: yellow, pink, blue, green.
- **Filed by subject.** The page's heading picks the topic, on your device. Every note in a topic is marked `[n]` for its source, and the Sources list closes the note.
- **Comes back.** Return to a page and the passages you saved are tinted again.
- **Works offline.** Notes are kept in the browser first and sync to your library when you're online.
- **Private by default.** Share one topic by link. Make it private again and that link stops working for good.
- **Yours to take.** Export everything as Markdown or JSON at any time. Deleting the account deletes every note at once.

### The one rule

> The extension sends nothing until you save a note.

No page lookups, no browsing history. Topic matching runs on the device. When you save, that note goes to your account: the passage, the section heading it sat under, up to 32 characters either side (to find it on the page again), its colour, and the page's address, title and site name.

### What it deliberately doesn't do

| It doesn't | Instead |
|---|---|
| Look up the pages you visit | Nothing leaves the browser until you save |
| File notes by URL | One note per topic, with a numbered Sources list |
| Rewrite the page to show highlights | Tints drawn with the CSS Custom Highlight API; the page's DOM is never touched |
| Ask for a password | Google sign-in only |
| Send your notes to an AI by default | Reading suggestions are off until you turn them on |
| Let a page's script save for you | Script-made (untrusted) mouse events are ignored |

---

## Repository Map

| Repository | Description | Stack |
|---|---|---|
| `stickynotes` (this repo) | The website and web library at the root, the browser extension in `extension/` | Next.js 15.5, React 19.1, TypeScript 5.9 · Manifest V3, plain JavaScript |
| `stickynotes-backend` | REST API: the only backend | Go 1.26, chi v5, pgx v5 + sqlc, PostgreSQL |

This README covers the product, the web app and the extension. The backend's README has the deep dive: sessions, the sync protocol, the data model and reading suggestions. [`PLAN.md`](PLAN.md) holds the decisions, phase status and next steps.

```
app/            Next.js App Router: pages, route handlers, server actions, CSS, icons, SEO files
components/     Headers and footer, notebook, setup notebook, dialog, avatar picker, signed-in flag
lib/            api.ts, session.ts, data.ts, notes.ts, bridge.ts, site.ts (+ tests)
extension/      The Manifest V3 extension: no build step, loads as is
public/         art/ (four gouache paintings) and avatars/ (twelve painted avatars)
brand/          The icon source and the Chrome Web Store art
scripts/        pack-extension.sh: builds the Web Store zip into dist/ (gitignored)
middleware.ts   Keeps the session fresh on signed-in routes
next.config.ts  Security headers
PLAN.md         Decisions, phase status, deploy notes, known limits
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                       Clients                                       │
│  ┌──────────────────────────────────┐          ┌─────────────────────────────────┐  │
│  │  Browser extension (MV3)         │  bridge  │  Web app (Next.js · Vercel)     │  │
│  │  content.js on every page        │◄────────►│  server components + actions    │  │
│  │  background.js: store + sync     │ connect  │  middleware.ts: token refresh   │  │
│  │  chrome.storage.local            │   only   │  HttpOnly session cookies       │  │
│  └─────────────────┬────────────────┘          └────────────────┬────────────────┘  │
└────────────────────┼────────────────────────────────────────────┼───────────────────┘
                     │ HTTPS · JSON · Bearer JWT                  │ from the Next.js server only:
                     │ host_permissions, no CORS                  │ browser JS never holds a token
                     ▼                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            Go API  (Railway · one binary)                           │
│                                                                                     │
│   chi · httprate · 15-min JWT + rotating refresh tokens · sqlc                      │
│   auth: Google sign-in, devices, extension PKCE codes                               │
│   notes: sync push/pull, library, sharing, tags, suggestions                        │
└──────────────────────────────────────────┬──────────────────────────────────────────┘
                                           │  pgx
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│   PostgreSQL (Railway, private network)  ·  Google tokeninfo (sign-in)              │
│   Gemini + Brave Search (reading suggestions, only for users who turn them on)      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

- **No CORS anywhere.** The website's browser code never calls the API. Pages and server actions run on the Next.js server, which forwards the session from HttpOnly cookies. The extension calls the API from its service worker, which `host_permissions` allows.
- **Two sessions, one account.** The website and each extension have their own refresh token, so each appears as a device in Settings and can be signed out alone.
- **The bridge** is `window.postMessage` between the website's page and the extension's content script, used only to connect the extension. No token crosses it.

---

## How a Note Travels

1. **Select** text on any page. `content.js` shows a bar beside it: *Save note*, the four colours, and *to Consistent hashing ▾*, the topic the save will go to.
2. **Save.** The content script sends the passage to `background.js`, the only code that writes the store. It works out the page's address, the topic, the section heading (the nearest h2–h4 above) and an anchor to find the passage again.
3. **Kept locally.** The note goes into the store in `chrome.storage.local` and its actions into the outbox: `create_topic` if the topic is new, then `create_highlight`. A toast says *Saved to Consistent hashing*, with Undo, Change and View.
4. **Push.** The worker sends the outbox to `POST /api/v1/sync/push`. The server applies each action, merges a topic with one you already have under the same title, and returns the id that won.
5. **Pull.** It then asks `GET /api/v1/sync/pull?cursor=…` for whatever changed elsewhere: another browser, or an edit on the website. Open tabs update their tints and badge.
6. **The library.** The website reads `GET /api/v1/library` and sends its edits (rename, move, merge, delete) through the same push, so the extension picks them up on its next pull: on a save, on opening the popup, or within five minutes.

---

## Browser Extension

`extension/`: Manifest V3, plain JavaScript, no build step and no dependencies. Load the folder unpacked to develop; `scripts/pack-extension.sh` builds the Web Store zip.

### Files

| File | Role |
|---|---|
| `manifest.json` | Service worker, a content script on every page, the popup, and the Alt+S command |
| `config.js` | `API_URL` and `WEB_ORIGIN`. The repo keeps localhost; the pack script writes the live origins. |
| `background.js` | The service worker: **the only writer of the store and the only code that calls the API.** Saves, sync, connecting, the badge, the context menu and Alt+S. |
| `sync.js` | The store and its outbox as plain functions (`SN`), with no `chrome.*` calls, so node tests them |
| `page.js` | The address, topic and anchor rules as plain functions (`PG`), tested the same way |
| `content.js` | Runs on every page: the Save bar, the toast, the topic picker, restored tints, and the bridge to the website |
| `content.css` | The four highlighter tints (`::highlight(sn-yellow)` and so on) |
| `popup.html` / `popup.js` | The toolbar popup |
| `notes.html` / `notes.js` | The extension's own notes page |
| `shared.js` | Helpers for the popup and the notes page (`HN`) |
| `styles.css` | Styles for the popup and the notes page |
| `*.test.js` | `node --test` suites, left out of the store zip |

### Saving

- **The bar.** Select at least 3 characters outside a text field and the bar appears: *Save note*, the four colours, and the topic. Clicking a colour saves in that colour; *Save note* and Alt+S use your last one. The same text saved twice on one page is kept once.
- **Picking a topic before saving.** *to X ▾* opens a picker of your topics, most recent first; typing filters them or names a new one. The whole page moves to the topic you pick, earlier notes included, and it becomes the topic you're reading in.
- **Alt+S and the context menu.** Chrome runs content scripts only in pages loaded after the extension, so in a tab opened before it was installed, reloaded or updated, nothing is listening. The menu click or the shortcut grants `activeTab`, and the worker injects the content script first (`askTabToSave`). It still can't run on `chrome://` pages or the Web Store.
- **Auto-save.** A switch in the popup (kept in `chrome.storage.sync`) saves every selection without the bar. Only real mouse events count: a page that selects text and fires a mouseup itself can't save a note for you.
- **The toast.** *Saved to X* with **Undo**, **Change** (move this page to another topic) and **View** (the topic in the web library once it has synced, else the extension's notes page; it waits for the save's own sync first). Not connected, the toast says *Kept on this device* and offers **Connect** instead of View.

The bar and the toast live in a **closed shadow root**: page CSS can't restyle them and page scripts can't read your topic names out of them. They use Georgia, since the extension bundles no fonts.

### Addresses, topics and anchors (`page.js`)

**The address a page's notes go under** is one source per article:

- The page's `<link rel="canonical">`, when it is on the same site (`www.` ignored), doesn't point every page at the homepage, and wasn't left behind by in-app navigation. Otherwise the page's own address.
- Without its `#hash` or tracking parameters (`utm_*`, `fbclid`, `gclid`, `dclid`, `msclkid`, `mc_cid`, `mc_eid`, `igshid`, `_hsenc`, `_hsmi`). The rest of the query stays, in order, so Hacker News `item?id=` and YouTube `watch?v=` pages stay apart.
- Past 2048 characters, the query is dropped.
- A page also reports its raw address, so notes saved under an older address still come back on it.

**The topic** for a page new to your notes, in order:

1. The page already has notes: their topic.
2. You saved or picked a topic in the last 3 hours: that one. Reading three articles in a row about one subject files them together, whatever their headings say.
3. Matching: the page's `<h1>`, else its title without the site's name ("Consistent hashing - Wikipedia" → "Consistent hashing"), minus filler ("A guide to …", "… explained", "for beginners", "101"). An existing topic whose words all appear in the page's words wins, the most specific first. Stop words are ignored and plurals folded. Topics with no notes left are skipped.
4. Otherwise the cleaned title starts a new topic.

All of it runs in the browser. *Change* on the toast, and Move and Merge in the library, fix a page filed in the wrong topic.

**The anchor** is the passage plus up to 32 characters either side, compared with whitespace removed (pages and selections lay out spaces differently). When a sentence appears twice on a page, the copy whose surroundings match best is the one that gets tinted.

### Restoring highlights

- Saved passages are tinted with the **CSS Custom Highlight API**: one `Highlight` per colour, the tints in `content.css`. The page's DOM is left alone.
- Tints are restored on load, again 2.5 s later for content that renders late, after in-app navigation (the Navigation API's `currententrychange`, or polling where it's missing), and on back/forward-cache restores. A banner says *Restored 3 highlights from your last visit*.
- Every open tab showing a page follows deletes, undos and pulls, and the toolbar badge counts the page's notes.

### The local store and sync

```js
store = {
  owner:      '',   // the account it belongs to ('' before the first connect)
  topics:     { [id]: { id, title } },
  sources:    { [url]: { url, topic_id, title, site } },
  highlights: { [id]: { id, url, text, section, anchor, color, created_at } },
  outbox:     [],   // actions for POST /sync/push, each with a local seq
  seq: 0, cursor: ''
}
```

- **One writer.** Writes queue up in `background.js`, so two tabs saving at once can't overwrite each other. The v1 extension lost notes that way. The worker keeps the store in memory and writes it back on every change.
- **Push, then pull.** Pushes go in batches of at most 100 actions and 512 KB (the API takes 1 MB per request). A batch is acknowledged by `seq`, so a save made while it was in flight stays queued. The server's topic-id map is applied to the store and to queued actions.
- **A pull lands only with an empty outbox**, so an older server copy can't undo a change still waiting to go. A save made during a pull triggers another round.
- **Triggers:** every save, opening the popup, every 5 minutes (`chrome.alarms`), and browser start.
- **One token refresh at a time.** Refresh tokens rotate, so two concurrent refreshes would race and disconnect the loser. A revoked or expired session clears the extension's auth and the popup asks to connect again.
- **Not connected:** notes stay on the device and wait in the outbox; they sync once you connect.
- **Connecting another account** than the last one drops the old account's synced copy but keeps the notes that never reached it, filed afresh for the new account (`SN.keepUnsynced`).
- **Disconnect** syncs first and refuses while anything is unsynced, then revokes the session and clears the local copy. The notes live on in the account.

### Connecting to an account

The website owns sign-in. The popup's **Connect** opens `/extension/connect`, which links this browser to the signed-in account:

```
  web page                 content.js               background.js                Go API
      ├─────── sn:hello ───────►│                         │                         │
      │                         │                         │                         │
      │                         ├───── connect:start ────►│                         │
      │                         │                         │                         │
      │                         │◄────── challenge ───────┤                         │
      │                         │                         │                         │
      │◄──── sn:challenge ──────┤                         │                         │
      │                         │                         │                         │
      ├─ POST /extension/codes ─┼─────────────────────────┼────────────────────────►│
      │                         │                         │                         │
      │◄────────────────────────┼─────────────────────────┼─────── { code } ────────┤
      │                         │                         │                         │
      ├──────── sn:code ───────►│                         │                         │
      │                         │                         │                         │
      │                         ├──── connect:finish ────►│                         │
      │                         │                         │                         │
      │                         │                         ├─ POST /extension/token ►│
      │                         │                         │                         │
      │                         │                         │◄── access + refresh ────┤
      │                         │                         │                         │
      │                         │◄────── { email } ───────┤                         │
      │                         │                         │                         │
      │◄──── sn:connected ──────┤                         │                         │
```

- The worker makes a PKCE verifier and keeps it in `chrome.storage.session`, which outlives the worker sleeping mid-handshake and is closed to content scripts. Only the S256 challenge leaves it.
- The page's server action (`createExtensionCode`) asks the API for a code with the user's own session. The code is single use, lasts 60 seconds, and is useless without the verifier.
- The worker redeems the code with the verifier and stores its own access and refresh tokens. **No token ever crosses the page.**
- The bridge listens only on the website's exact origin (`WEB_ORIGIN`), in the top frame, and only to messages the page itself posted. The website's "is the extension here?" check is `sn:ping` → `sn:ready`.

### Permissions

| Permission | Why |
|---|---|
| Content script on `<all_urls>` | Shows the Save bar for a selection and re-tints saved passages on return. Sends nothing until a note is saved. |
| `storage`, `unlimitedStorage` | Notes are kept on the device and work offline |
| `contextMenus` | The *Save to notes* item |
| `alarms` | Sync every 5 minutes |
| `activeTab`, `scripting` | Save from the menu or Alt+S in a tab opened before the extension was installed |
| Host permission: the API origin only | Sync with the account. No remote code. |

### Who may ask the worker what

`background.js` checks the sender of every message:

| Sender | May |
|---|---|
| Any page's content script | Report its page, plan and save a note, sync, open View or Connect; undo, list topics for or refile only a note **saved in that tab in the last 10 minutes** |
| The website's top frame (exactly `WEB_ORIGIN`) | `connect:start` and `connect:finish` |
| The extension's own pages (popup, notes page) | Delete notes, restore a backup, disconnect |

### The popup and the notes page

- **Popup:** the page's topic with its note and section counts, the sync state (*All notes synced*, *2 changes waiting to sync*, *Offline…*), the auto-save switch, *This page's notes* and *Library* (the web library when connected with nothing waiting to sync, else the notes page), and Connect or *Disconnect this browser*.
- **Notes page** (`notes.html`): every topic with its sources and notes, search, delete a note or a whole page, *Copy MD* per topic, *Export all (.md)*, and **Backup / Restore**. The backup format is v1's with each page's topic added, so v1 backups restore too, and so does the website's JSON export.

### Packaging for the store

```bash
scripts/pack-extension.sh <api origin> <web origin> <version>
# e.g. the 1.0.0 listing:
scripts/pack-extension.sh https://stickynotes-backend-production.up.railway.app https://www.stickynotes.in 1.0.0
```

It copies `extension/` without the tests, writes both origins into `config.js`, sets the manifest's version and narrows `host_permissions` to the API origin, then zips it to `dist/stickynotes-<version>.zip`. Origins must be `https://host` with no path. The checked-in files keep pointing at localhost (manifest `0.4.0`). The web origin must be exactly the one the site serves: `https://www.stickynotes.in`, since the apex redirects to `www`. Edge and Brave install from the Chrome Web Store listing.

---

## Web App (Next.js)

### Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 15.5 (App Router; Turbopack in dev), React 19.1 |
| Language | TypeScript 5.9, pinned to `^5`: TypeScript 7 lacks the JS API Next 15 calls |
| Styling | Plain CSS: `app/classical.css` (design-system tokens and components), `app/site.css` (the app), `app/landing.css` (the landing page) |
| Icons | lucide-react |
| Fonts | `next/font/google`, self-hosted at build time: Cormorant Garamond, Lora, Caveat, Playwrite DK Loopet |
| Auth | Its own Google OAuth (authorization code + PKCE), handing Google's ID token to the Go API. No NextAuth. |
| Data | Server components and server actions calling the Go API (`lib/api.ts`). No client data library, no token in browser JS. |
| Lint | oxlint, plus a grep that fails on raw hex colours or `px` values in `.tsx` |
| Tests | `node --test`, straight on the TypeScript and extension sources |

Four runtime dependencies: `next`, `react`, `react-dom`, `lucide-react`.

### Routes

```
app/
├── page.tsx                     # Landing: the scroll-driven notebook story, sky, shelf, good hands, FAQ
├── signin/                      # "Continue with Google"; the same step creates an account
├── onboarding/                  # Setup notebook: add the extension → connect (+ avatar) → save a first note
├── extension/connect/           # Opened by the extension's popup; connects this browser through the bridge
├── library/                     # A shelf of notebooks, one per topic; search and tag filter
├── t/[id]/                      # One topic: merged sections, [n] markers, Sources, tags, Read more
├── s/[slug]/                    # A shared topic: public, server-rendered, noindex
├── settings/                    # Account and avatar, devices, reading suggestions, export, delete account
├── sample/                      # A real article to try the extension on
├── privacy/, terms/             # The policy and terms
├── not-found.tsx                # A loose-leaf page with page 404 torn out at the binding
├── export/route.ts              # GET ?format=md | json: every note as one download
├── actions.ts                   # Server actions; every library edit goes through /sync/push
├── api/auth/google/             # Starts Google sign-in (state + PKCE S256)
├── api/auth/callback/google/    # Code → Google ID token → Go /auth/google → session cookies
├── robots.ts, sitemap.ts        # /robots.txt and /sitemap.xml (see SEO)
└── opengraph-image.png          # The link-preview card for every page
```

**Public:** `/`, `/signin`, `/s/*`, `/sample`, `/privacy`, `/terms`. **Signed in** (the middleware's matcher): `/library`, `/t/*`, `/settings`, `/onboarding`, `/extension/*`, `/export`.

`lib/`:

| File | What |
|---|---|
| `api.ts` | `api()`: server-side `fetch` to the Go API (`API_URL`), errors as `ApiError` with status and code |
| `session.ts` | Cookie names, `sessionCookies()`, `secondsLeft()` (reads a JWT's expiry) and `safeNext()`. Edge-safe, since the middleware imports it. |
| `data.ts` | `load()`: a GET as the signed-in user. A 401 after the middleware's refresh means the account is gone: off to `/signin`. |
| `notes.ts` | Pure functions from the API's library to what pages show: topic views, library cards, tags, Markdown, the backup format, device labels, avatars. No React and no Node APIs. |
| `bridge.ts` | The website's side of the extension bridge |
| `site.ts` | `SITE_URL` and the site's one-line description |

### Sign-in and sessions

1. `/signin` → `/api/auth/google` makes a `state` and a PKCE verifier, keeps them in a short-lived cookie, and redirects to Google (`openid email profile`, `prompt=select_account`).
2. `/api/auth/callback/google` checks `state`, swaps the code (with the verifier and the client secret) for Google's ID token, and sends it to the Go API's `POST /api/v1/auth/google` along with the browser's user agent, so Settings can name the device.
3. The API verifies the token and returns a 15-minute access token and a 60-day refresh token.
4. Both go into HttpOnly cookies, and the browser lands on `next` (the library by default): same-site paths only (`safeNext` refuses `//host` and `/\host`).

| Cookie | Readable by page script | Holds |
|---|---|---|
| `sn_access` | No | The 15-minute JWT. The cookie lasts 60 days; the middleware swaps the JWT inside it. |
| `sn_refresh` | No | The 60-day refresh token, rotated on every use |
| `sn_in` | Yes | `1`, and nothing secret: tells the static public pages to show *Your library* instead of *Sign in* |
| `sn_oauth` | No | `state`, the PKCE verifier and `next` during sign-in; path `/api/auth`, 10 minutes |

All are `SameSite=Lax`, and `Secure` in production.

- **`middleware.ts`** runs only on signed-in routes. When the access token has 30 seconds or less left, it refreshes, hands the new tokens to this request's server components and to the browser, and lets the request through. Router prefetches skip it, which keeps them out of refresh-token rotation. With no usable session it redirects to `/signin?next=…` and clears only the `sn_in` hint, so a refresh that failed because the API was briefly down can still succeed later.
- **Public pages stay static.** An inline script in `app/layout.tsx` sets `<html data-signed-in>` from the `sn_in` cookie before the first paint, `components/signed-in.tsx` keeps it right after client navigations, and CSS shows the matching header links.
- **Sign out** revokes the refresh token at the API, then deletes the cookies.

### The library and topic pages

- **`/library`** is a shelf of notebooks, one per topic, each in a cover colour picked from its id and carrying its latest note on a sticky note. Latest first. Search matches every word against titles, tags, notes, section headings, page titles and sites. Tag chips filter, with counts. Topics with no notes left are hidden. *Export all* downloads Markdown.
- **`/t/[id]`** is one sheet of ruled paper: notes grouped by section heading across all sources, oldest first, each in its highlighter colour and marked `[n]` for its source (numbered by first note), then the Sources list with *Move* beside each. The toolbar has Share, *Save as PDF* (the browser's print dialog; print styles keep only the notes, highlights and sources), Rename (a title you already use is refused), Merge (when you have other topics) and Delete.
- **Every edit is a push.** The server actions in `app/actions.ts` send `rename_topic`, `delete_topic`, `merge_topic`, `delete_highlight` and `move_source` through `/api/v1/sync/push`, the same endpoint the extension uses, then revalidate. Moving a page to a topic by name sends `create_topic` + `move_source`: a name you already have merges into that topic on the server, so one form both picks and makes.

### Sharing

The Share dialog switches a topic between **Private** and **Anyone with the link**. A public topic gets `/s/<12-character slug>`, showing the notes, the sources and the author's name and avatar, and nothing else from the account. Making it private kills the link for good; sharing again makes a new one. Deleting the topic kills it too. Share pages are rendered on the server, marked `noindex, nofollow`, and their source links carry `rel="noopener noreferrer nofollow ugc"`.

### Tags and reading suggestions

- **Tags** sit as chips on the topic sheet: × removes one, the dashed *Add tag* offers the tags already in your library. At most 12 per topic, lower case; the API cleans them.
- **Reading suggestions** are off until you decide. While undecided, a sticky note under Sources says what turning them on sends and to whom, with *Turn on suggestions* and *No thanks*. Settings has the same switch.
- **When on,** *Read more* (up to six pages to read next) and dashed amber tag ideas stream into the page through `Suspense`: the page renders first, since a topic's first build waits on Gemini and Brave Search. Failures show as nothing.
- **Older APIs:** when `/me` has no `suggestions` field, the website hides the offer and the switch.

The Markdown export lists tags; printing hides tags and suggestions.

### Settings, export and deleting the account

- **Account:** name and email, *Sign out*, and the avatar picker: twelve painted avatars. Until you pick one, you get the one your name always lands on (`avatarOf`).
- **Devices:** every browser and extension signed in, named from its user agent (*Chrome on macOS*, *stickynotes extension in Edge on Windows*), with when it was last active and a *Disconnect* button that signs it out within 15 minutes. With no extension connected, a row offers to connect one.
- **Reading suggestions:** the switch, with what it sends spelled out.
- **Your data:** `/export?format=md` (every topic as Markdown, with `[n]` markers and Sources) and `/export?format=json` (the extension's backup format: restore it from the extension's notes page).
- **Delete account:** type "delete" to confirm. The API deletes the account and every note, share link and session with it.

### Onboarding and connecting

`/onboarding` (linked from the header's *Connect the extension* pill, the empty library and Settings) and `/extension/connect` share one setup notebook (`components/setup.tsx`) on its own painted desk: three sticky-note steps on the kraft inside cover (add the extension, connect your account and pick an avatar, save your first note on `/sample`), ticked off as you go. *Add to Chrome* opens the store listing in a new tab. *I've added it* reloads the page, since the extension only greets pages that load after it. The header's *Extension connected* pill comes from `/me`'s `extension_seen_at`.

### The landing page

The sections, in order: the story, the sky, the shelf, good hands, and the FAQ.

- **The story.** Wherever scroll timelines are supported, the hero notebook stays on screen as you scroll: it straightens, grows, opens and turns six spreads, from a welcome and a passage filing itself to ten articles becoming one note, the privacy letter and getting started. It is pure CSS scroll-driven animation on the story's view timeline, animating only `transform` and `opacity` so the compositor runs it in step with the scroll. Replacing a JavaScript version that restyled about 1,100 elements a frame took a desktop from 38 to 60 fps, a 4×-throttled phone from 24 to 60 fps, and paint time from 810 ms to 3 ms on the same scroll.
- **Paper that bends.** Each turning leaf is four hinged strips, each hinge adding `sin(2πt)·13°`, so the free edge leads and then trails. The keyframe values were generated from those formulas; regenerate them if the bend or the turn changes.
- **Phones and short screens** read one page at a time: the camera follows each turning page.
- **Reduced motion or no scroll timelines** (Firefox, for one): the same pages stack like spreads, and the shelf is swiped instead of driven by the scroll.
- **The shelf** of topic notebooks slides sideways about a pixel for every pixel scrolled. **The sky** and **good hands** are two gouache paintings, the second with "you" written on a notebook's label in Caveat as it scrolls up.

### Security headers

`next.config.ts` sends, on every page: `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security: max-age=63072000`, `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy` that turns off camera, microphone, geolocation and payment. `X-Powered-By` is off.

---

## Backend (Go + PostgreSQL)

**Repository:** `stickynotes-backend`. Full documentation in its README; the short version is here.

| Layer | Technology |
|---|---|
| Language and router | Go 1.26, [chi v5](https://github.com/go-chi/chi) |
| Database | PostgreSQL via [pgx/v5](https://github.com/jackc/pgx), with [sqlc](https://sqlc.dev)-generated queries; no ORM |
| Migrations | [golang-migrate](https://github.com/golang-migrate/migrate), embedded in the binary and applied on every start |
| Auth | Google sign-in, HS256 access tokens (15 min), hashed refresh tokens (60 days, rotated, one per device), PKCE codes for the extension |
| Rate limiting | [httprate](https://github.com/go-chi/httprate): 300/min per user or IP, 20/min on sign-in and on extension token exchange |
| Reading suggestions | Gemini writes searches and tag ideas, Brave Search runs them, for users who turn them on |
| Hosting | Railway, with Postgres on the private network. No Redis. |

| Endpoint | What |
|---|---|
| `GET /health` | Database ping |
| `POST /api/v1/auth/google`, `/auth/refresh`, `/auth/logout` | Sign in with a Google ID token, rotate, sign out |
| `POST /api/v1/extension/codes`, `/extension/token` | Connect an extension (PKCE) |
| `GET`, `PATCH`, `DELETE /api/v1/me` | The user (plus `extension_seen_at`); avatar and suggestions switch; delete the account |
| `POST /api/v1/sync/push`, `GET /api/v1/sync/pull` | Sync: repeat-safe actions in, changes since a cursor out |
| `GET /api/v1/library` | Every live topic, source and note |
| `POST /api/v1/topics/{id}/share`, `PUT …/tags`, `GET …/suggestions` | Share link, tags, reading suggestions |
| `GET /api/v1/devices`, `DELETE /api/v1/devices/{id}` | Signed-in browsers and extensions |
| `GET /api/v1/shared/{slug}` | A public topic, no sign-in |

| Migration | What |
|---|---|
| 000001 | Users, refresh tokens, extension codes, topics, sources, highlights |
| 000002 | Highlight colours |
| 000003 | Avatars |
| 000004 | Tags, the suggestions switch, saved suggestions |

Run it with `make docker-up && make dev` (Postgres on :5433, the API on :8080); `make test` runs the unit and integration tests.

---

## Design System

The look is the **Classical** design system, copied verbatim into `app/classical.css` (minus its Google Fonts import: `next/font` self-hosts the faces). App styles in `app/site.css` and `app/landing.css` use its tokens, and `npm run lint` fails on a raw hex colour or `px` value in any `.tsx` file.

### Colour tokens

| Token | Value | Role |
|---|---|---|
| `--color-bg` | `#f3f2f2` | Page ground |
| `--color-surface` | `#eae9e9` | Surfaces |
| `--color-text` | `#201f1d` | Ink |
| `--color-accent` | `#b68235` | Amber accent |
| `--color-accent-2` | `#ac803e` | Second amber |
| `--color-divider` | ink at 16% | Rules and hairlines |
| `--color-danger` | `#9e3b2b` | Destructive actions (`site.css`) |

Each role also has a 100–900 tonal ramp, generated in OKLCH on one shared lightness scale so the same step of any role matches the others in value. The extension's toolbar badge uses `--color-accent-700` (`#7d5411`).

**Paper palette** (`site.css`, OKLCH): `--sheet` and `--rule` for ruled pages; `--kraft`, `--sky`, `--pink`, `--sage`, `--navy` and `--tangerine` for notebook covers (`toneFor` picks one from a topic's id); `--sticky` for sticky notes; `--pencil`, `--eraser`, `--ruling` and `--margin-line` for the drawn props; and `--marker`, a pink highlighter that shows on yellow.

**Highlighter tints** (`extension/content.css`), see-through so they read on light pages and dark ones:

| Colour | Tint |
|---|---|
| Yellow | `rgba(240, 196, 25, 0.38)` |
| Pink | `rgba(236, 100, 158, 0.3)` |
| Blue | `rgba(70, 145, 230, 0.3)` |
| Green | `rgba(80, 175, 80, 0.32)` |

### Typography

| Role | Typeface | Where |
|---|---|---|
| Headings | Cormorant Garamond 600 | `--font-heading`; display text goes lighter |
| Body | Lora | `--font-body` |
| Margin notes | Caveat | `.hand`: "Dear reader," and the handwritten asides |
| Notes | Playwrite DK Loopet | `--font-script`: the joined handwriting of notes on topic and share pages |
| Extension UI | Georgia | The bar, the toast, the popup and the notes page; the extension bundles no fonts |
| Mono | System monospace | `--font-mono` |

### Spacing, radius, elevation

```
--space-1: 4.6px    --space-2: 9.2px    --space-3: 13.8px
--space-4: 18.4px   --space-6: 27.6px   --space-8: 36.8px

--radius-sm: 2px    --radius-md: 4px    --radius-lg: 7px

--shadow-sm / -md / -lg: soft shadows tinted with the ink colour
```

### Art and brand assets

| Asset | Where |
|---|---|
| Four gouache paintings: the sign-in desk, the setup desk, the sky, the good hands | `public/art/` |
| Twelve painted avatars (cats, dogs, a robot, people and more), cut from one generated sheet | `public/avatars/<key>.webp` |
| The icon: a yellow highlighter character on muted sky, 1024 px | `brand/stickynotes-icon.png` |
| Cut from it: favicon (16/32/48), `icon.png` (192), `apple-icon.png` (180), extension icons (16/32/48/128) | `app/`, `extension/icons/` |
| Chrome Web Store art: five 1280×800 screenshots and the 440×280 promo tile | `brand/store/` |
| The 1200×630 link-preview card, drawn after the promo tile | `app/opengraph-image.png` |

Drawn props (notebooks with name labels, sticky notes, die-cut stickers, a pencil, a mechanical-pencil cursor that steps aside in forced-colours and high-contrast modes) are CSS and inline SVG.

### Principles

1. **Tokens only.** No raw colours or pixel values in components; the lint step enforces it.
2. **Paper, not chrome.** The library is a shelf of notebooks, a topic is a ruled sheet, setup is a notebook with sticky notes. Settings is the exception: plain rows with labelled buttons, because handwriting hid its controls.
3. **CSS before script.** Scroll-driven CSS for the landing, the native `<dialog>` for modals (focus trap, Escape and the top layer for free), print styles for *Save as PDF*.
4. **Motion is optional.** Reduced motion, or a browser without scroll timelines, gets a still version of everything.

---

## SEO

Configured with Next.js's metadata API and file conventions: nothing to run, all generated at build time.

| File | What it does |
|---|---|
| `lib/site.ts` | `SITE_URL` (`https://www.stickynotes.in`) and the one-line description, shared by everything below |
| `app/layout.tsx` | `metadataBase`, the default description, `application-name`, and Open Graph (`siteName`, `en_GB`, `website`) plus a `summary_large_image` Twitter card. Every page's link preview uses its own title and description. |
| `app/opengraph-image.png` (+ `.alt.txt`) | The 1200×630 preview card. Next serves it and adds `og:image` and `twitter:image` to every page, shared topics included. |
| `app/robots.ts` | `/robots.txt`: everything allowed except `/api/` and the signed-in routes, which only redirect a crawler to `/signin`; points at the sitemap |
| `app/sitemap.ts` | `/sitemap.xml`: `/`, `/privacy`, `/terms` |
| `app/page.tsx` | The landing's title and canonical URL, and JSON-LD: a `WebSite` (the site's name in search results) and a `SoftwareApplication` (a free browser extension, installed from the Chrome Web Store) |
| `app/privacy`, `app/terms` | Their own descriptions and canonical URLs |
| `app/sample` | `noindex`: a stand-in article for trying the extension |
| `app/s/[slug]` | `noindex, nofollow`: shared by link, not published. The topic's title and first note make its link preview. |

Shared topics stay crawlable in `robots.txt` on purpose: a crawler has to fetch a page to see its `noindex`. Not-found pages get `noindex` from Next automatically. In a production build the metadata is in `<head>` for every crawler checked (Googlebot, facebookexternalhit, Twitterbot, Slackbot); under `next dev` it streams into the body, which is expected.

**Once, after deploying:** submit `https://www.stickynotes.in/sitemap.xml` in Google Search Console. The preview card is a static PNG: replace the file to change it, keeping 1200×630.

---

## Privacy & Security

- **Collection starts at a save.** The extension sends nothing until a note is saved, then only that note: the passage, its section heading, up to 32 characters either side, its colour, and the page's address, title and site name. No browsing history, no page lookups.
- **Tokens stay server-side on the web.** The website's tokens live in HttpOnly cookies and only the Next.js server sends them to the API. The extension has its own session, connected with PKCE, so no token ever passes through a web page.
- **Sign-in** uses `state` and PKCE S256, and the post-sign-in redirect only goes to paths on this site.
- **Shared topics** are unguessable 12-character links (72 random bits), kept out of search engines, and die for good when made private.
- **Reading suggestions are opt-in.** Turned on, a topic's title and its 30 newest notes go to Google's Gemini, and the searches it writes go to Brave Search. The switch says, in plain words, that Google may use what it receives and that people at Google may read it. Turning it off deletes what was found.
- **The extension's surface is small.** Its UI is in a closed shadow root, script-made mouse events are ignored, the bridge answers only the website's own top frame, and pages may only undo or refile notes they saved in the last 10 minutes.
- **Deleting the account is a hard delete** of every note, share link and session, at once.
- **Policies:** [`/privacy`](https://www.stickynotes.in/privacy) (dated 19 October 2026) lists every field, cookie, log and third party, with both Limited Use statements, and matches the Chrome Web Store privacy answers: change them together. [`/terms`](https://www.stickynotes.in/terms).

The 2026-10-12 security review (AgentShield, govulncheck, npm audit, and a read of auth, sync, sharing and the bridge) added the security headers and the untrusted-mouseup check, and moved the backend to rate-limit keys that forged tokens and a spoofed `X-Forwarded-For` can't game. [`PLAN.md`](PLAN.md#deploy) lists what was left as is, and why.

---

## Build History

Built in seven phases; [`PLAN.md`](PLAN.md) has the detail, the checks each one passed, and what changed from the plan.

| Phase | Date | What it added |
|---|---|---|
| **1. Backend foundation** | 2026-10-09 | Google sign-in, refresh and logout, `/me`, the full schema, unit and integration tests |
| **2. Web + sign-in** | 2026-10-09 | The Next.js site with its own Google OAuth (state + PKCE), session cookies and middleware refresh; Next patched for critical advisories |
| **3. Sync end to end** | 2026-10-09, merged 2026-10-12 | Extension connect (PKCE codes), repeat-safe push and pull, the outbox, the 5-minute alarm. The v1 extension's bugs fixed: lost concurrent saves, dropped query strings, non-UUID ids. |
| **4. Topics + extension UX** | 2026-10-10, merged 2026-10-12 | `page.js` (addresses, topic matching, anchors), restored tints, the Classical bar and toast, the designed popup |
| **5. Web library** | 2026-10-12 | Library, topic pages, sharing, Settings with devices and export, onboarding, the sample article |
| **Redesign** | 2026-10-12 to 16 | The paper look: notebooks, sticky notes, painted scenes, the scroll-driven landing, painted avatars, highlighter colours |
| **6. Reading suggestions + tags** | 2026-10-19 | Tags on topics, opt-in suggestions from Gemini and Brave Search |
| **7. Ship** | from 2026-10-12 | `stickynotes.in`, icons, store art, the privacy policy and terms, Google OAuth branding verification, the Chrome Web Store listing (1.0.0), SEO |

---

## Deployment

| Service | Provider | Address |
|---|---|---|
| Website | Vercel | [https://www.stickynotes.in](https://www.stickynotes.in) (the apex redirects to `www`) |
| API | Railway | [https://stickynotes-backend-production.up.railway.app](https://stickynotes-backend-production.up.railway.app/health) |
| Database | Railway Postgres | Private network only |
| Extension | Chrome Web Store | [stickynotes](https://chromewebstore.google.com/detail/stickynotes/fciennljceeoagambkjppepghigkcnep) (1.0.0); Edge and Brave install from the same listing |

**Vercel** builds this repo from `main`. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `API_URL` (the Railway URL).

**Google OAuth client** (Google Cloud project *stickynotes*, one Web client): add `<origin>/api/auth/callback/google` as an authorized redirect URI for every origin people sign in from: `http://localhost:3000` for development and `https://www.stickynotes.in` in production. The same client's ID goes into the API's `GOOGLE_CLIENT_IDS`.

**The extension** talks only to the exact origins packed into it: a new web or API origin means a new store version (see [Packaging for the store](#packaging-for-the-store)). Changes to `extension/` reach store users only with the next version.

**Order:** when a backend migration ships, deploy the backend first. The website hides what an older API doesn't support, and older extensions keep working against a newer API.

---

## Development Setup

Needs Node 22.18 or newer (`npm test` runs TypeScript files directly through Node's type stripping), Chrome, and the backend running locally.

```bash
# 1. The API (../stickynotes-backend)
make docker-up                # Postgres on :5433
cp .env.example .env          # JWT_SECRET and GOOGLE_CLIENT_IDS
make dev                      # http://localhost:8080

# 2. The website (this repo)
npm install
cp .env.example .env          # GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
npm run dev                   # http://localhost:3000. It must be :3000: that's the OAuth redirect URI.

# 3. The extension
#    chrome://extensions → Developer mode → Load unpacked → extension/
#    Then sign in on http://localhost:3000 and connect it from the popup or /onboarding.
```

| Variable | Needed for |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in, from the stickynotes Google Cloud project's Web client |
| `API_URL` | The Go API. Defaults to `http://localhost:8080`. |

`.env` is gitignored, as is anything matching `*client_secret*.json`. A leaked OAuth secret needs rotating in Google Cloud, not just a revert: git history keeps the blob.

| Script | What |
|---|---|
| `npm run dev` | `next dev --turbopack` |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | oxlint, then the design check (no raw hex or `px` in `.tsx`) |
| `npm test` | The unit tests for the website and the extension |

After editing `extension/`, reload it on `chrome://extensions`, then reload the pages you're testing on: a page open during the reload keeps an orphaned content script, which removes its button.

---

## Testing

```bash
npm test             # 29 unit tests, website and extension
npx tsc --noEmit     # type-check
npm run lint
npm run build
```

| Suite | Covers |
|---|---|
| `lib/session.test.ts` | `safeNext` keeps same-site paths only; `secondsLeft` reads `exp` and fails closed |
| `lib/notes.test.ts` | Topic views merge sections and number sources, library cards, tag counts, time-ago labels, Markdown with escaped links, the backup format, device labels, avatars |
| `extension/sync.test.js` | The store and outbox: saving by topic, deletes, topic-id merges, moves, acknowledging batches, batch limits, pulls, backups (v1 included), colours |
| `extension/page.test.js` | Clean addresses, when to trust a canonical link, page titles, topic matching, finding a passage again |
| `extension/background.test.js` | The worker with `chrome.*` stubbed: saving, badges and tints, who may undo or delete, notes under an old address, the topic you're reading in, connecting another account, View waiting for its save |

`npm test` prints a `MODULE_TYPELESS_PACKAGE_JSON` warning; it is harmless. There is no browser end-to-end suite: the extension has been checked by loading it in a real Chrome against a local API and a throwaway account. The backend's tests live in its repo (`make test`).

---

## Known Limits

Most are marked with a `ponytail:` comment where they live.

| Limit | Where |
|---|---|
| The extension's store is one storage key, rewritten on every change. Split it per record if stores reach many MB. | `extension/background.js` |
| If the extension's worker stops between the API rotating its refresh token and storing the new one, the extension has to be connected again. | `extension/background.js` |
| Two tabs refreshing the website's session at the same moment can send one of them to `/signin`. | `middleware.ts` |
| Topic matching compares exact words, plurals folded: "hash" and "hashing" don't match. | `extension/page.js` |
| Passages inside iframes or other shadow roots, or selections that cross hidden text, aren't re-tinted. The note itself is kept. | `extension/content.js` |
| A page's own scripts can read which passages were saved on it, through the CSS Highlight registry: the price of not touching its DOM. | `extension/content.js` |
| *Change* leaves the old topic in place with no notes. Matching skips it and the library hides it. | `extension/sync.js` |
| The *Extension connected* pill and onboarding go by the account (any connected extension), not by this browser. | `components/layout.tsx` |
| Settings can't mark "this browser": the access token doesn't say which session it belongs to. | `app/settings/` |
| *Save as PDF* is the browser's print dialog, not a one-click file. | `app/t/[id]/topic.tsx` |
| The popup shows initials, not the painted avatar. | `extension/popup.js` |
| `npm audit` flags the PostCSS that Next 15 pins. It only matters for untrusted CSS, which the app never processes; Next 16 fixes it. | `package.json` |

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Google says `redirect_uri_mismatch` | The dev server isn't on :3000 (is another project holding the port?), or this origin's `/api/auth/callback/google` isn't in the OAuth client. |
| `/signin?error=server` | The API is unreachable (`API_URL`, or the backend isn't running), or it refused the Google token: this site's `GOOGLE_CLIENT_ID` must be in the API's `GOOGLE_CLIENT_IDS` (the API logs `google_oauth_audience_mismatch`). |
| `/signin?error=google` | The code exchange with Google failed: check `GOOGLE_CLIENT_SECRET`. |
| `/signin?error=expired` | The sign-in cookie was missing or didn't match: sign-in took over 10 minutes, or was started again in another tab. |
| *Save note* or Alt+S does nothing | `chrome://` pages and the Web Store can't run extensions. Elsewhere the worker injects its script on the menu or the shortcut; reload the tab if it still fails. |
| No Save bar on a tab after reloading or updating the extension | That tab's old content script was orphaned and removed its button. Reload the page (Alt+S and the menu work without reloading). |
| The popup says *Not connected. Notes stay on this device.* | Click Connect (it opens `/extension/connect`). Notes saved meanwhile sync once connected. |
| The connect page can't find the extension | The extension greets only pages loaded after it: reload. Also check that `WEB_ORIGIN` in the extension's `config.js` is exactly this site's origin, `www` included. |
| Notes saved but never reach the library | The extension isn't connected. Unconnected saves wait in its outbox and sync after connecting. |
| A library edit hasn't reached the extension yet | It arrives on the next pull: a save, opening the popup, or within 5 minutes. |
| Highlights don't come back on a page | The passage is in an iframe or shadow root, crosses hidden text, or the page's text changed around it. The note is still in the library. |
| No reading suggestions | They're off (Settings); the API lacks `GEMINI_API_KEY` and `BRAVE_SEARCH_API_KEY`; the API predates them (no `suggestions` in `/me`); or builds are paused after a failure. |
| `npm run lint` fails on a `.tsx` line | A raw hex colour or `px` value: use a token from `classical.css` or `site.css`. |
| `npm test` fails with a syntax error in a `.ts` file | Node is older than 22.18 and doesn't strip types. |

---

## Documentation

| Document | What |
|---|---|
| [`PLAN.md`](PLAN.md) | Read first: the product, every decision, phase status, deploy notes, the security review and known limits |
| [`CLAUDE.md`](CLAUDE.md) | Working notes for coding agents |
| `stickynotes-backend/README.md` | The API: sessions, the sync protocol, the data model, reading suggestions |
| [`/privacy`](https://www.stickynotes.in/privacy), [`/terms`](https://www.stickynotes.in/terms) | The live policy and terms |

---

## Contact

**Email:** contact@paperboxd.in  
**Website:** [stickynotes.in](https://www.stickynotes.in), a [PaperBoxd](https://paperboxd.in) production
