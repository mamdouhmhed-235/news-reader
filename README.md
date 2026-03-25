# News Reader

A modern, performant news reader with category filtering, search, themes, and infinite scroll — powered by [TheNewsApi](https://www.thenewsapi.com/).

## Features

- **Category browsing** — Tech, Science, Sports, Business, Health, Entertainment, Politics, Food, Travel, General
- **Keyword search** — Debounced live search with instant results
- **Two view modes** — Pager (single-article navigation) or Feed (infinite scroll with Load More)
- **Multiple themes** — Dark, Light, Ocean, Forest — persisted to localStorage
- **Personalized feed** — Pin favorite categories to "My Feed"
- **Reader view** — Clean, distraction-free article reading modal
- **Favorites** — Save articles to localStorage, accessible from sidebar
- **Server-side caching** — 5-minute TTL cache, avoids redundant API calls
- **Rate limiting** — 30 requests/minute per IP on the proxy
- **Retry with backoff** — Automatic retries on upstream failures
- **Offline detection** — Banner shown when network is unavailable
- **Accessibility** — ARIA labels, keyboard navigation, skip-to-content, focus-visible styles
- **Responsive** — Desktop sidebar layout, mobile slide-out drawer
- **Image lazy loading** — Native `loading="lazy"` with fallback on error

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | React 18, TypeScript, Vite |
| Backend | Node.js, Express |
| API | TheNewsApi (All News endpoint) |
| Styling | Plain CSS with custom properties (themes) |
| State | React hooks + localStorage |

## Project Structure

```
news-reader/
├── server/
│   ├── server.js          # Express proxy (port 5177)
│   ├── package.json
│   └── .env.example       # THENEWSAPI_TOKEN placeholder
├── web/
│   ├── src/
│   │   ├── App.tsx                # Main app state & layout
│   │   ├── styles.css             # All styles + theme variables
│   │   ├── components/
│   │   │   ├── HeadlinesList.tsx  # Article card, pager, feed nav
│   │   │   └── ReaderView.tsx     # Reader modal
│   │   └── lib/
│   │       ├── newsapi.ts         # Typed API client
│   │       ├── themes.ts          # Theme definitions
│   │       └── useDebounce.ts     # Debounce hook
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── index.html
├── package.json           # Root scripts
├── .gitignore
├── .env.example
└── vercel.json            # Vercel deployment config
```

## Getting Started

### Prerequisites

- Node.js 16+
- A [TheNewsApi](https://www.thenewsapi.com/) API token (free tier available)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/mamdouhmhed-235/news-reader.git
cd news-reader

# 2. Install server dependencies
npm run server:install

# 3. Configure your API token
cp server/.env.example server/.env
# Edit server/.env and set THENEWSAPI_TOKEN=your_token_here

# 4. Run both servers
npm run dev
```

- **Web app**: http://localhost:5176
- **API proxy**: http://localhost:5177

## Deployment (Vercel)

This project is configured for Vercel deployment. The `vercel.json` routes API calls through the Express server and serves the Vite frontend.

### Deploy steps

1. Push your repo to GitHub
2. Import the project in [Vercel](https://vercel.com/)
3. Set the environment variable `THENEWSAPI_TOKEN` in Vercel project settings
4. Vercel will auto-detect the build and deploy

### Environment Variables

| Variable | Description |
|----------|-------------|
| `THENEWSAPI_TOKEN` | Your TheNewsApi API token |

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Run both frontend and backend |
| `npm run server:dev` | Run Express proxy only |
| `npm run web:dev` | Run Vite dev server only |
| `npm run server:install` | Install server dependencies |

## API

The Express proxy exposes:

- `GET /api/health` — Health check
- `GET /api/news/all` — Proxied TheNewsApi request
  - Query params: `page`, `categories`, `search`
  - Always sends `language=en`, `limit=3`

## License

MIT
