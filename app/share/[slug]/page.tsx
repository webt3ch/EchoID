import Link from "next/link";
import { AudioLines, Music2 } from "lucide-react";

type Track = { title?: string; artist?: string; album?: string; artworkUrl?: string; songLink?: string; genre?: string };
type PublicPlaylist = { name: string; description?: string; tracks?: Track[] };

export const dynamic = "force-dynamic";

async function getPlaylist(slug: string): Promise<PublicPlaylist | null> {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!base || !key) return null;
  const url = base + "/rest/v1/echoid_public_playlists?select=name,description,tracks&slug=eq." + encodeURIComponent(slug) + "&is_public=eq.true&limit=1";
  const response = await fetch(url, { headers: { apikey: key }, cache: "no-store" });
  if (!response.ok) return null;
  const rows = await response.json() as PublicPlaylist[];
  return rows[0] ?? null;
}

export default async function SharedPlaylistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const playlist = await getPlaylist(slug);
  return (
    <main className="public-page">
      <header className="public-header"><Link className="brand" href="/"><span className="brand-mark"><AudioLines size={21} /></span><span>echo<span className="brand-light">id</span></span></Link><span>SHARED COLLECTION</span></header>
      <section className="public-content">
        {playlist ? <>
          <div className="eyebrow"><span /> ECHOID COMMUNITY</div>
          <h1>{playlist.name}</h1>
          <p>{playlist.description || "A playlist shared with EchoID."}</p>
          <div className="result-list">{(playlist.tracks || []).map((track, index) => <article className="result-row" key={(track.title || "untitled") + (track.artist || "unknown") + index}>
            <div className="cover">{track.artworkUrl ? <img src={track.artworkUrl} alt="" /> : <Music2 size={21} />}</div>
            <div className="song-meta"><strong>{track.title || "Untitled"}</strong><span>{track.artist || "Unknown artist"}{track.album ? " · " + track.album : ""}</span></div>
            {track.songLink?.startsWith("https://") && <a className="text-link" href={track.songLink} target="_blank" rel="noreferrer">Open <span>↗</span></a>}
          </article>)}</div>
          <p className="privacy-note">This public playlist is a snapshot shared by its owner. Changes to the original collection may not update this link.</p>
        </> : <div className="empty-state"><Music2 size={30} /><h2>Playlist unavailable</h2><p>The link may be invalid, private or no longer published.</p></div>}
        <Link className="primary-button" href="/">Discover music with EchoID</Link>
      </section>
    </main>
  );
}
