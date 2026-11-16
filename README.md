<p align="center"><img src="public/brand/97-mark-black.png" alt="THE 97" width="96"></p>

# 97 IMAGE GENERATOR
**Official AI Creative Studio by THE 97 World** — *Generate extraordinary. Design without limits.*

Describe → Upload references → Generate → Download. Powered by OpenAI **GPT Image 2.6 Sunburst** (`gpt-image-2.6-sunburst`), with **Flare** for fast drafts.

## What's inside
| Area | What you get |
|---|---|
| Studio | Big prompt box, drag/drop/paste references (up to 16), 6 presets, aspect ratios 1:1 · 4:5 · 9:16 · 16:9 · 3:2 · 2:3, Sunburst/Flare, **Enhance** prompt, saved prompts |
| Quality | Draft · Standard · High · Ultra · **Max** · Auto, complexity Low/Med/High, 1–4 images, Standard / High-res / 4K sizes |
| Editing | Edit any result, "Preserve everything else", before/after slider, official 97 logo as a reference |
| Library | History strip, favourites, projects, search, compare (slider or side-by-side), ZIP export |
| Exports | PNG / JPEG / WebP, optional **97 watermark** (auto white/black), originals never modified |
| Money | Estimate before every render, measured cost after, monthly budget + warning + hard stop |
| Security | Server-only API key, signed login cookie, protected endpoints, cross-site request blocking, login rate-limit |
| Reliability | Prompt + references auto-saved on your device, retry/cancel, jobs keep running if you leave the page |
| Brand | Real `97.png` everywhere (preloader, nav, login, favicon, exports) — never redrawn |

## Run it on your computer (2 minutes)
```bash
npm install
cp .env.example .env     # then edit .env
npm run dev              # open http://localhost:3000
```
With no `OPENAI_API_KEY` the app runs in **Demo mode** (free placeholder images) so you can explore everything. Dev login if you set nothing: `demo@the97.world` / `97demo`.

## Environment variables
| Name | Required | Meaning |
|---|---|---|
| `OPENAI_API_KEY` | for real images | Secret key from platform.openai.com. **Server only.** |
| `APP_USERS` | **yes** (production) | `email:password;email2:password2` — who may sign in |
| `SESSION_SECRET` | **yes** (production) | 32+ random characters (`openssl rand -hex 32`) |
| `DATA_DIR` | recommended | Where images + data live. Use a persistent volume on a host (e.g. `/data`) |
| `MONTHLY_BUDGET_USD` | no | Default monthly limit (default 5) |
| `OPENAI_PROMPT_MODEL` | no | Text model for "Enhance" (falls back to a built-in enhancer) |
| `MOCK_OPENAI` | no | `1` forces Demo mode even with a key |
| `PRICE_TEXT_IN` / `PRICE_IMAGE_IN` / `PRICE_IMAGE_OUT` | no | Override rates (USD per 1M tokens) if OpenAI changes pricing |

## Put it online (Railway — simplest)
> This app needs a **normal always-on server with a disk**. Do **not** use Vercel/Netlify (serverless: no persistent disk, and renders run in the background).

1. Push this repo to GitHub (see below).
2. **railway.com** → New Project → **Deploy from GitHub repo** → pick this repo.
3. **Variables**: add `OPENAI_API_KEY`, `APP_USERS`, `SESSION_SECRET`, and `DATA_DIR=/data`.
4. **Volumes**: add a volume mounted at `/data` (this is where your images live — without it they vanish on redeploy).
5. **Settings → Networking → Generate Domain**, test it, then **Custom Domain** → `images.the97.world` and add the CNAME Railway shows at your DNS provider.

Docker works anywhere: `docker build -t 97ig . && docker run -p 3000:3000 -v 97data:/data --env-file .env 97ig`

## Upload to GitHub
```bash
git remote add origin https://github.com/<you>/97-image-generator.git
git push -u origin main
```
(Create the empty repo first on github.com → New → name it → **Private** → don't add a README.) `.env` and `data/` are git-ignored — your key and images never get uploaded.

## OpenAI billing
See [docs/OPENAI_SETUP.md](docs/OPENAI_SETUP.md) — how to add $5, create the key, and what to do if OpenAI asks to verify the organization.

## How costs are shown (honest version)
* Before a render: an **estimate**. OpenAI doesn't publish a fixed per-image price for 2.6, so the app starts from a conservative guess and **calibrates itself** from the real token usage of your first images.
* After a render: the **measured** cost from OpenAI's reported usage × official rates ($5 text-in, $8 image-in, $30 image-out per 1M tokens).
* "Tracked spend" ≠ your OpenAI balance. The live balance is only at platform.openai.com → Billing.

## Test without spending
```bash
npm run fake-openai                                    # pretend OpenAI on :4010
OPENAI_API_KEY=sk-test OPENAI_BASE_URL=http://localhost:4010 npm run dev
```

## Project map
```
src/app/(app)/…      Studio, Gallery, Compare, Account, Settings pages
src/app/api/…        Protected endpoints (generate, images, uploads, projects, usage, export…)
src/lib/openai.ts    The only place that talks to OpenAI
src/lib/jobs.ts      Background render jobs, budget guard, cancel
src/lib/store.ts     JSON-file database per user (swap for Postgres later)
src/lib/sizes.ts     Aspect → valid OpenAI sizes
public/brand/        Real 97 logo files (97.png = untouched original)
```

## Roadmap (Phase 2+)
Advanced typography/layout composition · precise brand-asset placement · markup-guided edits (circle/arrow on image) · GIF & SVG output · multi-user teams on Postgres + S3 · Stripe/credits for clients.

© THE 97 World. All rights reserved.
