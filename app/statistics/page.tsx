"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AudioLines, BarChart3, Clock3, Heart, Music2 } from "lucide-react";

type Track = { title: string; artist: string; genre?: string; discoveredAt?: string };
type Playlist = { id: string; name: string; songs?: Track[] };

export default function StatisticsPage() {
  const [history, setHistory] = useState<Track[]>([]);
  const [saved, setSaved] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem("echoid:history") || "[]"));
      setSaved(JSON.parse(localStorage.getItem("echoid:saved") || "[]"));
      setPlaylists(JSON.parse(localStorage.getItem("echoid:playlists") || "[]"));
    } catch { /* Empty analytics are safer than blocking the page. */ }
  }, []);

  const artists = useMemo(() => {
    const counts = new Map<string, number>();
    for (const track of history) counts.set(track.artist, (counts.get(track.artist) || 0) + 1);
    return Array.from(counts, ([artist, count]) => ({ artist, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [history]);

  const genres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const track of history) if (track.genre) counts.set(track.genre, (counts.get(track.genre) || 0) + 1);
    return Array.from(counts, ([genre, count]) => ({ genre, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [history]);

  const months = useMemo(() => {
    const counts = new Map<string, number>();
    for (const track of history) {
      if (!track.discoveredAt) continue;
      const date = new Date(track.discoveredAt);
      if (Number.isNaN(date.getTime())) continue;
      const label = date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return Array.from(counts, ([month, count]) => ({ month, count })).slice(-6);
  }, [history]);

  const maxArtist = Math.max(1, ...artists.map((item) => item.count));
  const maxGenre = Math.max(1, ...genres.map((item) => item.count));
  const maxMonth = Math.max(1, ...months.map((item) => item.count));

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/"><span className="brand-mark"><AudioLines size={21} /></span><span>echo<span className="brand-light">id</span></span></Link>
        <div className="side-label">YOUR ECHOID</div>
        <nav className="side-nav">
          <Link className="nav-item" href="/">Discover</Link>
          <Link className="nav-item" href="/intelligence">Intelligence</Link>
          <Link className="nav-item" href="/playlists">Playlists</Link>
          <Link className="nav-item active" href="/statistics">Statistics</Link>
          <Link className="nav-item" href="/profile">Public profile</Link>
        </nav>
      </aside>
      <section className="main-content">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>Statistics</strong></div><span className="status-pill status-ready">PERSONAL INSIGHTS</span></header>
        <div className="content-wrap">
          <div className="page-title"><div className="eyebrow"><span /> YOUR LISTENING JOURNEY</div><h1>Discovery <span>Stats.</span></h1><p>Insights calculated from the EchoID history stored in this browser.</p></div>
          <div className="stats-grid">
            <article className="stat-card"><AudioLines size={19} /><span>Recognized tracks</span><strong>{history.length}</strong><small>Saved in local history</small></article>
            <article className="stat-card"><Heart size={19} /><span>Saved tracks</span><strong>{saved.length}</strong><small>Your personal library</small></article>
            <article className="stat-card"><BarChart3 size={19} /><span>Playlists</span><strong>{playlists.length}</strong><small>Local collections</small></article>
            <article className="stat-card"><Clock3 size={19} /><span>Unique artists</span><strong>{new Set(history.map((item) => item.artist)).size}</strong><small>Across discoveries</small></article>
          </div>
          <div className="analytics-grid">
            <section className="analytics-card"><h3>Most discovered artists</h3><p>Based on repeated tracks in your history.</p>{artists.length ? artists.map((item) => <div className="bar-row" key={item.artist}><span>{item.artist}</span><div><i style={{ width: (item.count / maxArtist * 100) + "%" }} /></div><b>{item.count}</b></div>) : <div className="empty-state compact"><p>Identify a few tracks to build your artist statistics.</p></div>}</section>
            <section className="analytics-card"><h3>Genres in your history</h3><p>Only tracks with catalog genre metadata are counted.</p>{genres.length ? genres.map((item) => <div className="bar-row" key={item.genre}><span>{item.genre}</span><div><i style={{ width: (item.count / maxGenre * 100) + "%" }} /></div><b>{item.count}</b></div>) : <div className="empty-state compact"><p>Genre insights appear when the catalog provides genre information.</p></div>}</section>
            <section className="analytics-card wide"><h3>Discovery timeline</h3><p>Recent discovery months. Older history entries without timestamps are not included.</p>{months.length ? <div className="month-bars">{months.map((item) => <div key={item.month}><span>{item.count}</span><i style={{ height: Math.max(8, item.count / maxMonth * 130) + "px" }} /><small>{item.month}</small></div>)}</div> : <div className="empty-state compact"><p>New discoveries will appear here with their timestamp.</p></div>}</section>
          </div>
          <footer className="page-footer"><span>© 2026 EchoID</span><span>Private analytics · stored on this device</span><Link href="/">Back to EchoID</Link></footer>
        </div>
      </section>
    </main>
  );
}
