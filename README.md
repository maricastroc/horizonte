<h1 align="center">
  <br>
  <img src="src/app/icon.png" alt="Horizonte" width="40">
  <br>
  Horizonte
  <br>
</h1>

<h4 align="center">A music player where the music has mass, and mass bends space.</h4>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white" alt="Three.js" />
  <img src="https://img.shields.io/badge/WebGL-990000?style=for-the-badge&logo=webgl&logoColor=white" alt="WebGL" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" />
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-the-field-engine">Field Engine</a> •
  <a href="#-the-sensory-signature">Sensory Signature</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#ℹ%EF%B8%8F-how-to-run-the-application">How To Run</a> •
  <a href="#-license">License</a>
</p>

<p align="center">
  Not a 3D scene with a UI on top — a single full-screen fragment shader that bends the typography and the album art with the same gravitational field. Every album carries its own physics, measured from its own audio.
</p>

<p align="center">
  🔗 <strong>Live demo:</strong> <a href="https://horizonte.marianacastro.dev">horizonte.marianacastro.dev</a>
</p>

<p align="center">
  <img src="docs/colecao.png" alt="Horizonte" width="800" />
</p>

<br/>

## 🌌 Features

|                              |                                                                                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **🌀 Gravitational Lens**     | One full-screen fragment shader bends two 2D canvas planes. The monumental typography, the album art and the dust are all deformed by the same field — nothing is drawn "on top". |
| **🖱️ Cursor With Mass**       | The pointer is a body in the field, with accumulated velocity and inertia leaving a wake. No CSS hover is involved anywhere in the world layer.                        |
| **🔭 Scales, Not Screens**    | Collection → album → track is one continuous interpolation of anchor, radius, type size and mass — never a route change or a mounted/unmounted view.                   |
| **💥 Collapse & Fusion**      | Play runs a 2.25s collapse with a 180ms exposure valley and a jet; skipping runs a 1.6s fusion where the incoming body spirals in and emits a wave across the viewport. |
| **🎛️ Instruments Layer**      | Controls live in a separate DOM layer that is mono, never deformed, always clickable, and auto-fades to 32% after 2.6s of stillness. No action depends on a keyboard shortcut. |
| **🔊 Real Audio Analysis**    | `HTMLAudioElement` → `AnalyserNode` → three bands feeding the field, under a ceiling set by each record's dynamics (5–20%) so the typography accents the music instead of dancing to it. |
| **🧬 Per-Album Physics**      | Each album's loudness, dynamics, brightness, length and pulse are measured offline and become the constants and the shape of its world — playback only perturbs them. |
| **🔍 Why This Shape?**        | A view beside the track list reads each record's shape back to its music as questions about what you see, isolates that part of the world, and lets you set one descriptor to the catalogue median to watch the shape respond. |
| **🌐 Two Languages**         | The whole experience — instruments, measurement, announcements and the "Why this shape?" questions — exists in English and Brazilian Portuguese, picked from the browser and switchable in place without touching playback. |
| **📀 Bring Your Own Record**  | Drop your own files and the same DSP runs **in the browser**, in a worker, producing the same `AlbumSignature` the curated catalogue gets. Nothing is uploaded — no backend, no CDN, no API. |
| **⚖️ Licensed Curation**      | Fourteen real albums — twelve CC BY 4.0 and two CC BY-SA 4.0 — each verified at the source by a pipeline that aborts on any license mismatch, with attribution surfaced in the UI.                 |
| **♿ Accessible By Design**   | Real `button` / `ul` / `li`, `aria-current`, `aria-pressed`, `role="progressbar"`, `aria-live`, visible keyboard focus, and a full `prefers-reduced-motion` path.       |

<br/>

## 🖼️ Screenshots

<table>
  <tr>
    <td align="center" width="50%"><strong>Album — sectorized ring</strong></td>
    <td align="center" width="50%"><strong>Track in progress</strong></td>
  </tr>
  <tr>
    <td valign="top"><img src="docs/album.png" alt="Album — sectorized ring" /></td>
    <td valign="top"><img src="docs/faixa.png" alt="Track in progress" /></td>
  </tr>
</table>

<br/>

## 🛠️ Tech Stack

<p>
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white" alt="Three.js" />
  <img src="https://img.shields.io/badge/WebGL-990000?style=for-the-badge&logo=webgl&logoColor=white" alt="WebGL" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/NumPy-013243?style=for-the-badge&logo=numpy&logoColor=white" alt="NumPy" />
  <img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" />
</p>

| Category          | Technologies                                                              |
| ----------------- | ------------------------------------------------------------------------- |
| **Framework**     | Next.js 16 (App Router), React 19                                         |
| **Language**      | TypeScript 5                                                              |
| **Rendering**     | three.js 0.185 (`RawShaderMaterial`, full-screen triangle), custom GLSL    |
| **Composition**   | Canvas 2D — two offscreen planes uploaded as `CanvasTexture` every frame   |
| **Audio**         | Web Audio API (`AnalyserNode`, FFT 1024) over `HTMLAudioElement`           |
| **Styling**       | Tailwind CSS v4 (instruments layer only — the world is canvas)             |
| **Typography**    | Archivo, Bodoni Moda, JetBrains Mono — self-hosted via `next/font`         |
| **Media**         | `public/music`, or a CDN base via `NEXT_PUBLIC_MEDIA_BASE_URL` (Vercel Blob in production) |
| **Offline Tools** | Python 3 + NumPy + Pillow (curation, audio analysis), `afconvert`          |
| **In-Browser DSP**| Web Worker, `OfflineAudioContext`, hand-written real FFT (no dependencies) |
| **Tooling**       | ESLint, TypeScript strict mode, Vitest, GitHub Actions                    |

<br/>

## 📝 Project Description

Horizonte is a spatial music experience built on one idea: **music has mass, and mass bends space.**

The whole composition — monumental typography, album art, dust, void — is drawn into two offscreen 2D canvases and deformed by a gravitational-lens fragment shader. There is no 3D scene and no UI floating above a background: the same field bends the artist's name and the album art at once. The front plane, which carries the whole lockup (artist, title and metadata), is sampled with a compressed share of the displacement (about 80% far from the body, falling to about 60% near it), and that parallax is what makes the lockup pass *in front of* the body while everything else passes behind it.

Navigation is a change of physical scale rather than a change of screen. Collection, album and track are the same world at different anchors, radii, type sizes and mass values, interpolated continuously — nothing mounts or unmounts. A separate **instruments layer** (mono, 10.5px, never deformed) guarantees every fundamental action stays clickable and legible, including at the peak of the collapse.

**Additional features:**

- **The field engine:** The flagship piece. See the [dedicated section](#-the-field-engine) below — a single draw call per frame, two texture uploads, and a state machine that treats collapse and fusion as physical events rather than transitions.
- **Sensory signatures:** Each album's audio is analysed once, offline, into loudness / dynamics / brightness / duration descriptors that become that album's field constants — see the [dedicated section](#-the-sensory-signature).
- **Decoupled audio pipeline:** `audio source → playback → analysis → visual state → Horizonte`. The scene never touches an `<audio>` element or an `AnalyserNode`; it reads a plain `VisualAudioState` (energy, three bands, accent, spectral flux, spectrum, progress). `AudioSource` is a discriminated union and `Playback` is an interface, so another provider can be added without touching the shader, the composition or the state machine.
- **Verified curation:** Fourteen albums from real artists — twelve **CC BY 4.0** and two **CC BY-SA 4.0**, whose share-alike obligation is documented per album — each verified at the source before download. The pipeline aborts if the declared licence doesn't match, if the download disappears, or if durations don't line up with the catalogue metadata. Six candidates were rejected on inspection — two declared contradictory licences on the same page, two were CC BY-**NC-ND** (no transcoding, no commercial use), one was a paid pack under a proprietary licence, one had no CC licence at all. Provenance, attribution, cover licensing and the exact modifications applied to each work are documented in [`CURADORIA.md`](CURADORIA.md).
- **Cover unification:** Real covers arrive with wildly different exposure and palette. Each one is desaturated ~8%, overprinted with the album ink, given a shared grain, and exposure-equalised so a dark ambient sleeve still reads in the `lighter`-composited ring. The two inks are extracted from the artwork and forced into `oklch(L .50–.62, C .13–.18)` — a narrow band that keeps the collection coherent.
- **Bring your own record:** The same analysis that runs offline for the curated catalogue also runs **client-side**, in a Web Worker, over files the listener drops in. `analyze-audio.py` was ported to TypeScript and verified against it: fed identical PCM, the two produce **byte-identical envelopes on all fourteen albums**. End to end from the real `.m4a` files, the derived field constants land within **0.55% of each constant's range**. Files never leave the device — no upload, no backend, no external API. The full architecture, the parity measurements and the limitations are in [`docs/ingestao-local.md`](docs/ingestao-local.md).
- **Written twice, interpreted once:** What a shape says about its music is decided by one language-free module, and two writers — English and Brazilian Portuguese — turn that reading into questions with their own plurals, genders, ordinals and decimal marks. The rest of the interface reads from two typed dictionaries that share every key. The language follows the browser on a first visit, a boot script applies it before the first paint, and switching never interrupts playback. Details in [`docs/idiomas.md`](docs/idiomas.md).
- **Media served by path:** Audio and covers live under deterministic pathnames that mirror the catalogue (`/music/<album>/<track>.m4a`), from `public/music` or, in production, from Vercel Blob, served with HTTP Range (for seeking), permissive CORS (so the analyser isn't silenced and covers don't taint the canvas) and a one-year immutable cache. URL resolution is centralised in a single module; no absolute URL is hardcoded in a component.
- **Reduced motion:** With `prefers-reduced-motion`, curvature drops to 25%, radial blur and cursor parallax are disabled, and the collapse and fusion are reduced to 300ms fades — **the state changes remain**, so nothing becomes unreachable.
- **Responsive compositions:** Desktop, tablet (rails collapse into a single column, ring labels reduced to the selected track) and mobile (one body per screen, drag becomes pagination, 48px touch targets).

<br/>

## 🌀 The field engine

Everything the user sees is produced by **one draw call and two texture uploads per frame**:

```
step(dt) → drawBack() → drawFront() → render() → updateInstruments()
              │              │            │
      back plane        front plane    fragment shader
   (halo, ring, dust,   (title, sub,   (three masses + wave →
    typography, art      art fragment)  UV displacement, chromatic
    band, scrims)                       dispersion, radial blur,
                                        core, rim, jet, grain)
```

**Three masses bend the UVs.** The focused body, a secondary body (the neighbour in the collection, or the incoming album during a fusion) and the cursor each contribute a radial pull plus a tangential component. Sampling is chromatically dispersed (R/G/B at slightly different offsets) and radially blurred along the displacement.

**The front plane, compressed.** Both planes are sampled with the same offset field, but the front one through a saturating curve (about 80% of it far from the body, about 60% near it). Artist, title and metadata all live there, so the lockup bends as one piece and its lines never collide. That difference in parallax is the entire depth illusion — no z-buffer, no camera.

**The collapse is a sequence, not a transition.** Pressing play runs 2.25s of scripted physics: mass ramps from 0.055 to 0.36 while exposure falls to a **180ms valley at 3%**, then the field relaxes as a jet fires along a fixed diagonal and the art band rises from the bottom edge.

**The fusion is the signature interaction.** Skipping to another track spirals the incoming body in from radius 1.5 over 0.9s while both artworks coexist as crossed arcs — then emits a wave that crosses the viewport, deforming the typography as it passes, and the audio switches on exactly that beat.

**Performance is budgeted.** DPR is capped at 1.3, the composition canvas at 1760px, ring buffers are baked once per album (and re-baked only when the selection changes), and the progress arc is only recomposited when it would actually move a pixel. If sustained frame rate drops below 52fps *while the tab is visible*, the composition canvas steps down to 1440px.

<br/>

## 🧬 The sensory signature

Reacting to live audio is the easy half. The harder question is: **why should two albums feel different when nothing is playing?**

So the audio is analysed **once, offline** ([`scripts/analyze-audio.py`](scripts/analyze-audio.py)), and what a record *is* becomes constant:

| Measured        | Becomes                                                          |
| --------------- | ---------------------------------------------------------------- |
| **Loudness**    | Type weight (505–780) and the size of the dark core — heavy records sit heavier |
| **Dynamics**    | How far live audio may perturb the field, and how carved the outline is |
| **Brightness**  | How flat the body lies and how hard its rim light is             |
| **Duration**    | Satellites around the body, and camera inertia across the collection |
| **Pulse**       | Layers in the ring and the swirl of the field                    |
| **Track spans** | Real proportional widths of each sector in the ring              |
| **Pulse spread between tracks** | Breaks between the sectors                       |

Records also differ in how they move. While one plays, its **motion signature**, measured per track by [`scripts/analyze-motion.py`](scripts/analyze-motion.py) (attack sharpness, sustain, microdynamics and low-end weight), sets how fast the reaction rises and falls, how far into the record's ceiling a typical event reaches, and whether it bends the lens or the light. At rest, and for records brought by a listener, the response is neutral.

Two determinism guarantees hold the design together: every descriptor is normalised against **fixed absolute anchors** rather than against the other albums, so adding a record never changes anyone else's signature; and the fallback ink for achromatic covers is derived from **that album's own spectral balance**, never from its position in the list.

The result is the split the whole project rests on: **identity is measured and constant, reaction is live and bounded.** Playback perturbs the constants by at most each record's own ceiling, 5% to 20% — bass nudges mass, dynamics tension the field's spin, treble interferes with light through chromatic dispersion. Never an equaliser, never bars, never a sphere pulsing on the beat.

The full mapping, with the calibrated ranges and the limits that keep records apart, is in [`docs/mapa-sensorial.md`](docs/mapa-sensorial.md).

The signature has **two producers and one contract**: `analyze-audio.py` measures the curated catalogue once, at curation time; `src/components/horizonte/ingest/` measures a listener's own record in the browser, during the session. Past `AlbumSignature`, the engine never asks where a record came from.

<br/>

## 🛠️ Engineering challenges

The hardest part was keeping the audio **physical rather than decorative**. It's trivial to make something pulse on the beat and it always looks cheap; the discipline was capping every audio-driven value at a ceiling the record itself sets and pushing the real differentiation offline into measured constants.

Two failures were worth the trouble of catching. Migrating media to a CDN silently breaks `getImageData` — a cross-origin cover taints the canvas, and the cover exposure equalisation (which is what makes dark sleeves visible in the ring) throws `SecurityError` instead of degrading. I proved the behaviour against a local CORS-enabled origin before the migration rather than after. The second: a single negative frame delta was enough to drive the exposure lerp to `-Infinity` and then `NaN`, permanently blacking out the world — one clamp on `dt`, found only by driving the loop manually.

The curation pipeline also had to be genuinely defensive. It verifies the licence at the source on every run and refuses to proceed on a mismatch, because the tempting failure mode is to relax the check to reach a target number of albums.

<br/>

## ℹ️ How to run the application?

> Clone the repository:

```bash
git clone https://github.com/maricastroc/horizonte
```

> Install the dependencies:

```bash
npm install
```

> Rename `.env.example` to `.env.local` and fill it in.

`NEXT_PUBLIC_MEDIA_BASE_URL` is optional. When set, media is fetched from that base (the production deploy uses Vercel Blob); unset, it is served from `public/music`. Three albums are versioned there; the others are rebuilt locally by the media pipeline (see below).

> Start the service:

```bash
npm run dev
```

> Run the tests:

```bash
npm test                # unit and DOM suites, as in CI
npm run test:corpus     # parity and envelope tests over the local corpus
npm run test:all        # both, in sequence
```

The corpus tests read the WAV cache that `analyze-audio.py` leaves in `.cache/analysis`; without it they skip themselves. In development, `/parity` runs the same comparison in the browser.

> Type-check and lint:

```bash
npm run typecheck
npm run lint
```

> ⏩ Access [http://localhost:3000](http://localhost:3000) to view the application.

### Documentation

- [`docs/mapa-sensorial.md`](docs/mapa-sensorial.md) — how each musical descriptor becomes a physical property, within which limits.
- [`docs/ingestao-local.md`](docs/ingestao-local.md) — the in-browser analysis of a listener's own record and its parity with the offline pipeline.
- [`docs/composicao-mobile.md`](docs/composicao-mobile.md) — the mobile composition and its guardrails.
- [`docs/idiomas.md`](docs/idiomas.md) — the two languages: detection, the dictionaries and how the anatomy is interpreted once and written twice.
- [`docs/anatomia-pt-en.md`](docs/anatomia-pt-en.md) — every anatomy question for the fourteen albums, side by side in both languages (generated by `npm run anatomy:report`).
- [`CURADORIA.md`](CURADORIA.md) — provenance, licences and credits of every album (generated by `fetch-curation.py`).

### Rebuilding the media pipeline

Requires Python 3 with NumPy and Pillow, plus `afconvert` (bundled with macOS).

```bash
python3 scripts/fetch-curation.py    # verify licences, fetch, transcode, extract inks
python3 scripts/analyze-audio.py     # measure the sensory signature of each album
python3 scripts/analyze-motion.py    # measure the motion signature of each track
npm run media:upload                 # publish public/music to Vercel Blob
```

`fetch-curation.py` can rebuild the albums whose sources allow automated download. Albums distributed only through a manual flow are staged from `.cache/manual/<album>/` and reported as pending instead of being silently skipped. `media:upload` is incremental and verifies Range, CORS and cache headers before finishing.

<br/>

## 📄 License

Released under the [MIT License](LICENSE). You're free to use, study, fork and build on this code — **as long as the original copyright and license notice are kept**. Reuse it and learn from it; don't strip the attribution and present it as your own.

The **music is not covered by this licence.** Every album in the curation is licensed by its own artist under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) or [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), and each one requires attribution on its own terms — see [`CURADORIA.md`](CURADORIA.md) for provenance, licences and the required credit for each work.

© 2025–2026 [**Mariana Castro**](https://marianacastro.dev) · [Live demo](https://horizonte.marianacastro.dev)

<br/>

<div align="center">

⭐ If you like this project, give it a star on GitHub!

</div>
