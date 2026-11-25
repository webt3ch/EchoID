"use client";

import { useRef, useState } from "react";
import { AudioLines, ArrowUpRight, Bookmark, Check, ChevronDown, Clock3, Headphones, History, Library, Mic, Music2, Search, Settings2, Sparkles, Upload, X } from "lucide-react";

type Mode = "sound" | "lyrics" | "hum" | "describe";
const modes: { id: Mode; label: string; icon: typeof Mic; hint: string }[] = [
  { id: "sound", label: "Sound", icon: AudioLines, hint: "Play a song nearby or upload a clip" },
  { id: "lyrics", label: "Lyrics", icon: Search, hint: "Type any lyric you remember" },
  { id: "hum", label: "Hum", icon: Mic, hint: "Hum or whistle the melody" },
  { id: "describe", label: "Describe", icon: Sparkles, hint: "Describe the song in your own words" },
];

export default function Home() {
  const [mode, setMode] = useState<Mode>("sound");
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const current = modes.find((item) => item.id === mode)!;

  function submitSearch() {
    if (!query.trim()) { setNotice("Add a lyric or a few details to start your search."); return; }
    setNotice("Search is ready to connect to EchoID recognition in phase two.");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="EchoID home"><span className="brand-mark"><AudioLines size={21}/></span><span>echo<span className="brand-light">id</span></span></a>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a className="nav-item active" href="#discover"><Search size={17}/> Discover <span className="nav-dot"/></a>
          <a className="nav-item" href="#library"><Library size={17}/> Your library</a>
          <a className="nav-item" href="#history"><History size={17}/> History</a>
        </nav>
        <div className="side-bottom">
          <div className="upgrade-card"><div className="upgrade-icon"><Sparkles size={17}/></div><strong>Find your next favorite</strong><p>Explore music beyond the songs you already know.</p><a href="#discover">Explore discovery <ArrowUpRight size={14}/></a></div>
          <button className="nav-item settings-button" onClick={() => setNotice("Settings will be available with your EchoID account.")}><Settings2 size={17}/> Settings</button>
          <div className="profile-row"><div className="avatar">E</div><div><strong>Guest session</strong><span>Your music, your space</span></div><ChevronDown size={15}/></div>
        </div>
      </aside>

      <section className="main-content" id="discover">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>Discover</strong></div><div className="top-actions"><span className="status-pill"><i/> All systems ready</span><button className="icon-button" aria-label="Settings" onClick={() => setNotice("Settings will be available with your EchoID account.")}><Settings2 size={18}/></button><button className="avatar small" aria-label="Guest profile">E</button></div></header>
        <div className="content-wrap">
          <div className="hero-heading"><div><div className="eyebrow"><span/> MUSIC DISCOVERY, REIMAGINED</div><h1>Every song has<br/>a <span>story.</span></h1><p>Find the music you feel. Search by sound, lyrics, or the melody stuck in your head.</p></div><div className="hero-art" aria-hidden="true"><div className="orb orb-one"/><div className="orb orb-two"/><div className="orb-core"><AudioLines size={35}/></div><div className="orbit orbit-one"/><div className="orbit orbit-two"/></div></div>

          <section className="search-card" aria-label="Music recognition">
            <div className="mode-tabs" role="tablist" aria-label="Search method">{modes.map(({id,label,icon:Icon}) => <button key={id} role="tab" aria-selected={mode===id} className={mode===id?"mode-tab selected":"mode-tab"} onClick={() => {setMode(id);setNotice("");}}><Icon size={16}/>{label}</button>)}</div>
            <div className="search-body">
              {mode === "sound" ? <><div className={listening?"listen-button listening":"listen-button"}><button aria-label={listening?"Stop listening":"Start listening"} onClick={() => {setListening(!listening);setNotice(listening?"Listening stopped.":"Microphone recognition will connect in phase two.");}}><AudioLines size={29}/></button><span className="pulse pulse-a"/><span className="pulse pulse-b"/></div><h2>{listening?"Listening for music…":"What’s that song?"}</h2><p>{listening?"Keep the music playing nearby.":"Tap to identify a song playing around you."}</p><div className="search-divider"><span>OR</span></div><button className="upload-button" onClick={() => fileRef.current?.click()}><Upload size={16}/> Upload an audio file <span>MP3, WAV, M4A</span></button><input ref={fileRef} type="file" accept="audio/*" hidden onChange={(e) => setNotice(e.target.files?.[0] ? "Audio upload is ready for the recognition engine in phase two." : "")}/></> :
              <><div className="text-search-icon"><current.icon size={21}/></div><h2>{mode==="lyrics"?"A line is all you need.":mode==="hum"?"Hum it. Find it.":"Describe what you remember."}</h2><p>{current.hint}</p><div className="query-box"><textarea value={query} onChange={(e)=>setQuery(e.target.value)} placeholder={mode==="lyrics"?"“I wanna dance with somebody…”":mode==="hum"?"Hum recognition will use your microphone.":"A mellow house track with a female vocal…"} rows={2}/><button onClick={submitSearch} aria-label="Search"><ArrowUpRight size={19}/></button></div>{mode==="hum"&&<button className="secondary-button" onClick={()=>setNotice("Humming capture will connect to the recognition engine in phase two.")}><Mic size={16}/> Start humming</button>}</>}
              {notice&&<div className="inline-notice" role="status"><span>{notice}</span><button aria-label="Dismiss" onClick={()=>setNotice("")}><X size={14}/></button></div>}
            </div>
            <div className="card-footer"><span><span className="privacy-dot"/> Private by design</span><span>Powered by sound & meaning <Sparkles size={13}/></span></div>
          </section>

          <section className="below-grid" id="library"><div className="section-head"><div><h3>Your discovery space</h3><p>Your recent finds and saved songs will live here.</p></div><a href="#history">View history <ArrowUpRight size={14}/></a></div><div className="empty-library"><div className="empty-icon"><Bookmark size={21}/></div><div><strong>Your next favorite is out there.</strong><p>Identify a song to start building your personal music library.</p></div><span className="empty-check"><Check size={15}/></span></div></section>
          <footer className="page-footer"><span>© 2026 EchoID</span><span>Music discovery, with a little more feeling.</span><a href="#discover">Back to top ↑</a></footer>
        </div>
      </section>
    </main>
  );
}
