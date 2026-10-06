# Spudsizer website

- `docs/` – the website (GitHub Pages publishes this folder)
  - `index.html` – the page content
  - `assets/css/site.css` – styling
  - `assets/js/site.js` – sign-up form (fill in WORKER_URL and TURNSTILE_SITE_KEY at the top)
  - `assets/img/` – images (WebP)
- `worker/` – Cloudflare Worker that checks the bot test and emails leads
- `tools/convert-images-to-webp.py` – run from inside `docs/` after adding new JPG/PNG images

Small text change? Edit `docs/index.html`, commit, push. Live in about a minute.
