# SiteGuard — hosting-ready version

This is a real, deployable web app version of your risk assessment tool. It installs on a
phone like an app (icon, splash screen, offline shell) even though it isn't on the Play Store.

## What changed from the Claude preview
- Storage now uses the browser's local storage instead of Claude's artifact storage.
  Data stays on that specific phone/browser (not synced across devices yet).
- The photo/video analysis now calls **your own backend** (`/api/analyze`) instead of
  Anthropic directly. This keeps your API key private — never put an API key in
  frontend code, since anyone could view it in the browser.

## What you need before deploying
1. A **free GitHub account** (to hold the code) — github.com
2. A **free Vercel account** (to host it) — vercel.com — sign in with GitHub
3. An **Anthropic API key** — console.anthropic.com → get an API key. This is a paid-per-use
   key (separate from your claude.ai subscription), needed only for the photo-analysis feature.

## Deploy steps
1. Create a new GitHub repository and upload everything in this folder to it.
2. Go to vercel.com → "Add New Project" → import that GitHub repo.
3. In the project's Vercel settings → Environment Variables, add:
   - `ANTHROPIC_API_KEY` = your key from console.anthropic.com
4. Click Deploy. Vercel gives you a live URL like `siteguard-yourname.vercel.app`.
5. Open that URL on your phone. Tap the browser menu → "Add to Home Screen"
   (Chrome/Android) or "Add to Home Screen" (Safari/iOS). It now behaves like an app,
   with your icon and no browser address bar.

## Local testing (optional, before deploying)
```
npm install
npm run dev
```
Note: the photo-analysis feature needs the serverless function, which only runs on
Vercel (or `vercel dev` locally) — it won't work with plain `npm run dev` alone.

## Play Store, later
Once you've validated people will actually pay for this, the cheapest path to the
Play Store is wrapping this same hosted URL as a Trusted Web Activity using Google's
free "Bubblewrap" tool — no rebuild needed. That's a separate, later step; skip it
until you have paying users.

## Cost to be aware of
Each photo/video analysis calls the Anthropic API and costs a small amount (fractions
of a cent to a few cents per image depending on usage). Factor this into what you
charge clients per site visit or subscription.
