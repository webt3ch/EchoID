# EchoID

EchoID is a music-discovery frontend concept for identifying songs by sound, lyrics, humming, or natural-language descriptions. It is built as a polished, responsive product interface and is intentionally split into two development phases.

## Phase 1 — Frontend

- Responsive dark interface with an original blue-violet visual identity
- Discover screen with sound, lyric, humming, and description search modes
- Audio file selection UI
- Demo match results with save/unsave interactions
- Personal library, local history, settings, and guest profile screens
- Appearance, privacy preference, language, and local-data controls
- Clear demo labels where recognition services are not connected

The current version uses illustrative demo results. It does **not** perform live audio recognition, create real accounts, or persist data to a server.

## Phase 2 — Recognition and backend

Planned: audio fingerprinting, lyric and semantic search, humming recognition, conversational search, music analysis, authentication, database persistence, and provider integrations.

## Stack

- Next.js, React, TypeScript
- CSS design system and Lucide icons
- FastAPI planned for recognition APIs
- PostgreSQL / Supabase planned for persistence

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.
