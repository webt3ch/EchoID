"use client";

import { useEffect, useRef, useState } from "react";
import { translate } from "../lib/i18n";
import {
  AudioLines,
  Search,
  Library,
  History as HistoryIcon,
  Settings2,
  Mic,
  Sparkles,
  Upload,
  Bookmark,
  Clock3,
  Heart,
  ArrowUpRight,
  Check,
  X,
  Music2,
  Trash2,
  ShieldCheck,
  Globe,
  SlidersHorizontal,
  UserRound,
  ExternalLink,
  LoaderCircle,
} from "lucide-react";

type Page = "Discover" | "Your library" | "History" | "Settings" | "Account";
type SearchMode = "Sound" | "Lyrics" | "Hum" | "Describe";
type CloudSession = { access_token: string; user: { id: string; email?: string } };
type Song = {
  title: string;
  artist: string;
  album: string;
  color: string;
  artworkUrl?: string;
  songLink?: string;
  appleMusicUrl?: string;
  spotifyUrl?: string;
  deezerUrl?: string;
  releaseDate?: string;
  timecode?: string;
  genre?: string;
  artistId?: number;
  artistUrl?: string;
  trackId?: number;
  trackTimeMillis?: number;
  lyricSnippet?: string;
  discoveredAt?: string;
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_RECORDING_SECONDS = 12;

function EchoMark({ size = 21 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
      <path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M5.2 5.2a9.6 9.6 0 0 0 0 13.6M18.8 5.2a9.6 9.6 0 0 1 0 13.6" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity=".72" />
    </svg>
  );
}

function Cover({ song, large = false }: { song: Song; large?: boolean }) {
  return (
    <div
      className={"cover " + song.color + (large ? " cover-large" : "")}
      aria-label={song.title + " artwork"}
    >
      {song.artworkUrl ? <img src={song.artworkUrl} alt="" /> : <Music2 size={24} />}
    </div>
  );
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function Home() {
  const [page, setPage] = useState<Page>("Discover");
  const [mode, setMode] = useState<SearchMode>("Sound");
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState<Song[]>([]);
  const [history, setHistory] = useState<Song[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Song | null>(null);
  const [dark, setDark] = useState(true);
  const [language, setLanguage] = useState("English");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [cloudSession, setCloudSession] = useState<CloudSession | null>(null);
  const [password, setPassword] = useState("");
  const [cloudBusy, setCloudBusy] = useState(false);
  const cloudUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const cloudAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const cloudConfigured = Boolean(cloudUrl && cloudAnonKey);
  const t = (value: string) => translate(value, language);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSaved(readStored<Song[]>("echoid:saved", []));
    setHistory(readStored<Song[]>("echoid:history", []));
    setDark(readStored<boolean>("echoid:dark", true));
    setLanguage(readStored<string>("echoid:language", "English"));
    setName(readStored<string>("echoid:name", ""));
    setEmail(readStored<string>("echoid:email", ""));
    setCloudSession(readStored<CloudSession | null>("echoid:cloud-session", null));
    setStorageReady(true);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);

    fetch("/api/recognize", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { configured?: boolean }) => setProviderConfigured(Boolean(data.configured)))
      .catch(() => setProviderConfigured(false));
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem("echoid:saved", JSON.stringify(saved));
      window.localStorage.setItem("echoid:history", JSON.stringify(history));
      window.localStorage.setItem("echoid:dark", JSON.stringify(dark));
      window.localStorage.setItem("echoid:language", JSON.stringify(language));
      window.localStorage.setItem("echoid:name", JSON.stringify(name));
      window.localStorage.setItem("echoid:email", JSON.stringify(email));
    } catch {
      setNotice("This browser could not save local data. Check its storage settings.");
    }
  }, [saved, history, dark, language, name, email, storageReady]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function recognizeAudio(audio: Blob, filename: string) {
    if (audio.size === 0) {
      setNotice("The recording is empty. Try again.");
      return;
    }
    if (audio.size > MAX_UPLOAD_BYTES) {
      setNotice("The audio file is larger than 10 MB. Choose a shorter file.");
      return;
    }

    setIsRecognizing(true);
    setCurrentTrack(null);
    setNotice("Sending audio securely to the recognition service…");

    try {
      const body = new FormData();
      body.append("audio", audio, filename);
      const response = await fetch("/api/recognize", {
        method: "POST",
        body,
        cache: "no-store",
      });
      const data = (await response.json()) as {
        matched?: boolean;
        message?: string;
        track?: {
          title?: string;
          artist?: string;
          album?: string;
          releaseDate?: string;
          timecode?: string;
          songLink?: string;
          artworkUrl?: string;
          appleMusicUrl?: string;
          spotifyUrl?: string;
          deezerUrl?: string;
        };
      };

      if (!response.ok) {
        throw new Error(data.message || "Recognition failed. Please try again.");
      }
      if (!data.matched || !data.track?.title || !data.track.artist) {
        setNotice(data.message || "No match found. Try a clearer sample.");
        return;
      }

      const track: Song = {
        title: data.track.title,
        artist: data.track.artist,
        album: data.track.album || "Album not available",
        color: "violet",
        artworkUrl: data.track.artworkUrl,
        songLink: data.track.songLink,
        appleMusicUrl: data.track.appleMusicUrl,
        spotifyUrl: data.track.spotifyUrl,
        deezerUrl: data.track.deezerUrl,
        releaseDate: data.track.releaseDate,
        timecode: data.track.timecode,
      };

      setCurrentTrack(track);
      setHistory((previous) =>
        [{ ...track, discoveredAt: new Date().toISOString() }, ...previous.filter((item) => item.title !== track.title || item.artist !== track.artist)].slice(0, 30),
      );
      setNotice("Track identified successfully.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setIsRecognizing(false);
    }
  }

  async function handleFileSelection(file?: File) {
    if (!file) return;
    setSelectedFile(file.name);
    if (!file.type.toLowerCase().startsWith("audio/")) {
      setNotice("Choose a supported audio file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setNotice("The audio file is larger than 10 MB. Choose a shorter file.");
      return;
    }
    await recognizeAudio(file, file.name);
  }

  async function toggleRecording() {
    if (isRecording) {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      return;
    }
    if (isRecognizing) return;

    if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
      setNotice("Microphone recording is not supported by this browser. Upload an audio file instead.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const supportedTypes = [
        "audio/mp4",
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ];
      const mimeType = supportedTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        setIsRecording(false);
        if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        recordingTimerRef.current = null;
        recordingIntervalRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setNotice("The microphone recording failed. Try uploading an audio file.");
      };
      recorder.onstop = () => {
        setIsRecording(false);
        recorderRef.current = null;
        if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
        recordingTimerRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        const type = recorder.mimeType || "audio/webm";
        const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const recording = new Blob(chunks, { type });
        void recognizeAudio(recording, "echoid-recording." + extension);
      };

      recorder.start(250);
      setRecordingSeconds(0);
      setIsRecording(true);
      setNotice("Listening for up to 12 seconds. Tap the button again to stop early.");
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((seconds) => Math.min(seconds + 1, MAX_RECORDING_SECONDS));
      }, 1000);
      recordingTimerRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, MAX_RECORDING_SECONDS * 1000);
    } catch (error) {
      const message =
        error instanceof Error && error.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow microphone access or upload an audio file."
          : "Could not start the microphone. Check your browser permissions and try again.";
      setNotice(message);
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      recordingTimerRef.current = null;
      recordingIntervalRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }


  async function cloudAuth(action: "signup" | "signin") {
    if (!cloudConfigured) { setNotice("Configure Supabase URL and anon key first."); return; }
    if (!email.trim() || !password) { setNotice("Enter your email and password."); return; }
    setCloudBusy(true);
    try {
      const endpoint = action === "signup" ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password";
      const response = await fetch(cloudUrl + endpoint, { method: "POST", headers: { "Content-Type": "application/json", apikey: cloudAnonKey }, body: JSON.stringify({ email: email.trim(), password }), cache: "no-store" });
      const data = await response.json() as CloudSession & { msg?: string; error_description?: string; error?: string };
      if (!response.ok) throw new Error(data.msg || data.error_description || data.error || "Cloud authentication failed.");
      if (!data.access_token || !data.user?.id) { setNotice("Account created. Verify your email if required, then sign in."); return; }
      setCloudSession(data);
      window.localStorage.setItem("echoid:cloud-session", JSON.stringify(data));
      await loadCloudLibrary(data);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Cloud sign-in failed."); }
    finally { setCloudBusy(false); }
  }

  async function loadCloudLibrary(session = cloudSession) {
    if (!session || !cloudConfigured) return;
    setCloudBusy(true);
    try {
      const response = await fetch(cloudUrl + "/rest/v1/echoid_library?select=saved,history,playlists&user_id=eq." + encodeURIComponent(session.user.id) + "&limit=1", { headers: { apikey: cloudAnonKey, Authorization: "Bearer " + session.access_token }, cache: "no-store" });
      if (!response.ok) throw new Error("Cloud load failed. Check the Supabase table and RLS policies.");
      const rows = await response.json() as Array<{ saved?: Song[]; history?: Song[]; playlists?: unknown[] }>;
      if (rows[0]) { setSaved(Array.isArray(rows[0].saved) ? rows[0].saved : []); setHistory(Array.isArray(rows[0].history) ? rows[0].history : []); window.localStorage.setItem("echoid:playlists", JSON.stringify(Array.isArray(rows[0].playlists) ? rows[0].playlists : [])); setNotice("Cloud library loaded."); }
      else setNotice("Account connected. Sync your current library to create its cloud copy.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Cloud load failed."); }
    finally { setCloudBusy(false); }
  }

  async function syncCloudLibrary() {
    if (!cloudSession || !cloudConfigured) return;
    setCloudBusy(true);
    try {
      const response = await fetch(cloudUrl + "/rest/v1/echoid_library?on_conflict=user_id", {
        method: "POST",
        headers: { apikey: cloudAnonKey, Authorization: "Bearer " + cloudSession.access_token, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: cloudSession.user.id, saved, history, playlists: readStored<unknown[]>("echoid:playlists", []), updated_at: new Date().toISOString() }), cache: "no-store",
      });
      if (!response.ok) throw new Error("Cloud sync failed. Confirm the Supabase SQL schema and RLS policies.");
      setNotice("Library, history and playlists synced to your Supabase account.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Cloud sync failed."); }
    finally { setCloudBusy(false); }
  }

  function cloudSignOut() {
    setCloudSession(null); setPassword("");
    window.localStorage.removeItem("echoid:cloud-session");
    setNotice("Signed out. Local data remains on this device.");
  }

  async function runTextSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query.length < 3) {
      setNotice("Enter at least 3 characters to search.");
      return;
    }
    setSearchLoading(true);
    setSearchResults([]);
    setNotice("");
    try {
      const response = await fetch("/api/search?mode=" + mode.toLowerCase() + "&q=" + encodeURIComponent(query), { cache: "no-store" });
      const data = (await response.json()) as { message?: string; tracks?: Array<{ title: string; artist: string; album?: string; artworkUrl?: string; songLink?: string; releaseDate?: string; genre?: string; artistId?: number; artistUrl?: string; trackId?: number; trackTimeMillis?: number; lyricSnippet?: string }> };
      if (!response.ok) throw new Error(data.message || "Search failed.");
      const results = (data.tracks ?? []).map((track) => ({
        title: track.title,
        artist: track.artist,
        album: track.album || "Album not available",
        color: "violet",
        artworkUrl: track.artworkUrl,
        songLink: track.songLink,
        releaseDate: track.releaseDate,
        genre: track.genre,
        artistId: track.artistId,
        artistUrl: track.artistUrl,
        trackId: track.trackId,
        trackTimeMillis: track.trackTimeMillis,
        lyricSnippet: track.lyricSnippet,
      }));
      setSearchResults(results);
      setNotice(results.length ? "Found " + results.length + " result(s)." : "No matching tracks found. Try a shorter phrase or a few distinctive words.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Search failed. Please try again.");
    } finally {
      setSearchLoading(false);
    }
  }

  function selectSearchResult(song: Song) {
    setCurrentTrack(song);
    setHistory((previous) =>
      [{ ...song, discoveredAt: new Date().toISOString() }, ...previous.filter((item) => item.title !== song.title || item.artist !== song.artist)].slice(0, 30),
    );
    setNotice("Track added to your discovery history.");
  }

  function toggleSaved(song: Song) {
    setSaved((previous) =>
      previous.some((item) => item.title === song.title && item.artist === song.artist)
        ? previous.filter((item) => item.title !== song.title || item.artist !== song.artist)
        : [song, ...previous],
    );
  }

  function clearLocalData() {
    setSaved([]);
    setHistory([]);
    window.localStorage.removeItem("echoid:playlists");
    setNotice("Saved songs, playlists and discovery history have been cleared from this browser.");
  }

  const nav = (target: Page, Icon: typeof Search) => (
    <button
      className={"nav-item " + (page === target ? "active" : "")}
      onClick={() => {
        setPage(target);
        setNotice("");
      }}
    >
      <Icon size={17} />
      {t(target)}
    </button>
  );

  const filteredSaved = saved.filter((song) =>
    `${song.title} ${song.artist} ${song.album}`.toLocaleLowerCase().includes(libraryQuery.trim().toLocaleLowerCase()),
  );

  return (
    <main className={"app-shell " + (dark ? "" : "light-theme")}>
      <aside className="sidebar">
        <button className="brand" onClick={() => { setPage("Discover"); setNotice(""); }}>
          <span className="brand-mark"><EchoMark /></span>
          <span>echo<span className="brand-light">id</span></span>
        </button>
        <div className="side-label">{t("WORKSPACE")}</div>
        <nav className="side-nav">
          {nav("Discover", Search)}
          {nav("Your library", Library)}
          {nav("History", HistoryIcon)}
          <a className="nav-item" href="/intelligence"><Sparkles size={17} /> {t("Intelligence")}</a>
          <a className="nav-item" href="/playlists"><Library size={17} /> {t("Playlists")}</a>
          <a className="nav-item" href="/statistics"><HistoryIcon size={17} /> {t("Statistics")}</a>
          <a className="nav-item" href="/hum"><Mic size={17} /> {t("Hum 2.0")}</a>
          <a className="nav-item" href="/profile"><UserRound size={17} /> {t("Public profile")}</a>
        </nav>
        <div className="side-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon"><Sparkles size={17} /></div>
            <strong>{t("Find your next favorite")}</strong>
            <p>{t("Explore music beyond the songs you already know.")}</p>
            <button onClick={() => setPage("Discover")}>{t("Explore discovery")} <ArrowUpRight size={14} /></button>
          </div>
          {nav("Settings", Settings2)}
          {nav("Account", UserRound)}
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div className="breadcrumb">{t("WORKSPACE")} <span>/</span> <strong>{t(page)}</strong></div>
          <span className={"status-pill " + (providerConfigured ? "status-ready" : "status-pending")}>
            <i /> {providerConfigured ? "AudD connected" : "AudD token required"}
          </span>
        </header>

        <div className="content-wrap">
          {page === "Discover" && (
            <>
              <div className="hero-heading">
                <div>
                  <div className="eyebrow"><span /> {t("MUSIC DISCOVERY, REIMAGINED")}</div>
                  <h1>{t("Every song has")}<br /><span>{t("a story.")}</span></h1>
                  <p>{t("Identify the music playing around you. Record a short sample or upload an audio clip to discover the track.")}</p>
                </div>
                <div className="hero-art">
                  <div className="orb orb-one" />
                  <div className="orb orb-two" />
                  <div className="orb-core"><EchoMark size={35} /></div>
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                </div>
              </div>

              <section className="search-card">
                <div className="mode-tabs">
                  {(["Sound", "Lyrics", "Hum", "Describe"] as SearchMode[]).map((item) => (
                    <button
                      key={item}
                      className={"mode-tab " + (mode === item ? "selected" : "")}
                      onClick={() => {
                        setMode(item);
                        setNotice("");
                        setSearchResults([]);
                      }}
                    >
                      {item === "Sound" ? <AudioLines size={16} /> : item === "Lyrics" ? <Search size={16} /> : item === "Hum" ? <Mic size={16} /> : <Sparkles size={16} />}
                      {t(item)}
                    </button>
                  ))}
                </div>

                <div className="search-body">
                  {mode === "Sound" ? (
                    <>
                      <div className={"listen-button " + (isRecording ? "listening" : "")}>
                        <button
                          onClick={toggleRecording}
                          disabled={isRecognizing}
                          aria-label={isRecording ? "Stop recording and identify" : "Start recording to identify music"}
                        >
                          {isRecognizing ? <LoaderCircle size={27} className="spin" /> : isRecording ? <Check size={29} /> : <AudioLines size={29} />}
                        </button>
                        <span className="pulse pulse-a" />
                        <span className="pulse pulse-b" />
                      </div>
                      <h2>{isRecognizing ? "Listening to your sample…" : isRecording ? "Capturing the sound…" : "What’s that song?"}</h2>
                      <p>{isRecording ? `${t("Recording in progress")} · ${recordingSeconds}s / ${MAX_RECORDING_SECONDS}s · ${t("Tap to identify now")}` : "Tap to record up to 12 seconds of music from your surroundings."}</p>
                      {isRecording && <div className="recording-progress" role="progressbar" aria-label={t("Recording progress")} aria-valuemin={0} aria-valuemax={MAX_RECORDING_SECONDS} aria-valuenow={recordingSeconds}><span style={{ width: `${(recordingSeconds / MAX_RECORDING_SECONDS) * 100}%` }} /></div>}
                      <div className="search-divider"><span>OR UPLOAD A CLIP</span></div>
                      <label className={"upload-button " + (isRecognizing || isRecording ? "is-disabled" : "")}>
                        <Upload size={16} /> Upload an audio file <span>MP3, WAV, M4A · max 10 MB</span>
                        <input
                          type="file"
                          accept="audio/*"
                          hidden
                          disabled={isRecognizing || isRecording}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            void handleFileSelection(file);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                      {selectedFile && <p className="selected-file"><Check size={13} /> {selectedFile}</p>}
                      <p className="privacy-note"><ShieldCheck size={13} /> Your sample is sent to AudD for identification. EchoID does not save the audio file.</p>
                    </>
                  ) : mode === "Hum" ? (
                    <>
                      <div className={"listen-button " + (isRecording ? "listening" : "")}>
                        <button onClick={toggleRecording} disabled={isRecognizing} aria-label={isRecording ? "Stop humming capture" : "Record a hummed melody"}>
                          {isRecognizing ? <LoaderCircle size={27} className="spin" /> : isRecording ? <Check size={29} /> : <Mic size={29} />}
                        </button>
                        <span className="pulse pulse-a" /><span className="pulse pulse-b" />
                      </div>
                      <h2>{isRecording ? "Recording your melody…" : "Hum a melody."}</h2>
                      <p>{isRecording ? `${t("Recording in progress")} · ${recordingSeconds}s / ${MAX_RECORDING_SECONDS}s · ${t("Tap to identify now")}` : "Record up to 12 seconds of humming. AudD is optimized for recorded music, so humming matches are experimental and not guaranteed."}</p>
                      {isRecording && <div className="recording-progress" role="progressbar" aria-label={t("Recording progress")} aria-valuemin={0} aria-valuemax={MAX_RECORDING_SECONDS} aria-valuenow={recordingSeconds}><span style={{ width: `${(recordingSeconds / MAX_RECORDING_SECONDS) * 100}%` }} /></div>}
                      <p className="privacy-note"><ShieldCheck size={13} /> Your recording is sent to AudD only after you start capture.</p>
                    </>
                  ) : (
                    <>
                      <div className="text-search-icon">{mode === "Lyrics" ? <Search size={21} /> : <Sparkles size={21} />}</div>
                      <h2>{mode === "Lyrics" ? "Search by lyrics." : "Describe the song."}</h2>
                      <p>{mode === "Lyrics" ? "Enter a line or phrase you remember." : "Describe the sound, mood, genre, instruments, or any words you recall."}</p>
                      <form className="query-box" onSubmit={runTextSearch}>
                        <textarea value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={mode === "Lyrics" ? "Type a lyric fragment…" : "e.g. upbeat 2000s pop with a piano intro…"} rows={2} maxLength={300} aria-label={mode === "Lyrics" ? "Lyrics search" : "Song description"} />
                        <button type="submit" disabled={searchLoading} aria-label="Search music">{searchLoading ? <LoaderCircle size={17} className="spin" /> : <Search size={17} />}</button>
                      </form>
                      {searchResults.length > 0 && (
                        <div className="result-list" style={{ width: "min(560px, 100%)", marginTop: 18, textAlign: "left" }}>
                          {searchResults.map((song, index) => (
                            <article className="result-row" key={song.title + song.artist + index}>
                              <Cover song={song} />
                              <div className="song-meta"><strong>{song.title}</strong><span>{song.artist}{song.album ? " · " + song.album : ""}{song.lyricSnippet ? " — “" + song.lyricSnippet + "”" : ""}</span></div>
                              <button className="round-action" onClick={() => selectSearchResult(song)} aria-label={"Open " + song.title}><ArrowUpRight size={16} /></button>
                            </article>
                          ))}
                        </div>
                      )}
                      <p className="privacy-note"><ShieldCheck size={13} /> Lyrics search uses LRCLIB. Description search uses the Apple Music catalog. Results depend on provider coverage.</p>
                    </>
                  )}

                  {notice && (
                    <div className="inline-notice" role="status">
                      <span>{notice}</span>
                      <button onClick={() => setNotice("")} aria-label="Dismiss message"><X size={14} /></button>
                    </div>
                  )}
                </div>
                <div className="card-footer">
                  <span><span className="privacy-dot" /> Audio sent only when you start recognition</span>
                  <span>Powered by AudD</span>
                </div>
              </section>

              {currentTrack && (
                <section className="results-section">
                  <div className="section-head">
                    <div>
                      <h3>Identified track</h3>
                      <p>Recognized by AudD audio fingerprinting</p>
                    </div>
                    <button className="text-link" onClick={() => setCurrentTrack(null)}>Clear <X size={14} /></button>
                  </div>
                  <article className="recognized-track">
                    <Cover song={currentTrack} large />
                    <div className="recognized-meta">
                      <span className="match-label"><Check size={13} /> IDENTIFIED</span>
                      <h2>{currentTrack.title}</h2>
                      <p>{currentTrack.artist}</p>
                      <span className="album-line">{currentTrack.album}{currentTrack.releaseDate ? " · " + currentTrack.releaseDate.slice(0, 4) : ""}</span>
                      <div className="track-actions">
                        <button className="primary-button" onClick={() => toggleSaved(currentTrack)}>
                          {saved.some((item) => item.title === currentTrack.title && item.artist === currentTrack.artist) ? <Heart size={15} fill="currentColor" /> : <Bookmark size={15} />}
                          {saved.some((item) => item.title === currentTrack.title && item.artist === currentTrack.artist) ? "Saved" : "Save track"}
                        </button>
                        {currentTrack.songLink && (
                          <a className="secondary-button" href={currentTrack.songLink} target="_blank" rel="noreferrer">
                            Open track <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                      <div className="streaming-links">
                        {currentTrack.spotifyUrl && <a href={currentTrack.spotifyUrl} target="_blank" rel="noreferrer">Spotify <ExternalLink size={12} /></a>}
                        {currentTrack.appleMusicUrl && <a href={currentTrack.appleMusicUrl} target="_blank" rel="noreferrer">Apple Music <ExternalLink size={12} /></a>}
                        {currentTrack.deezerUrl && <a href={currentTrack.deezerUrl} target="_blank" rel="noreferrer">Deezer <ExternalLink size={12} /></a>}
                      </div>
                    </div>
                  </article>
                </section>
              )}

              <section className="below-grid">
                <div className="section-head">
                  <div><h3>Your discovery space</h3><p>Saved songs and recent finds appear in your library.</p></div>
                  <button className="text-link" onClick={() => setPage("History")}>View history <ArrowUpRight size={14} /></button>
                </div>
                <div className="empty-library">
                  <div className="empty-icon"><Bookmark size={21} /></div>
                  <div>
                    <strong>{saved.length ? saved.length + " songs saved to your library." : "Your next favorite is out there."}</strong>
                    <p>{history.length ? "You have identified " + history.length + " track(s) on this device." : "Identify a song to start building your personal music library."}</p>
                  </div>
                  <Check size={15} />
                </div>
              </section>
            </>
          )}

          {page === "Your library" && (
            <section className="page-panel">
              <div className="page-title">
                <div className="eyebrow"><span /> YOUR COLLECTION</div>
                <h1>Your <span>library.</span></h1>
                <p>The songs you save, all in one place on this device.</p>
              </div>
              <div className="library-toolbar">
                <span><Bookmark size={16} /> {saved.length} saved songs</span>
                <div className="library-actions">
                  {saved.length > 0 && <label className="library-search"><Search size={15} /><input value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder={t("Search songs or artists")} aria-label={t("Search saved songs")} />{libraryQuery && <button type="button" onClick={() => setLibraryQuery("")} aria-label={t("Clear search")}><X size={14} /></button>}</label>}
                  <button className="secondary-button" onClick={() => setPage("Discover")}><Search size={15} /> Discover music</button>
                </div>
              </div>
              {saved.length > 0 && filteredSaved.length > 0 ? (
                <div className="result-list">
                  {filteredSaved.map((song) => (
                    <article className="result-row" key={song.title + song.artist}>
                      <Cover song={song} />
                      <div className="song-meta"><strong>{song.title}</strong><span>{song.artist} · {song.album}</span></div>
                      <button className="round-action" onClick={() => toggleSaved(song)} aria-label="Remove saved song"><Heart size={17} fill="currentColor" /></button>
                    </article>
                  ))}
                </div>
              ) : saved.length > 0 ? (
                <div className="empty-state compact-empty">
                  <div className="empty-icon"><Search size={23} /></div>
                  <h2>{t("No matching songs")}</h2>
                  <p>{t("Try another title or artist, or clear your search.")}</p>
                  <button className="secondary-button" onClick={() => setLibraryQuery("")}>{t("Clear search")}</button>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon"><Library size={24} /></div>
                  <h2>Your library starts here.</h2>
                  <p>Identify a song and save it to keep it in your collection.</p>
                  <button className="primary-button" onClick={() => setPage("Discover")}>Find a song <ArrowUpRight size={16} /></button>
                </div>
              )}
            </section>
          )}

          {page === "History" && (
            <section className="page-panel">
              <div className="page-title">
                <div className="eyebrow"><span /> RECENT DISCOVERIES</div>
                <h1>Your <span>history.</span></h1>
                <p>Pick up where your music discovery left off.</p>
              </div>
              <div className="library-toolbar">
                <span><Clock3 size={16} /> {history.length} recent discoveries</span>
                <button className="text-link" onClick={() => setHistory([])}><Trash2 size={14} /> Clear history</button>
              </div>
              {history.length ? (
                <div className="result-list">
                  {history.map((song) => (
                    <article className="result-row" key={song.title + song.artist}>
                      <Cover song={song} />
                      <div className="song-meta"><strong>{song.title}</strong><span>{song.artist} · {song.album}</span></div>
                      <button className="round-action" onClick={() => toggleSaved(song)} aria-label="Save song">
                        {saved.some((item) => item.title === song.title && item.artist === song.artist) ? <Heart size={17} fill="currentColor" /> : <Bookmark size={17} />}
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon"><HistoryIcon size={24} /></div>
                  <h2>No discoveries yet.</h2>
                  <p>Identified songs will be collected here on this device.</p>
                  <button className="primary-button" onClick={() => setPage("Discover")}>Start identifying <ArrowUpRight size={16} /></button>
                </div>
              )}
            </section>
          )}

          {page === "Settings" && (
            <section className="page-panel">
              <div className="page-title">
                <div className="eyebrow"><span /> PERSONALIZE ECHOID</div>
                <h1>Make it <span>yours.</span></h1>
                <p>Manage your experience and your local data.</p>
              </div>
              <div className="settings-list">
                <div className="settings-row">
                  <div className="settings-symbol"><SlidersHorizontal size={18} /></div>
                  <div className="settings-copy"><strong>Appearance</strong><span>Choose how EchoID looks on this device.</span></div>
                  <button className="toggle-control" onClick={() => setDark((value) => !value)}>{dark ? "Dark" : "Light"}</button>
                </div>
                <div className="settings-row">
                  <div className="settings-symbol"><ShieldCheck size={18} /></div>
                  <div className="settings-copy">
                    <strong>Audio privacy</strong>
                    <span>Audio is forwarded to AudD only when you start recognition. EchoID does not store the recording.</span>
                  </div>
                  <span className="settings-status">On demand</span>
                </div>
                <div className="settings-row">
                  <div className="settings-symbol"><Globe size={18} /></div>
                  <div className="settings-copy"><strong>Language</strong><span>Choose your preferred interface language.</span></div>
                  <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                    <option>English</option><option>Italiano</option><option>Español</option>
                  </select>
                </div>
                <div className="settings-row">
                  <div className="settings-symbol"><Trash2 size={18} /></div>
                  <div className="settings-copy"><strong>Clear local data</strong><span>Remove saved songs, recent searches, and profile details from this browser.</span></div>
                  <button className="danger-button" onClick={() => { clearLocalData(); setName(""); setEmail(""); }}>Clear data</button>
                </div>
              </div>
              {notice && <div className="inline-notice page-notice">{notice}</div>}
            </section>
          )}

          {page === "Account" && (
            <section className="page-panel">
              <div className="page-title">
                <div className="eyebrow"><span /> YOUR ECHOID PROFILE</div>
                <h1>Your music, <span>your space.</span></h1>
                <p>A local guest profile saved only in this browser.</p>
              </div>
              <div className="account-card">
                <div className="account-avatar"><UserRound size={30} /></div>
                <h2>{cloudSession ? "Cloud account connected" : "Your EchoID account"}</h2>
                <p>{cloudSession ? "Signed in as " + (cloudSession.user.email || email) : "Sign in or create an account to sync your music library."}</p>
                {!cloudSession && <>
                  <label>Display name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name (optional)" /></label>
                  <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
                  <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" autoComplete="current-password" /></label>
                  <div className="track-actions">
                    <button className="primary-button" disabled={cloudBusy} onClick={() => void cloudAuth("signin")}>{cloudBusy ? "Please wait…" : "Sign in"}</button>
                    <button className="secondary-button" disabled={cloudBusy} onClick={() => void cloudAuth("signup")}>Create account</button>
                  </div>
                </>}
                {cloudSession && <div className="track-actions">
                  <button className="primary-button" disabled={cloudBusy} onClick={() => void syncCloudLibrary()}>{cloudBusy ? "Syncing…" : "Sync library now"}</button>
                  <button className="secondary-button" disabled={cloudBusy} onClick={() => void loadCloudLibrary()}>Load cloud library</button>
                  <button className="danger-button" onClick={cloudSignOut}>Sign out</button>
                </div>}
                <div className="inline-notice">{cloudConfigured ? "Supabase is configured. Apply the SQL setup in README and enable email authentication." : "Cloud sync needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the environment. Never use a service-role key in the browser."}</div>
                <div className="track-actions"><a className="secondary-button" href="/profile">Public profile</a><a className="secondary-button" href="/playlists">Manage playlists</a></div>
              </div>
            </section>
          )}

          <footer className="page-footer">
            <span>© 2026 EchoID</span>
            <span>Music discovery, with a little more feeling.</span>
            <span>Audio recognition · AudD</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
