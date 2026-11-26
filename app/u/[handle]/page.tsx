import Link from "next/link";
import { AudioLines, Music2, UserRound } from "lucide-react";

type Profile = { user_id: string; handle: string; display_name: string; bio?: string; is_public: boolean };
type Playlist = { slug: string; name: string; description?: string; tracks?: unknown[] };

export const dynamic = "force-dynamic";

async function getProfile(handle: string): Promise<Profile | null> {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!base || !key) return null;
  const response = await fetch(base + "/rest/v1/echoid_profiles?select=user_id,handle,display_name,bio,is_public&handle=eq." + encodeURIComponent(handle) + "&is_public=eq.true&limit=1", { headers: { apikey: key }, cache: "no-store" });
  if (!response.ok) return null;
  const rows = await response.json() as Profile[];
  return rows[0] ?? null;
}

async function getPlaylists(ownerId: string): Promise<Playlist[]> {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!base || !key) return [];
  const response = await fetch(base + "/rest/v1/echoid_public_playlists?select=slug,name,description,tracks&owner_id=eq." + encodeURIComponent(ownerId) + "&is_public=eq.true&order=created_at.desc", { headers: { apikey: key }, cache: "no-store" });
  if (!response.ok) return [];
  return await response.json() as Playlist[];
}

export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await getProfile(handle);
  const playlists = profile ? await getPlaylists(profile.user_id) : [];
  return (
    <main className="public-page">
      <header className="public-header"><Link className="brand" href="/"><span className="brand-mark"><AudioLines size={21} /></span><span>echo<span className="brand-light">id</span></span></Link><span>PUBLIC PROFILE</span></header>
      <section className="public-content">
        {profile ? <>
          <div className="public-avatar"><UserRound size={34} /></div>
          <div className="eyebrow"><span /> ECHOID MEMBER</div>
          <h1>{profile.display_name}</h1>
          <p className="handle-line">@{profile.handle}</p>
          <p>{profile.bio || "Music explorer on EchoID."}</p>
          <div className="section-head"><div><h3>Public playlists</h3><p>{playlists.length} shared collections</p></div></div>
          {playlists.length ? <div className="result-list">{playlists.map((playlist) => <article className="result-row" key={playlist.slug}><div className="cover"><Music2 size={21} /></div><div className="song-meta"><strong>{playlist.name}</strong><span>{playlist.description || (playlist.tracks?.length || 0) + " tracks"}</span></div><Link className="text-link" href={"/share/" + playlist.slug}>Open ↗</Link></article>)}</div> : <div className="empty-state compact"><p>No public playlists yet.</p></div>}
        </> : <div className="empty-state"><UserRound size={30} /><h2>Profile unavailable</h2><p>This profile may be private or the handle may be incorrect.</p></div>}
        <Link className="primary-button" href="/">Discover music with EchoID</Link>
      </section>
    </main>
  );
}
