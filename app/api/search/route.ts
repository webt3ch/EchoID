import { NextResponse } from "next/server";

export const runtime = "nodejs";

type CatalogTrack = {
  title: string; artist: string; album: string; artworkUrl?: string; songLink?: string;
  releaseDate?: string; genre?: string; trackId?: number; artistId?: number; artistUrl?: string;
  trackTimeMillis?: number; lyricSnippet?: string; source: "LRCLIB" | "Apple Music";
};
type ITunesTrack = {
  trackName?: string; artistName?: string; collectionName?: string; artworkUrl100?: string;
  trackViewUrl?: string; artistViewUrl?: string; releaseDate?: string; primaryGenreName?: string;
  trackId?: number; artistId?: number; trackTimeMillis?: number;
};
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const moodTerms: Array<{ keys: string[]; terms: string[] }> = [
  { keys: ["dreamy", "dream", "sognante", "etereo", "ethereal"], terms: ["dream pop ambient", "shoegaze indie"] },
  { keys: ["energetic", "energia", "energico", "workout", "palestra"], terms: ["dance pop electronic", "uptempo house"] },
  { keys: ["melancholic", "malinconico", "triste", "sad"], terms: ["indie melancholic", "alternative sad"] },
  { keys: ["elegant", "elegante", "chic", "fashion", "boutique"], terms: ["deep house lounge", "nu disco"] },
  { keys: ["relax", "relaxing", "calm", "calmo", "rilassante", "chill"], terms: ["chillout downtempo", "ambient electronic"] },
  { keys: ["nostalgic", "nostalgico", "nostalgia"], terms: ["synthwave retro", "80s pop"] },
  { keys: ["romantic", "romantico", "love", "amore"], terms: ["soul romantic", "romantic pop"] },
  { keys: ["dark", "scuro", "moody", "notturno", "night"], terms: ["dark electronic", "trip hop"] },
  { keys: ["party", "festa", "club", "discoteca"], terms: ["club house dance", "tech house"] },
  { keys: ["cinematic", "cinematico", "epic", "epico"], terms: ["cinematic soundtrack", "orchestral electronic"] },
  { keys: ["house"], terms: ["house music", "deep house"] },
  { keys: ["garage", "speed garage"], terms: ["speed garage", "UK garage"] },
];
function expandCatalogQueries(query: string, mode: string): string[] {
  const normalized = query.toLowerCase();
  const terms = [query];
  for (const group of moodTerms) if (group.keys.some((key) => normalized.includes(key))) terms.push(...group.terms);
  if (mode === "recommend") terms.push(query + " similar artists");
  return Array.from(new Set(terms)).slice(0, 4);
}
function lyricPreview(plainLyrics: string | undefined, syncedLyrics: string | undefined, query: string): string | undefined {
  const lyrics = plainLyrics || (syncedLyrics || "").replace(/^\[[0-9:.]+\]\s?/gm, "");
  if (!lyrics) return undefined;
  const words = query.toLowerCase().split(/\s+/).filter((word) => word.length > 3);
  const lines = lyrics.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const match = lines.find((line) => words.some((word) => line.toLowerCase().includes(word))) || lines[0];
  if (!match) return undefined;
  return match.length > 80 ? match.slice(0, 77) + "…" : match;
}
function mapCatalogTrack(item: ITunesTrack): CatalogTrack {
  return {
    title: item.trackName || "Unknown title", artist: item.artistName || "Unknown artist",
    album: item.collectionName || "", artworkUrl: item.artworkUrl100?.replace("100x100bb", "600x600bb"),
    songLink: item.trackViewUrl, artistUrl: item.artistViewUrl, releaseDate: item.releaseDate?.slice(0, 10),
    genre: item.primaryGenreName, trackId: item.trackId, artistId: item.artistId,
    trackTimeMillis: item.trackTimeMillis, source: "Apple Music",
  };
}
function relevance(track: CatalogTrack, query: string): number {
  const tokens = query.toLowerCase().split(/[^a-z0-9à-ÿ]+/i).filter((word) => word.length > 2);
  const haystack = [track.title, track.artist, track.album, track.genre].join(" ").toLowerCase();
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}
async function searchApple(term: string): Promise<ITunesTrack[]> {
  const response = await fetch("https://itunes.apple.com/search?media=music&entity=song&limit=20&country=IT&term=" + encodeURIComponent(term), { cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("Apple Music catalog unavailable");
  const data = await response.json() as { results?: ITunesTrack[] };
  return data.results || [];
}
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  const query = (url.searchParams.get("q") || "").trim();
  if (!["lyrics", "describe", "mood", "recommend"].includes(mode || "")) return json({ error: "invalid_mode", message: "Choose lyrics, describe, mood, or recommend search." }, 400);
  if (query.length < 3 || query.length > 300) return json({ error: "invalid_query", message: "Enter between 3 and 300 characters." }, 400);
  try {
    if (mode === "lyrics") {
      const response = await fetch("https://lrclib.net/api/search?q=" + encodeURIComponent(query), {
        headers: { "User-Agent": "EchoID/2.0 (music discovery app)" }, cache: "no-store", signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) return json({ error: "search_unavailable", message: "Lyrics search is temporarily unavailable." }, 502);
      const data = await response.json() as Array<{ trackName?: string; artistName?: string; albumName?: string; plainLyrics?: string; syncedLyrics?: string }>;
      const tracks: CatalogTrack[] = data.slice(0, 12).map((item) => ({
        title: item.trackName || "Unknown title", artist: item.artistName || "Unknown artist",
        album: item.albumName || "", lyricSnippet: lyricPreview(item.plainLyrics, item.syncedLyrics, query), source: "LRCLIB",
      }));
      return json({ tracks, searchMode: "lyrics-catalog" });
    }
    const terms = expandCatalogQueries(query, mode || "describe");
    const responses = await Promise.all(terms.map((term) => searchApple(term)));
    const unique = new Map<string, CatalogTrack>();
    for (const item of responses.flat()) {
      const track = mapCatalogTrack(item);
      const key = String(track.trackId ?? (track.title + "|" + track.artist).toLowerCase());
      if (!unique.has(key)) unique.set(key, track);
    }
    const tracks = Array.from(unique.values()).sort((a, b) => relevance(b, query) - relevance(a, query)).slice(0, mode === "mood" ? 24 : 16);
    return json({
      tracks,
      searchMode: mode === "mood" ? "mood-catalog-expansion" : mode === "recommend" ? "catalog-recommendations" : "apple-catalog",
      note: mode === "mood" ? "Mood search expands common mood, genre, and instrument descriptors into Apple Music catalog searches. It does not use an AI embedding model." : undefined,
    });
  } catch {
    return json({ error: "search_unavailable", message: "Search could not complete. Please try again." }, 502);
  }
}
