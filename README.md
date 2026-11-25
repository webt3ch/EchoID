# EchoID

EchoID is a music discovery experience designed to identify songs by audio, lyrics, humming, and natural-language descriptions.

## Development roadmap

The project is intentionally developed in two phases:

1. **Frontend:** complete responsive product UI, navigation, search modes, library, history, settings, and interaction states.
2. **Recognition backend:** audio fingerprinting, lyric and semantic search, humming recognition, music analysis, accounts, persistence, and external music metadata.

The current interface uses clearly labeled placeholder states for recognition services that are not connected yet.

## Stack

- Next.js + React + TypeScript
- CSS design system
- FastAPI planned for recognition APIs
- PostgreSQL / Supabase planned for persistence

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Current frontend

- Responsive discovery screen
- Four search modes: sound, lyrics, humming, and description
- Audio file selection UI
- Guest library empty state
- Accessible status messages and reduced-motion support

Recognition, authentication, history persistence, and provider integrations are planned for phase two.
