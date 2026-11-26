"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { AudioLines, Link2, ListMusic, Music2, Plus, Share2, Trash2 } from "lucide-react";

type Track = { title: string; artist: string; album?: string; genre?: string; artworkUrl?: string; songLink?: string; releaseDate?: string };
type Playlist = { id: string; name: string; description: string; songs: Track[]; shareUrl?: string; createdAt: string };
type Session = { access_token: string; user: { id: string; email?: string } };

const read = <T,>(key: string, fallback: T): T => {
  try { return JSON.parse(window.localStorage.getItem(key) || "null") ?? fallback; }
  catch { return fallback; }
};

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [saved, setSaved] = useState<Track[]>([]);
  const [activeId, setActiveId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const active = playlists.find((item) => item.id === activeId) || null;

  useEffect(() => {
    setPlaylists(read<Playlist[]>("echoid:playlists", []));
    setSaved(read<Track[]>("echoid:saved", []));
    setSession(read<Session | null>("echoid:cloud-session", null));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("echoid:playlists", JSON.stringify(playlists));
  }, [playlists]);

  function createPlaylist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2) { setNotice("Give your playlist a name (at least 2 characters)."); return; }
    const playlist: Playlist = { id: crypto.randomUUID(), name: name.trim(), description: description.trim(), songs: [], createdAt: new Date().toISOString() };
    setPlaylists((previous) => [playlist, ...previous]);
    setActiveId(playlist.id); setName(""); setDescription(""); setNotice("Playlist created on this device.");
  }

  function addSong(track: Track) {
    if (!active) return;
    setPlaylists((previous) => previous.map((item) =>
      item.id === active.id && !item.songs.some((song) => song.title === track.title && song.artist === track.artist)
        ? { ...item, songs: [...item.songs, track] } : item));
  }

  function removeSong(track: Track) {
    if (!active) return;
    setPlaylists((previous) => previous.map((item) => item.id === active.id
      ? { ...item, songs: item.songs.filter((song) => song.title !== track.title || song.artist !== track.artist) } : item));
  }

  async function sharePlaylist() {
    if (!active) return;
    if (!session || !supabaseUrl || !anonKey) { setNotice("Sign in to EchoID and configure Supabase before publishing a public playlist."); return; }
    setBusy(true);
    try {
      const slug = crypto.randomUUID().replace(/-/g, "");
      const response = await fetch(supabaseUrl + "/rest/v1/echoid_public_playlists", {
        method: "POST",
        headers: { apikey: anonKey, Authorization: "Bearer " + session.access_token, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ owner_id: session.user.id, slug, name: active.name, description: active.description, tracks: active.songs, is_public: true }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Could not publish playlist. Check the Supabase V2 schema and account permissions.");
      const shareUrl = window.location.origin + "/share/" + slug;
      setPlaylists((previous) => previous.map((item) => item.id === active.id ? { ...item, shareUrl } : item));
      setNotice("Public playlist created. You can copy or share its link.");
      try { await navigator.clipboard.writeText(shareUrl); } catch { /* Clipboard permission is optional. */ }
    } catch (error) { setNotice(error instanceof Error ? error.message : "Share failed."); }
    finally { setBusy(false); }
  }

  async function syncCloud() {
    if (!session || !supabaseUrl || !anonKey) { setNotice("Sign in and configure Supabase to sync playlists."); return; }
    setBusy(true);
    try {
      const history = read<Track[]>("echoid:history", []);
      const response = await fetch(supabaseUrl + "/rest/v1/echoid_library?on_conflict=user_id", {
        method: "POST",
        headers: { apikey: anonKey, Authorization: "Bearer " + session.access_token, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: session.user.id, saved, history, playlists, updated_at: new Date().toISOString() }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Cloud sync failed. Apply the EchoID V2 database migration first.");
      setNotice("Playlists, saved tracks and history synced to Supabase.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Cloud sync failed."); }
    finally { setBusy(false); }
  }

  const cover = (track: Track) => <div className="cover">{track.artworkUrl ? <img src={track.artworkUrl} alt="" /> : <Music2 size={21} />}</div>;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/"><span className="brand-mark"><AudioLines size={21} /></span><span>echo<span className="brand-light">id</span></span></Link>
        <div className="side-label">YOUR COLLECTION</div>
        <nav className="side-nav">
          <Link className="nav-item" href="/">Discover</Link>
          <Link className="nav-item" href="/intelligence">Intelligence</Link>
          <Link className="nav-item active" href="/playlists">Playlists</Link>
          <Link className="nav-item" href="/statistics">Statistics</Link>
          <Link className="nav-item" href="/profile">Public profile</Link>
        </nav>
      </aside>
      <section className="main-content">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>Playlists</strong></div><span className="status-pill status-ready">SMART LIBRARY</span></header>
        <div className="content-wrap">
          <div className="page-title"><div className="eyebrow"><span /> YOUR MUSIC, ORGANIZED</div><h1>Smart <span>Library.</span></h1><p>Create collections, organize saved music and share playlists publicly.</p></div>
          <div className="playlist-layout">
            <section className="page-panel">
              <form className="playlist-create" onSubmit={createPlaylist}>
                <h3>Create a collection</h3>
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="Playlist name" aria-label="Playlist name" />
                <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={180} placeholder="Description (optional)" aria-label="Playlist description" />
                <button className="primary-button" type="submit"><Plus size={15} /> Create playlist</button>
              </form>
              <div className="section-head"><div><h3>Your playlists</h3><p>{playlists.length} collections on this device</p></div><button className="secondary-button" onClick={() => void syncCloud()} disabled={busy}>Sync cloud</button></div>
              {playlists.length ? <div className="playlist-list">{playlists.map((item) => (
                <button key={item.id} className={"playlist-item " + (item.id === activeId ? "selected" : "")} onClick={() => setActiveId(item.id)}>
                  <span className="playlist-icon"><ListMusic size={19} /></span><span><strong>{item.name}</strong><small>{item.songs.length} tracks · {item.description || "Personal collection"}</small></span>
                </button>
              ))}</div> : <div className="empty-state"><ListMusic size={28} /><h2>No playlists yet.</h2><p>Create your first collection to start organizing saved songs.</p></div>}
            </section>
            <section className="page-panel">
              {active ? <>
                <div className="section-head"><div><h3>{active.name}</h3><p>{active.description || "A collection curated by you"}</p></div><button className="danger-button" onClick={() => { setPlaylists((items) => items.filter((item) => item.id !== active.id)); setActiveId(""); }}><Trash2 size={14} /> Delete</button></div>
                <div className="track-actions"><button className="primary-button" onClick={() => void sharePlaylist()} disabled={busy}><Share2 size={15} /> Publish playlist</button>{active.shareUrl && <a className="secondary-button" href={active.shareUrl} target="_blank" rel="noreferrer"><Link2 size={14} /> Open public link</a>}</div>
                {active.shareUrl && <div className="inline-notice"><a href={active.shareUrl}>{active.shareUrl}</a></div>}
                <h3 className="subheading">Saved tracks</h3>
                {active.songs.length ? <div className="result-list">{active.songs.map((track, index) => <article className="result-row" key={track.title + track.artist + index}>{cover(track)}<div className="song-meta"><strong>{track.title}</strong><span>{track.artist}</span></div><button className="round-action" onClick={() => removeSong(track)} aria-label="Remove track"><Trash2 size={15} /></button></article>)}</div> : <div className="empty-state compact"><p>This playlist is empty. Add songs from your saved library below.</p></div>}
                <h3 className="subheading">Add from your library</h3>
                {saved.length ? <div className="result-list">{saved.map((track, index) => <article className="result-row" key={track.title + track.artist + index}>{cover(track)}<div className="song-meta"><strong>{track.title}</strong><span>{track.artist}</span></div><button className="round-action" onClick={() => addSong(track)} aria-label="Add to playlist"><Plus size={16} /></button></article>)}</div> : <p className="muted-copy">Save tracks in Discover before adding them to a playlist.</p>}
              </> : <div className="empty-state"><ListMusic size={28} /><h2>Select a playlist.</h2><p>Create a new collection or select one from the list.</p></div>}
              {notice && <div className="inline-notice" role="status">{notice}</div>}
            </section>
          </div>
          <footer className="page-footer"><span>© 2026 EchoID</span><span>Collections can be local or shared with a public link.</span><Link href="/">Back to EchoID</Link></footer>
        </div>
      </section>
    </main>
  );
}
