# stickynotes

Read `PLAN.md` first. It has the product, the decisions, phase status and the next steps.

- Frontend repo: Next.js 15 at the root, browser extension in `extension/` (from phase 3).
- Backend: `../stickynotes-backend` (Go). Mirror patterns from `../paperboxd` and `../paperboxd-backend`,
  but never copy their env values.
- Secrets live in gitignored `.env` files. Never print or commit them.
- When a phase or step is finished, update its status in `PLAN.md`.
