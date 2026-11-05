# Portfolio — how it works & where to tweak

```
npm install      # once
npm run dev      # develop
npm run build    # production build -> dist/   (deploy the dist folder)
npm run typecheck && npm run lint
```

## The scroll experience (`src/hooks/useScrollStage.ts`, `src/index.css`)
Hero is `fixed`. The portfolio panel is a normal block that the page's own scroll lifts over it —
nothing moves it by a pixel value, so it behaves the same on every screen. After the panel there is a
closing "runway" (`.contact-runway`, one screen + 7rem) that lets it lift away and uncover the fixed
contact section behind it. Once the panel fully covers the hero the hero is switched off and the contact
section switched on (`data-covered` on `.stage`).
* Parallax strength → `PARALLAX` at the top of `useScrollStage.ts` (`vh: 0.12` = 12 % of screen height).
* Parallax follow-speed → `FOLLOW_SECONDS` (lower = tighter to the scroll).
* On very short screens the contact block scales down to fit (`ContactSection.tsx`).

## Hero controller — scale & position of every hero element, per resolution
Open the site with **`?controller` at the end of the URL** (e.g. `http://localhost:5173/?controller`, or
`aamirnaqvi.in/?controller`) or press **Alt+Shift+H**. Close with ✕ (or Alt+Shift+H again).
* Click an element on the hero and drag it, or pick it in the list: both photos, *Aamir*, *Naqvi*, each of the
  7 testimonials (badge + quote + name + role move/scale as one block) and the scroll indicator. Arrows nudge
  (Shift = bigger steps), `+` / `-` resize.
* Every change is saved as a **keyframe at the current window size** (like auto-keyframe in After Effects). Between
  two keys the values glide; before the first / after the last key they hold. The first key of an element is
  fenced in by two neutral keys at the neighbouring standard resolutions, so tuning 2560 px doesn't change 1920 px.
* "Keyframe by": **Screen width** (default for the landscape hero) or **Aspect ratio** (default for the phone hero,
  where screen shape matters more than width). Switching clears that hero's keys.
* To edit another resolution, resize the window (or use the browser's device toolbar) and change values there.
  The phone hero is edited the same way in a narrow / tall window (aspect <= 0.62) or on a phone.
* Values: X / Y are **% of screen width / height**, Size is a **%** (100 = unchanged). They are *added on top of*
  the existing desktop -> tablet morph (`useHeroMorph.ts`), which stays as it was. An element with no keys is never
  touched, so the shipped look is unchanged until you add keys.
* Your work is a draft kept in this browser (localStorage). When happy: **Copy JSON** (or Download), put it in
  `src/data/heroControls.json`, `npm run build`, deploy `dist`. Visitors never get the panel (it's a separate
  lazy chunk) and nothing is ever sent anywhere.
* Code: `src/utils/heroControls.ts` (model, maths, which DOM nodes belong to which element),
  `src/hooks/useHeroControls.ts` (applies the keys with CSS `translate` / `scale`, which stack on the existing
  transforms), `src/components/HeroController.tsx` (the panel).
* If you re-export the hero designs and the `text_N` / `image_N` ids change, update the lists in `heroControls.ts`.

## Which hero composition a screen gets (`src/utils/layout.ts`)
Decided by aspect ratio, not just width: portrait (9:16 and taller, or ≥960 px wide and taller than 0.72)
→ the portrait composition; everything else → the landscape one, which morphs towards its "tablet" state
on narrow portrait-ish windows (`useHeroMorph.ts`). **`index.html` repeats this rule in its preload /
`<picture>` media queries and `index.css` in one `@media` — change all three together.**

## Videos (`src/utils/playbackManager.ts`, `src/components/VideoTile.tsx`)
Every tile always shows its thumbnail. Only the few tiles nearest the middle of the screen play
(`playBudget()`: 6 desktop / 4 tablet / 3 phone, fewer on low-end or data-saver devices); the next few
pre-buffer; everything else holds no decoder and no data. Raise the numbers in `playBudget()` if you
prefer more simultaneous motion.
* Add / reorder videos and thumbnails → `src/data/content.ts` (`thumb` = number of the file in `public/thumbnails`).
* **Biggest remaining speed-up:** run `scripts/make-previews.sh <folder-of-videos>` (needs ffmpeg), upload the
  small `previews/` clips and the `faststart/` versions next to your videos, then add
  `preview: '<url>'` to each item in `content.ts`. Grid tiles then play a ~150 KB clip; the full video is
  only used for fullscreen and the showreel.
* Videos are served from jsDelivr's GitHub mirror, which is built for code, not video, and is the slowest
  link left. Cloudflare R2 / Bunny / any object storage with a CDN will start them noticeably faster.

## Assets
`public/pc` (landscape hero), `public/mobile` (portrait hero), `public/hero/*.html` (the two hero text
designs, fetched only for the composition in use), `public/thumbnails`. `public/_redirects` is kept here
so Netlify's fallback rule survives rebuilds.
