# Offliner 💾

**Take any website offline.** Mirror a complete site — every page, stylesheet, script, font and image — and get it back as a single, ready-to-open ZIP. No account, no limits.

![Offliner demo](public/<img width="1280" height="820" alt="website-downloader-screenshot" src="https://github.com/user-attachments/assets/9d4fd8f6-22b7-4821-acd0-f4b6013950e9" />
)

> Built on a finely-tuned `wget` mirror + `archiver`, with a live progress console streamed over Socket.io and an immersive three.js / GSAP frontend.

---

## ✨ Features

- **Pixel-perfect copies** — page requisites (CSS, JS, fonts, images) are pulled down so the offline copy looks identical to the original.
- **Links rewritten for offline** — every reference is converted to a relative path, so navigation keeps working from any folder on your machine.
- **Live mirror console** — real `wget` output streamed to the browser in real time: files counted, progress tracked, elapsed time.
- **Resumable & resilient** — drop your connection and the crawl keeps running server-side, picking up where it left off on reconnect.
- **One tidy ZIP** — everything is compressed and handed back as a single archive. Unzip, open `index.html`, browse fully offline.
- **Immersive UI** — glassmorphic interface with a three.js atmospheric background and GSAP motion (with a full `prefers-reduced-motion` fallback).

## 🛠 How it works

Offliner shells out to `wget` to recursively mirror the target site, streams progress back through a Socket.io channel, then zips the result with `archiver` and hands it to you.

```
wget --mirror --convert-links --adjust-extension --page-requisites --no-parent <url>
```

| Flag | What it does |
| --- | --- |
| `--mirror` | Makes the download recursive (follows the whole tree). |
| `--convert-links` | Converts links (incl. CSS references) to relative paths for offline viewing. |
| `--adjust-extension` | Adds suitable extensions (`.html` / `.css`) based on content-type. |
| `--page-requisites` | Downloads CSS, JS, images and other assets needed to render the page. |
| `--no-parent` | When recursing, doesn't ascend above the start directory. |

## 🚀 Quick start

> **Requires [`wget`](https://www.gnu.org/software/wget/) on the host.** It ships with most Linux distros; install via Homebrew on macOS (`brew install wget`) or use the Docker image below.

```bash
git clone https://github.com/krisadaza4/Website-downloader.git
cd Website-downloader
npm install
npm start
# open http://localhost:3000
```

### Docker

```bash
docker build -t offliner .
docker run -p 3000:3000 offliner
```

The image is Debian-based and installs `wget` for you. See [`Dockerfile`](Dockerfile).

## ☁️ Deploy on cloud providers

One-click deploys to your own private instance (`render.yaml` + `Dockerfile` are included):

[![Run on Replit](https://binbashbanana.github.io/deploy-buttons/buttons/remade/replit.svg)](https://replit.com/github/krisadaza4/Website-downloader)
[![Remix on Glitch](https://binbashbanana.github.io/deploy-buttons/buttons/remade/glitch.svg)](https://glitch.com/edit/#!/import/github/krisadaza4/Website-downloader)
[![Deploy on Railway](https://binbashbanana.github.io/deploy-buttons/buttons/remade/railway.svg)](https://railway.app/new/template?template=https://github.com/krisadaza4/Website-downloader)
[![Deploy to Koyeb](https://binbashbanana.github.io/deploy-buttons/buttons/remade/koyeb.svg)](https://app.koyeb.com/deploy?type=git&repository=github.com/krisadaza4/Website-downloader&branch=master&name=offliner)
[![Deploy to Render](https://binbashbanana.github.io/deploy-buttons/buttons/remade/render.svg)](https://render.com/deploy?repo=https://github.com/krisadaza4/Website-downloader)

> Offliner needs a persistent host that can run `wget` — it is **not** serverless-compatible.

## 🧱 Tech stack

- **Backend:** Node.js, Express, Socket.io, `wget`, `archiver`, `hbs`
- **Frontend:** three.js (shader background), GSAP + ScrollTrigger (motion), vanilla JS, CSS glassmorphism

## 🤝 Contributing

- Open an issue for any bug you notice.
- PRs welcome if you think they'd add value.

## 📄 License & credits

Released under the [MIT License](LICENSE.md).

Forked from and built upon [**AhmadIbrahiim/Website-downloader**](https://github.com/AhmadIbrahiim/Website-downloader) — huge thanks to the original author. If this project helped you, consider [buying the original author a coffee ☕](https://www.buymeacoffee.com/aibrahim).
