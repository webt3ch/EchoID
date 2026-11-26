"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, AudioLines, Bookmark, Music2, Search, Sparkles } from "lucide-react";
import { EchoLanguage, translate } from "../../lib/i18n";

type Track = {
  title: string; artist: string; album: string; color: string;
  artworkUrl?: string; songLink?: string; releaseDate?: string; genre?: string;
  artistId?: number; artistUrl?: string; trackId?: number; trackTimeMillis?: number;
};

function loadLanguage(): EchoLanguage {
  if (typeof window === "undefined") return "English";
  const value = window.localStorage.getItem("echoid:language");
  return value === "Italiano" || value === "Español" ? value : "English";
}

export default function IntelligencePage() {
  const [language, setLanguage] = useState<EchoLanguage>("English");
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selected, setSelected] = useState<Track | null>(null);
  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const t = (value: string) => translate(value, language);

  useEffect(() => { setLanguage(loadLanguage()); }, []);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 3) { setNotice("Write at least 3 characters."); return; }
    setLoading(true); setNotice(""); setTracks([]); setSelected(null); setRecommendations([]);
    try {
      const response = await fetch("/api/search?mode=mood&q=" + encodeURIComponent(query.trim()), { cache: "no-store" });
      const data = await response.json() as { tracks?: Track[]; message?: string; note?: string };
      if (!response.ok) throw new Error(data.message || "Mood search is unavailable.");
      setTracks(data.tracks ?? []);
      setNotice(data.note || ((data.tracks?.length ?? 0) ? "Catalog matches found." : "No catalog matches. Try different descriptors."));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Search failed."); }
    finally { setLoading(false); }
  }

  async function findSimilar(track: Track) {
    setSelected(track); setRecommendations([]); setNotice("Finding related catalog tracks…");
    const seed = [track.genre, track.artist].filter(Boolean).join(" ");
    if (seed.length < 3) { setNotice("This catalog entry has too little metadata for recommendations."); return; }
    try {
      const response = await fetch("/api/search?mode=recommend&q=" + encodeURIComponent(seed), { cache: "no-store" });
      const data = await response.json() as { tracks?: Track[]; message?: string };
      if (!response.ok) throw new Error(data.message || "Recommendations are unavailable.");
      setRecommendations((data.tracks ?? []).filter((item) => item.trackId !== track.trackId).slice(0, 8));
      setNotice("Related tracks are based on artist and genre catalog metadata.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Recommendations failed."); }
  }

  function saveTrack(track: Track) {
    try {
      const saved = JSON.parse(window.localStorage.getItem("echoid:saved") || "[]") as Track[];
      const exists = saved.some((item) => item.title === track.title && item.artist === track.artist);
      if (!exists) window.localStorage.setItem("echoid:saved", JSON.stringify([track, ...saved]));
      setNotice(exists ? "This track is already in your library." : "Track saved to your library on this device.");
    } catch { setNotice("Browser storage is unavailable."); }
  }

  const cover = (track: Track) => (
    <div className="cover">{track.artworkUrl ? <img src={track.artworkUrl} alt="" /> : <Music2 size={23} />}</div>
  );
  const result = (track: Track, index: number) => (
    <article className="result-row" key={track.trackId ?? track.title + track.artist + index}>
      {cover(track)}
      <div className="song-meta"><strong>{track.title}</strong><span>{track.artist}{track.genre ? " · " + track.genre : ""}</span></div>
      <button className="round-action" onClick={() => void findSimilar(track)} aria-label={"Analyze " + track.title}><ArrowUpRight size={16} /></button>
    </article>
  );

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/"><span className="brand-mark"><AudioLines size={21} /></span><span>echo<span className="brand-light">id</span></span></Link>
        <div className="side-label">ECHOID INTELLIGENCE</div>
        <nav className="side-nav">
          <Link className="nav-item" href="/">Discover</Link>
          <Link className="nav-item active" href="/intelligence">Intelligence</Link>
          <Link className="nav-item" href="/playlists">Playlists</Link>
          <Link className="nav-item" href="/statistics">Statistics</Link>
          <Link className="nav-item" href="/hum">Hum 2.0</Link>
        </nav>
      </aside>
      <section className="main-content">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>Intelligence</strong></div><span className="status-pill status-ready">SONG DNA · MOOD SEARCH</span></header>
        <div className="content-wrap">
          <div className="page-title">
            <div className="eyebrow"><span /> DISCOVER BEYOND THE GENRE</div>
            <h1>Mood <span>Search.</span></h1>
            <p>Describe a sound, scene, atmosphere or genre. EchoID expands your description into catalog searches and helps you explore related tracks.</p>
          </div>

          <section className="search-card">
            <div className="search-body">
              <div className="text-search-icon"><Sparkles size={21} /></div>
              <h2>What should the music feel like?</h2>
              <p>Try “elegant deep house for a fashion boutique” or “dreamy, nostalgic electronic music”.</p>
              <form className="query-box" onSubmit={search}>
                <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={3} maxLength={300} placeholder="Describe the mood, genre, instruments, energy or setting…" />
                <button type="submit" disabled={loading} aria-label="Search moods">{loading ? "…" : <Search size={17} />}</button>
              </form>
              {notice && <div className="inline-notice" role="status">{notice}</div>}
              <p className="privacy-note">Mood Search currently uses descriptor expansion and Apple Music catalog metadata, not an LLM or embedding model.</p>
            </div>
          </section>

          {tracks.length > 0 && (
            <section className="results-section">
              <div className="section-head"><div><h3>Discoveries</h3><p>{tracks.length} catalog results</p></div></div>
              <div className="result-list">{tracks.map(result)}</div>
            </section>
          )}

          {selected && (
            <section className="results-section">
              <div className="section-head"><div><h3>Song DNA</h3><p>Verified catalog metadata for the selected track</p></div></div>
              <article className="recognized-track">
                {cover(selected)}
                <div className="recognized-meta">
                  <span className="match-label"><CheckIcon /> CATALOG MATCH</span>
                  <h2>{selected.title}</h2>
                  <p>{selected.artist}</p>
                  <span className="album-line">{selected.album || "Album not listed"} · {selected.releaseDate?.slice(0, 4) || "Release year unavailable"}</span>
                  <div className="dna-grid">
                    <div><span>GENRE</span><strong>{selected.genre || "Not supplied"}</strong></div>
                    <div><span>ARTIST ID</span><strong>{selected.artistId ?? "Not supplied"}</strong></div>
                    <div><span>DURATION</span><strong>{selected.trackTimeMillis ? Math.floor(selected.trackTimeMillis / 60000) + ":" + String(Math.floor(selected.trackTimeMillis / 1000) % 60).padStart(2, "0") : "Not supplied"}</strong></div>
                    <div><span>RELEASE</span><strong>{selected.releaseDate || "Not supplied"}</strong></div>
                  </div>
                  <p className="privacy-note">BPM, musical key and energy scores are not exposed by this catalog endpoint, so EchoID does not estimate or fabricate them.</p>
                  <div className="track-actions">
                    <button className="primary-button" onClick={() => saveTrack(selected)}><Bookmark size={15} /> Save track</button>
                    <button className="secondary-button" onClick={() => void findSimilar(selected)}>Find similar tracks</button>
                    {selected.artistId && <Link className="secondary-button" href={"/artist/" + selected.artistId}>EchoID artist profile <ArrowUpRight size={14} /></Link>}
                    {selected.artistUrl && <a className="secondary-button" href={selected.artistUrl} target="_blank" rel="noreferrer">Apple catalog <ArrowUpRight size={14} /></a>}
                  </div>
                </div>
              </article>
            </section>
          )}

          {recommendations.length > 0 && (
            <section className="results-section">
              <div className="section-head"><div><h3>Related discoveries</h3><p>Catalog-based recommendations, not personalized AI ranking</p></div></div>
              <div className="result-list">{recommendations.map(result)}</div>
            </section>
          )}
          <footer className="page-footer"><span>© 2026 EchoID</span><span>Recognition · Intelligence · Discovery</span><Link href="/">Back to EchoID <ArrowUpRight size={13} /></Link></footer>
        </div>
      </section>
    </main>
  );
}

function CheckIcon() {
  return <span aria-hidden="true">✓</span>;
}
