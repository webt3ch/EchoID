# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Listeners who want to identify a song quickly while hearing it, either from their surroundings or from an audio file they choose.

## Product Purpose

EchoID identifies music from a short microphone recording or an uploaded audio file, then presents the track details and listening links available from the recognition provider. It also lets listeners keep a small, device-local record of discoveries. Success means users can identify a track quickly and understand when recognition is unavailable, inconclusive, or still needs provider configuration.

## Positioning

EchoID is an early music-recognition MVP inspired by Shazam. Its current recognition mechanism sends a short audio sample to AudD's standard recognition API. A distinct market position has not been defined yet.

## Operating Context

People use EchoID in a web browser when they want to identify a song. They can explicitly start a microphone recording or choose an audio file. The browser sends the sample to EchoID's server route, which forwards it to AudD. Track history and preferences stay in that browser's local storage and are not tied to an online account.

## Capabilities and Constraints

- The app is built with Next.js, React, and TypeScript.
- Microphone recordings are limited to about 12 seconds. Uploaded audio files are limited to 4 MB.
- AudD recognition requires the server-side `AUDD_API_TOKEN`; the token must never be exposed to client-side code.
- EchoID does not intentionally store submitted audio. AudD processes the sample under its own current terms and privacy policy.
- AudD's standard endpoint analyzes about the first 12 seconds of a request; available metadata and service links depend on the provider response.
- Recent discoveries, saved tracks, display name, and appearance preference are stored locally in the browser. History is limited to 30 recent unique discoveries. There is no account, remote database, or cross-device sync.
- Lyrics, Hum, and Describe are placeholders, not working search or recognition features.
- Recognition has not been verified with a configured live AudD token in the current development environment.

## Brand Commitments

The product name is EchoID. The project document names Shazam as an inspiration. No distinct positioning or other binding brand commitments have been established.

## Evidence on Hand

- The current implementation and setup notes in `README.md` describe the available microphone, upload, AudD, and local-library flows.
- The project document supplied by the owner describes future ideas such as accounts, synchronization, lyric or humming search, continuous listening, and recommendations. These are proposals, not existing features or commitments.
- No user research, customer testimonials, market validation, or live-provider recognition results are available in the repository. Do not imply that these have been verified.

## Product Principles

- Help listeners get from a short sample to a useful track identity quickly.
- Make microphone use and external audio processing explicit and user initiated.
- Keep locally stored history and settings understandable and under the user's control.
- Distinguish working features from ideas and placeholders.
- Be clear when results depend on AudD configuration, metadata availability, or provider limits.
