# EchoID

EchoID is a responsive music-discovery web app. It can identify a song from a short recording made with the device microphone or from an uploaded audio clip.

## Live audio recognition

The **Sound** workflow is connected to the [AudD Music Recognition API](https://docs.audd.io/):

- Record up to 12 seconds from the microphone, or upload an audio file.
- Supported uploads must use an `audio/*` MIME type and be no larger than 10 MB.
- The server forwards the clip to AudD using a private API token.
- A successful match displays the track title, artist, album, release year, cover artwork, and available Spotify / Apple Music / Deezer links.
- Identified tracks can be saved to the local library; the discovery history and preferences persist in the current browser.

AudD's standard recognition endpoint analyses up to the first 12 seconds of audio. Longer uploads are accepted within the 10 MB file limit, but only the initial sample is used for standard recognition.

**Privacy:** when the user explicitly starts a recording or selects a file, EchoID sends that audio to AudD for identification. EchoID does not write the audio file to its own database or filesystem. Saved tracks, history, and guest profile fields are stored in browser `localStorage`; they are not synced to an account or another device. Review the provider's own privacy terms before using the service.

Lyrics and Describe search are connected to external catalogs: Lyrics uses LRCLIB search, while Describe uses Apple Music catalog text search. Describe is keyword/catalog search, not semantic AI matching. Hum records a short sample and sends it through the existing AudD recognition route; AudD is designed for recorded music, so humming recognition is experimental and not guaranteed.

## Cloud accounts and library sync (optional)

EchoID supports Supabase email/password accounts and explicit cloud library sync. Configure these public project settings in .env.local and in the deployment environment:

    NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

Then run the SQL in supabase/schema.sql in the Supabase SQL Editor. The table uses row-level security so authenticated users can access only the row whose user_id matches their account. Enable Email authentication in Supabase Auth. Email confirmation may require verification before sign-in.

In EchoID's Account page, create an account or sign in, then use Sync library now to upload saved tracks and history. Load cloud library replaces the current local saved tracks and history with the cloud copy. Sync is user-triggered, not automatic or real-time. Signing out leaves the browser's local library intact.

The Supabase anon key is designed to be public; never place a service-role key in browser variables or client code. The current client stores the auth session in browser localStorage, so protect the app against XSS and use a strong unique password. Cloud sync requires your own Supabase project and has not been end-to-end tested without its project credentials.

## Configure AudD

1. Create an account and obtain an API token from the [AudD dashboard](https://dashboard.audd.io/). New accounts may be offered a limited trial; availability and terms are determined by AudD.
2. Copy `.env.example` to `.env.local`.
3. Set the server-only environment variable:

   ```env
   AUDD_API_TOKEN=your_real_token_here
   ```

4. Restart the development server.

Never expose the token in client-side code or name it `NEXT_PUBLIC_AUDD_API_TOKEN`.

For Vercel, open the project's **Settings → Environment Variables**, add `AUDD_API_TOKEN` for the required environments, and redeploy.

## API

### `GET /api/recognize`

Returns the provider name and a boolean `configured` status. It never returns the token.

### `POST /api/recognize`

Accepts `multipart/form-data` with one `audio` file field. Validates the file, forwards it to AudD, and returns either a normalized track object or a clear no-match / error response.

The API applies a 10 MB file limit and a 20-second upstream timeout. Provider credentials remain on the server. Uploaded audio is not persisted by this route.

## Stack

- Next.js 15, React 19, TypeScript
- Responsive CSS interface and Lucide icons
- AudD standard music-recognition API
- Browser MediaRecorder and localStorage for microphone capture and local library state

## Run locally

```bash
npm install
cp .env.example .env.local
# Add your AUDD_API_TOKEN to .env.local
npm run dev
```

Open http://localhost:3000.

## Quality checks

```bash
npm run lint
npm run build
```

The GitHub Actions workflow runs the production build on pushes and pull requests targeting `main`.


## EchoID V2 roadmap implementation

The V2 product surfaces include:
- **Intelligence:** mood/descriptor catalog expansion, Song DNA from verified Apple catalog fields, and catalog-based related-track discovery.
- **Smart Library:** local playlists, Supabase playlist snapshot sync, and public share links.
- **Public identity:** owner-controlled public profiles and published collections protected by Supabase Row Level Security.
- **Hum 2.0 beta:** browser-side monophonic pitch contour extraction. It does not upload microphone audio and does not yet identify a commercial track; that requires a licensed/searchable melody fingerprint corpus.
- **Statistics:** local discovery, artist, genre and timeline summaries. Timeline counts apply only to history items created with timestamps.
- **PWA:** web app manifest, SVG app icon and a conservative service worker app-shell cache.
- **Internationalization:** English, Italian and Spanish translations for the primary navigation and discovery interface.

### V2 database setup
Run the SQL in supabase/schema.sql in the Supabase SQL Editor. It adds the playlists field to the library table and creates echoid_profiles and echoid_public_playlists, with owner-scoped write policies and public read policies only for content marked public.

### Catalog data limitations
The public iTunes Search/Lookup catalog provides fields such as artist, album, genre, artwork, release date, track duration and catalog URLs. It does not provide reliable BPM, musical key, energy or danceability fields. EchoID displays these as unavailable rather than estimating them. Mood Search currently expands recognized mood/genre descriptors into catalog queries; it is not an LLM or vector-embedding search service.

### External configuration
- NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required for account sync, profile publishing and public playlist publishing.
- AUDD_API_TOKEN is required for recorded-audio fingerprint recognition. Hum 2.0 pitch analysis is local and does not depend on AudD.
- Public profiles and playlist sharing require Email/password sign-in and the V2 SQL schema. Users choose whether a profile is public; playlist links are public snapshots.
