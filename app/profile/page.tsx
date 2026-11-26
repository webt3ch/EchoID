"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { AudioLines, Globe, UserRound } from "lucide-react";

type Session = { access_token: string; user: { id: string; email?: string } };

export default function ProfilePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedHandle, setSavedHandle] = useState("");
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  useEffect(() => {
    try { setSession(JSON.parse(localStorage.getItem("echoid:cloud-session") || "null")); }
    catch { setSession(null); }
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !url || !key) { setNotice("Sign in and configure Supabase to publish a profile."); return; }
    const normalized = handle.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (normalized.length < 3) { setNotice("Choose a handle with at least 3 letters or numbers."); return; }
    setBusy(true);
    try {
      const response = await fetch(url + "/rest/v1/echoid_profiles?on_conflict=user_id", {
        method: "POST",
        headers: { apikey: key, Authorization: "Bearer " + session.access_token, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: session.user.id, handle: normalized, display_name: displayName.trim() || normalized, bio: bio.trim(), is_public: isPublic, updated_at: new Date().toISOString() }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(response.status === 409 ? "This handle is already taken." : "Could not save the profile. Apply the EchoID V2 database migration.");
      setSavedHandle(normalized); setNotice("Public profile saved.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Profile save failed."); }
    finally { setBusy(false); }
  }

  const publicUrl = typeof window !== "undefined" && savedHandle ? window.location.origin + "/u/" + savedHandle : "";

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/"><span className="brand-mark"><AudioLines size={21} /></span><span>echo<span className="brand-light">id</span></span></Link>
        <div className="side-label">YOUR PROFILE</div>
        <nav className="side-nav"><Link className="nav-item" href="/">Discover</Link><Link className="nav-item" href="/playlists">Playlists</Link><Link className="nav-item active" href="/profile">Public profile</Link></nav>
      </aside>
      <section className="main-content">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>Public profile</strong></div><span className="status-pill status-ready">ECHOID IDENTITY</span></header>
        <div className="content-wrap">
          <div className="page-title"><div className="eyebrow"><span /> YOUR MUSIC IDENTITY</div><h1>Public <span>profile.</span></h1><p>Create a shareable EchoID profile. You need an active EchoID account to publish it.</p></div>
          <section className="account-card">
            <div className="account-avatar"><UserRound size={28} /></div>
            <h2>Profile settings</h2>
            <p>{session?.user.email || "Not signed in"}</p>
            <form onSubmit={save}>
              <label>Public handle<input value={handle} onChange={(event) => setHandle(event.target.value)} maxLength={30} placeholder="e.g. mario_music" required /></label>
              <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={60} placeholder="Your display name" /></label>
              <label>Bio<textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={240} rows={3} placeholder="A few words about your music taste…" /></label>
              <label className="check-line"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} /> Make my profile public</label>
              <button className="primary-button" type="submit" disabled={busy || !session}>{busy ? "Saving…" : "Save public profile"}</button>
            </form>
            {notice && <div className="inline-notice">{notice}</div>}
            {publicUrl && <div className="inline-notice"><Globe size={15} /><a href={publicUrl}>{publicUrl}</a></div>}
            {!session && <div className="inline-notice">Open the Account section in EchoID, sign in, then return here. <Link href="/">Go to EchoID</Link></div>}
          </section>
          <footer className="page-footer"><span>© 2026 EchoID</span><span>You control whether your profile is public.</span><Link href="/">Back to EchoID</Link></footer>
        </div>
      </section>
    </main>
  );
}
