import Link from "next/link";
import { AudioLines, Music2 } from "lucide-react";

type CatalogItem = { wrapperType?: string; artistName?: string; trackName?: string; collectionName?: string; primaryGenreName?: string; artworkUrl100?: string; trackViewUrl?: string; releaseDate?: string };
type ArtistResult = { artistName?: string; primaryGenreName?: string; artistLinkUrl?: string };

export const dynamic = "force-dynamic";

async function getArtist(id: string): Promise<{ artist: ArtistResult | null; tracks: CatalogItem[] }> {
  const response = await fetch("https://itunes.apple.com/lookup?id=" + encodeURIComponent(id) + "&entity=song&limit=25&country=IT", { cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!response.ok) return { artist: null, tracks: [] };
  const data = await response.json() as { results?: Array<ArtistResult & CatalogItem> };
  const results = data.results || [];
  const artist = results.find((item) => item.wrapperType === "artist") || null;
  const tracks = results.filter((item) => item.wrapperType === "track");
  return { artist, tracks };
}

export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getArtist(id);
  return (
    <main className="public-page">
      <header className="public-header"><Link className="brand" href="/"><span className="brand-mark"><AudioLines size={21} /></span><span>echo<span className="brand-light">id</span></span></Link><span>ARTIST INTELLIGENCE</span></header>
      <section className="public-content">
        {data.artist ? <>
          <div className="eyebrow"><span /> ARTIST CATALOG</div><h1>{data.artist.artistName}</h1><p>{data.artist.primaryGenreName || "Genre not listed"}</p>
          {data.artist.artistLinkUrl && <a className="secondary-button" href={data.artist.artistLinkUrl} target="_blank" rel="noreferrer">Open artist catalog ↗</a>}
          <div className="section-head"><div><h3>Tracks in catalog</h3><p>Metadata returned by Apple Music / iTunes</p></div></div>
          <div className="result-list">{data.tracks.map((track, index) => <article className="result-row" key={track.trackViewUrl || index}><div className="cover">{track.artworkUrl100 ? <img src={track.artworkUrl100} alt="" /> : <Music2 size={21} />}</div><div className="song-meta"><strong>{track.trackName}</strong><span>{track.collectionName}{track.primaryGenreName ? " · " + track.primaryGenreName : ""}</span></div>{track.trackViewUrl && <a className="text-link" href={track.trackViewUrl} target="_blank" rel="noreferrer">Open ↗</a>}</article>)}</div>
        </> : <div className="empty-state"><Music2 size={30} /><h2>Artist not found</h2><p>This artist is not available in the catalog.</p></div>}
        <Link className="primary-button" href="/intelligence">Back to Song DNA</Link>
      </section>
    </main>
  );
}
