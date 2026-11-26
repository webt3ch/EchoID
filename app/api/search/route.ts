import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SearchTrack = {
  title: string;
  artist: string;
  album: string;
  artworkUrl?: string;
  songLink?: string;
  releaseDate?: string;
  source: "LRCLIB" | "Apple Music";
};

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  const query = (url.searchParams.get("q") ?? "").trim();

  if (!["lyrics", "describe"].includes(mode ?? "")) {
    return json({ error: "invalid_mode", message: "Choose lyrics or describe search." }, 400);
  }
  if (query.length < 3 || query.length > 300) {
    return json({ error: "invalid_query", message: "Enter between 3 and 300 characters." }, 400);
  }

  try {
    let tracks: SearchTrack[] = [];
    if (mode === "lyrics") {
      const response = await fetch(
        "https://lrclib.net/api/search?q=" + encodeURIComponent(query),
        { headers: { "User-Agent": "EchoID/1.0 (music discovery app)" }, cache: "no-store", signal: AbortSignal.timeout(12_000) },
      );
      if (!response.ok) return json({ error: "search_unavailable", message: "Lyrics search is temporarily unavailable." }, 502);
      const data = (await response.json()) as Array<{ trackName?: string; artistName?: string; albumName?: string }>;
      tracks = data.slice(0, 8).map((item) => ({
        title: item.trackName || "Unknown title",
        artist: item.artistName || "Unknown artist",
        album: item.albumName || "",
        source: "LRCLIB",
      }));
    } else {
      const response = await fetch(
        "https://itunes.apple.com/search?media=music&entity=song&limit=8&term=" + encodeURIComponent(query),
        { cache: "no-store", signal: AbortSignal.timeout(12_000) },
      );
      if (!response.ok) return json({ error: "search_unavailable", message: "Music search is temporarily unavailable." }, 502);
      const data = (await response.json()) as { results?: Array<{ trackName?: string; artistName?: string; collectionName?: string; artworkUrl100?: string; trackViewUrl?: string; releaseDate?: string }> };
      tracks = (data.results ?? []).map((item) => ({
        title: item.trackName || "Unknown title",
        artist: item.artistName || "Unknown artist",
        album: item.collectionName || "",
        artworkUrl: item.artworkUrl100,
        songLink: item.trackViewUrl,
        releaseDate: item.releaseDate?.slice(0, 10),
        source: "Apple Music",
      }));
    }
    return json({ tracks });
  } catch {
    return json({ error: "search_unavailable", message: "Search could not complete. Please try again." }, 502);
  }
}
