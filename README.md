# EchoID

EchoID identifies music from a short microphone recording or an audio file. It uses the AudD standard recognition API and keeps a small song library in the current browser.

## What works

- Record up to 12 seconds after choosing **Sound** and starting the microphone.
- Upload an `audio/*` file up to 4 MB.
- See the recognized track, available cover art, release details, and provider links.
- Save tracks to the local library and review or clear the last 30 unique discoveries.
- Use the app on desktop and mobile, including the five-section mobile navigation.
- Set the local display name and choose dark or light appearance.
- Lyrics, Hum, and Describe are labeled placeholders. They are not connected to search services and do not return sample results.

AudD's standard endpoint analyzes about the first 12 seconds of a request. Longer uploads are accepted up to EchoID's file-size limit, but the standard endpoint does not analyze the whole track.

## Audio and local data

EchoID requests microphone access only after the user starts recording. When a recording or file is submitted, EchoID sends it to the server route, which forwards it to AudD. EchoID does not save the audio file to its own database or filesystem. AudD processes the submitted sample under its current terms and privacy policy.

Saved tracks, up to 30 recent discoveries, the optional display name, and appearance preference use browser `localStorage`. They are not connected to an account and are not synced to another device. The Settings page can clear saved songs, history, and the display name; clearing browser site data removes all local settings too.

See **Settings → How audio and local data are handled** in the app. Also review the current [AudD API documentation](https://docs.audd.io/), [privacy policy](https://audd.io/privacy/index.php), and [API terms](https://audd.io/legal/terms/). AudD's terms put responsibility on the customer to have the rights and permissions needed to submit audio.

## Requirements

- Node.js 22
- npm
- An AudD API token for live recognition

## Run locally

```bash
npm ci
cp .env.example .env.local
```

Add the token to `.env.local`:

```env
AUDD_API_TOKEN=your_real_token_here
```

Start the app:

```bash
npm run dev
```

Open http://localhost:3000. Microphone access requires HTTPS or `localhost`.

Never put the token in client-side code or a `NEXT_PUBLIC_` variable. The `GET /api/recognize` status endpoint returns only whether the token is configured.

## API

### `GET /api/recognize`

Returns the provider name and whether the server has an AudD token. It never returns the token.

### `POST /api/recognize`

Accepts `multipart/form-data` with one `audio` file field. It validates the MIME type and size, forwards the sample to AudD, and returns normalized track metadata or a clear no-match/error response. The route has a 20-second upstream timeout and does not write the audio to storage or log its contents.

EchoID's 4 MB file cap leaves room for multipart form data under Vercel's default 4.5 MB function request-body limit. If a deployment changes the platform limit, change the client and server limits together and test the deployed route before increasing it.

## Deploy

For a Vercel deployment:

1. Add `AUDD_API_TOKEN` under **Project Settings → Environment Variables** for each environment that should recognize music.
2. Redeploy after setting or rotating the variable.
3. Confirm `/api/recognize` reports `configured: true` without returning the token.
4. Test a real short clip, a no-match sample, an invalid file, and an oversized file over HTTPS.
5. Review AudD's current plan, usage limits, privacy policy, and API terms before opening the service to external users.

Without `AUDD_API_TOKEN`, the recognition controls are unavailable and the rest of the local library remains usable.

## Quality checks

```bash
npm run lint
npm run build
```

GitHub Actions runs both checks for pushes and pull requests targeting `main`.
