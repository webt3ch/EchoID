"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
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
  SlidersHorizontal,
  UserRound,
  ExternalLink,
  Disc3,
  LoaderCircle,
} from "lucide-react";

type Page = "Discover" | "Your library" | "History" | "Settings" | "Account";
type SearchMode = "Sound" | "Lyrics" | "Hum" | "Describe";
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
};

// Leave room for multipart boundaries under Vercel's 4.5 MB default request cap.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_RECORDING_SECONDS = 12;

function trackKey(song: Pick<Song, "title" | "artist">) {
  return `${song.title.trim().toLocaleLowerCase()}::${song.artist.trim().toLocaleLowerCase()}`;
}

function safeExternalUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function Cover({ song, large = false }: { song: Song; large?: boolean }) {
  return (
    <div
      className={"cover " + song.color + (large ? " cover-large" : "")}
      role="img"
      aria-label={`${song.title} by ${song.artist} cover artwork`}
    >
      {song.artworkUrl ? <Image src={song.artworkUrl} alt="" width={600} height={600} unoptimized /> : <Music2 size={24} />}
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

function readStoredSongs(key: string): Song[] {
  const value = readStored<unknown>(key, []);
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate): Song[] => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Partial<Song>;
    if (typeof item.title !== "string" || typeof item.artist !== "string") return [];
    const allowedColors = ["violet", "blue", "orange"];
    return [{
      title: item.title.trim().slice(0, 200),
      artist: item.artist.trim().slice(0, 200),
      album: typeof item.album === "string" ? item.album.slice(0, 200) : "Album not available",
      color: allowedColors.includes(item.color ?? "") ? item.color! : "violet",
      artworkUrl: safeExternalUrl(item.artworkUrl),
      songLink: safeExternalUrl(item.songLink),
      appleMusicUrl: safeExternalUrl(item.appleMusicUrl),
      spotifyUrl: safeExternalUrl(item.spotifyUrl),
      deezerUrl: safeExternalUrl(item.deezerUrl),
      releaseDate: typeof item.releaseDate === "string" ? item.releaseDate.slice(0, 32) : undefined,
      timecode: typeof item.timecode === "string" ? item.timecode.slice(0, 32) : undefined,
    }];
  }).filter((song) => song.title.length > 0 && song.artist.length > 0)
    .slice(0, key === "echoid:history" ? 30 : 200);
}

export default function Home() {
  const [page, setPage] = useState<Page>("Discover");
  const [mode, setMode] = useState<SearchMode>("Sound");
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState<Song[]>([]);
  const [history, setHistory] = useState<Song[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Song | null>(null);
  const [dark, setDark] = useState(true);
  const [name, setName] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSaved(readStoredSongs("echoid:saved"));
    setHistory(readStoredSongs("echoid:history"));
    setDark(readStored<unknown>("echoid:dark", true) === false ? false : true);
    const storedName = readStored<unknown>("echoid:name", "");
    setName(typeof storedName === "string" ? storedName.slice(0, 60) : "");
    try {
      window.localStorage.removeItem("echoid:email");
      window.localStorage.removeItem("echoid:language");
    } catch {
      // Storage may be unavailable; the rest of the app remains usable.
    }
    setStorageReady(true);

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
      window.localStorage.setItem("echoid:name", JSON.stringify(name));
    } catch {
      setNotice("This browser could not save local data. Check its storage settings.");
    }
  }, [saved, history, dark, name, storageReady]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
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
      setNotice("The audio file is larger than 4 MB. Choose a shorter or smaller file.");
      return;
    }

    setIsRecognizing(true);
    setCurrentTrack(null);
    setNotice("Sending your sample to AudD for identification…");

    try {
      const body = new FormData();
      body.append("audio", audio, filename);
      const response = await fetch("/api/recognize", {
        method: "POST",
        body,
        cache: "no-store",
      });
      let data: {
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
      try {
        data = (await response.json()) as typeof data;
      } catch {
        throw new Error("The recognition service returned an invalid response. Try again.");
      }

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
        artworkUrl: safeExternalUrl(data.track.artworkUrl),
        songLink: safeExternalUrl(data.track.songLink),
        appleMusicUrl: safeExternalUrl(data.track.appleMusicUrl),
        spotifyUrl: safeExternalUrl(data.track.spotifyUrl),
        deezerUrl: safeExternalUrl(data.track.deezerUrl),
        releaseDate: data.track.releaseDate,
        timecode: data.track.timecode,
      };

      setCurrentTrack(track);
      setHistory((previous) =>
        [track, ...previous.filter((item) => trackKey(item) !== trackKey(track))].slice(0, 30),
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
      setNotice("The audio file is larger than 4 MB. Choose a shorter or smaller file.");
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
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setNotice("The microphone recording failed. Try uploading an audio file.");
      };
      recorder.onstop = () => {
        setIsRecording(false);
        recorderRef.current = null;
        if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        const type = recorder.mimeType || "audio/webm";
        const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const recording = new Blob(chunks, { type });
        void recognizeAudio(recording, "echoid-recording." + extension);
      };

      recorder.start(250);
      setIsRecording(true);
      setNotice("Listening for up to 12 seconds. Tap the button again to stop early.");
      recordingTimerRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, MAX_RECORDING_SECONDS * 1000);
    } catch (error) {
      const message =
        error instanceof Error && error.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow microphone access or upload an audio file."
          : "Could not start the microphone. Check your browser permissions and try again.";
      setNotice(message);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  function toggleSaved(song: Song) {
    const alreadySaved = saved.some((item) => trackKey(item) === trackKey(song));
    if (!alreadySaved && saved.length >= 200) {
      setNotice("Your local library is full. Remove a saved track before adding another.");
      return;
    }
    setSaved((previous) =>
      previous.some((item) => trackKey(item) === trackKey(song))
        ? previous.filter((item) => trackKey(item) !== trackKey(song))
        : [song, ...previous],
    );
  }

  function clearLocalData() {
    setSaved([]);
    setHistory([]);
    setName("");
    setNotice("Saved songs, discovery history, and profile name have been cleared from this browser.");
  }

  const nav = (target: Page, Icon: typeof Search, label: string = target) => (
    <button
      className={"nav-item " + (page === target ? "active" : "")}
      aria-current={page === target ? "page" : undefined}
      aria-label={label}
      onClick={() => {
        setPage(target);
        setNotice("");
      }}
    >
      <Icon size={17} />
      <span className="nav-label">{label}</span>
    </button>
  );

  return (
    <main className={"app-shell " + (dark ? "" : "light-theme")}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar">
        <button className="brand" onClick={() => setPage("Discover")}>
          <span className="brand-mark"><AudioLines size={21} /></span>
          <span>echo<span className="brand-light">id</span></span>
        </button>
        <div className="side-label">YOUR MUSIC</div>
        <nav className="side-nav" aria-label="Workspace">
          {nav("Discover", Search)}
          {nav("Your library", Library)}
          {nav("History", HistoryIcon)}
        </nav>
        <div className="side-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon"><ShieldCheck size={17} /></div>
            <strong>Listen when you choose</strong>
            <p>EchoID records only after you start a recognition.</p>
            <button className="privacy-settings-link" onClick={() => setPage("Settings")}>Audio &amp; privacy <ArrowUpRight size={14} /></button>
          </div>
          {nav("Settings", Settings2)}
          {nav("Account", UserRound)}
        </div>
      </aside>

      <section className="main-content" id="main-content">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <strong>{page}</strong></div>
          <span className={"status-pill " + (providerConfigured ? "status-ready" : "status-pending")}>
            <i /> {providerConfigured ? "AudD configured" : "AudD token required"}
          </span>
        </header>

        <div className="content-wrap">
          {page === "Discover" && (
            <>
              <div className="hero-heading">
                <div>
                  <h1>Find the song<br />in the room.</h1>
                  <p>Record a short sample or upload an audio clip to identify the music and open it in your streaming service.</p>
                </div>
              </div>

              <section className="search-card">
                <div className="mode-tabs" role="group" aria-label="Choose a recognition method">
                  {(["Sound", "Lyrics", "Hum", "Describe"] as SearchMode[]).map((item) => (
                    <button
                      key={item}
                      className={"mode-tab " + (mode === item ? "selected" : "")}
                      aria-pressed={mode === item}
                      onClick={() => {
                        setMode(item);
                        setNotice(item === "Sound" ? "" : item + " search is not connected yet. Audio recognition is available in Sound mode.");
                      }}
                    >
                      {item === "Sound" ? <AudioLines size={16} /> : item === "Lyrics" ? <Search size={16} /> : item === "Hum" ? <Mic size={16} /> : <Sparkles size={16} />}
                      {item}
                    </button>
                  ))}
                </div>

                <div className="search-body">
                  {mode === "Sound" ? (
                    <>
                      <div className={"listen-button " + (isRecording ? "listening" : "")}>
                        <button
                          onClick={toggleRecording}
                          disabled={isRecognizing || (!isRecording && !providerConfigured)}
                          aria-label={isRecording ? "Stop recording and identify" : isRecognizing ? "Identifying your track" : "Start recording to identify music"}
                        >
                          {isRecognizing ? <LoaderCircle size={27} className="spin" /> : isRecording ? <Check size={29} /> : <AudioLines size={29} />}
                        </button>
                        <span className="pulse pulse-a" />
                        <span className="pulse pulse-b" />
                      </div>
                      <h2>{isRecognizing ? "Identifying the track…" : isRecording ? "Capturing the sound…" : "What’s that song?"}</h2>
                      <p>{isRecording ? "Tap the button to stop and identify, or wait for the 12-second capture." : "Tap to record up to 12 seconds of music from your surroundings."}</p>
                      {!providerConfigured && !isRecording && !isRecognizing && (
                        <p className="setup-hint">Recognition is unavailable until the server has an AUDD_API_TOKEN.</p>
                      )}
                      <div className="search-divider"><span>OR UPLOAD A CLIP</span></div>
                      <label className={"upload-button " + (isRecognizing || isRecording || !providerConfigured ? "is-disabled" : "")}>
                        <Upload size={16} /> Upload an audio file <span>MP3, WAV, M4A · max 4 MB</span>
                        <input
                          type="file"
                          accept="audio/*"
                          className="file-input"
                          disabled={isRecognizing || isRecording || !providerConfigured}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            void handleFileSelection(file);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                      {selectedFile && <p className="selected-file"><Check size={13} /> {selectedFile}</p>}
                      <p className="privacy-note"><ShieldCheck size={13} /> A recording or chosen file is sent to AudD. EchoID does not save the audio file.</p>
                    </>
                  ) : (
                    <>
                      <div className="text-search-icon">
                        {mode === "Lyrics" ? <Search size={21} /> : mode === "Hum" ? <Mic size={21} /> : <Sparkles size={21} />}
                      </div>
                      <h2>{mode === "Lyrics" ? "Search by lyrics." : mode === "Hum" ? "Hum the melody." : "Describe the song."}</h2>
                      <p>This discovery method is not connected yet.</p>
                      <div className="feature-placeholder">
                        <Disc3 size={20} />
                        <span>Available now: real audio identification in Sound mode.</span>
                      </div>
                      <button className="secondary-button" onClick={() => setMode("Sound")}>
                        <AudioLines size={15} /> Switch to sound recognition
                      </button>
                    </>
                  )}

                  {notice && (
                    <div className="inline-notice" role="status" aria-live="polite" aria-atomic="true">
                      <span>{notice}</span>
                      <button onClick={() => setNotice("")} aria-label="Dismiss message"><X size={14} /></button>
                    </div>
                  )}
                </div>
                <div className="card-footer">
                  <span><span className="privacy-dot" /> Audio sent only when you record or choose a file</span>
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
                        <button className="primary-button" aria-pressed={saved.some((item) => trackKey(item) === trackKey(currentTrack))} onClick={() => toggleSaved(currentTrack)}>
                          {saved.some((item) => trackKey(item) === trackKey(currentTrack)) ? <Heart size={15} fill="currentColor" /> : <Bookmark size={15} />}
                          {saved.some((item) => trackKey(item) === trackKey(currentTrack)) ? "Saved" : "Save track"}
                        </button>
                        {currentTrack.songLink && (
                          <a className="secondary-button" href={currentTrack.songLink} target="_blank" rel="noopener noreferrer">
                            Open track <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                      <div className="streaming-links">
                        {currentTrack.spotifyUrl && <a href={currentTrack.spotifyUrl} target="_blank" rel="noopener noreferrer">Spotify <ExternalLink size={12} /></a>}
                        {currentTrack.appleMusicUrl && <a href={currentTrack.appleMusicUrl} target="_blank" rel="noopener noreferrer">Apple Music <ExternalLink size={12} /></a>}
                        {currentTrack.deezerUrl && <a href={currentTrack.deezerUrl} target="_blank" rel="noopener noreferrer">Deezer <ExternalLink size={12} /></a>}
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
                <button className="secondary-button" onClick={() => setPage("Discover")}><Search size={15} /> Discover music</button>
              </div>
              {saved.length ? (
                <div className="result-list">
                  {saved.map((song) => (
                    <article className="result-row" key={song.title + song.artist}>
                      <Cover song={song} />
                      <div className="song-meta"><strong>{song.title}</strong><span>{song.artist} · {song.album}</span></div>
                      <button className="round-action" onClick={() => toggleSaved(song)} aria-label={`Remove ${song.title} from saved songs`}><Heart size={17} fill="currentColor" /></button>
                    </article>
                  ))}
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
                <button className="text-link" onClick={() => { setHistory([]); setNotice("Discovery history has been cleared from this browser."); }}><Trash2 size={14} /> Clear history</button>
              </div>
              {history.length ? (
                <div className="result-list">
                  {history.map((song) => (
                    <article className="result-row" key={song.title + song.artist}>
                      <Cover song={song} />
                      <div className="song-meta"><strong>{song.title}</strong><span>{song.artist} · {song.album}</span></div>
                      <button className="round-action" onClick={() => toggleSaved(song)} aria-label={saved.some((item) => trackKey(item) === trackKey(song)) ? `Remove ${song.title} from saved songs` : `Save ${song.title}`}>
                        {saved.some((item) => trackKey(item) === trackKey(song)) ? <Heart size={17} fill="currentColor" /> : <Bookmark size={17} />}
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
                  <button className="toggle-control" aria-pressed={dark} onClick={() => setDark((value) => !value)}>{dark ? "Dark" : "Light"}</button>
                </div>
                <div className="settings-row">
                  <div className="settings-symbol"><ShieldCheck size={18} /></div>
                  <div className="settings-copy">
                    <strong>Audio privacy</strong>
                    <span>Audio is sent to AudD only after you start recording or choose a file. EchoID does not store the recording.</span>
                  </div>
                  <span className="settings-status">On demand</span>
                </div>
                <div className="settings-row">
                  <div className="settings-symbol"><Trash2 size={18} /></div>
                  <div className="settings-copy"><strong>Clear local data</strong><span>Remove saved songs, discovery history, and your optional display name from this browser.</span></div>
                  <button className="danger-button" onClick={clearLocalData}>Clear data</button>
                </div>
              </div>
              <section className="settings-privacy" aria-labelledby="data-handling-title">
                <h2 id="data-handling-title">How audio and local data are handled</h2>
                <p>EchoID sends a recording or selected audio file to its server, which forwards it to AudD for recognition. EchoID does not save the audio. AudD processes the sample under its own policies and terms; its standard endpoint analyzes about 12 seconds per request.</p>
                <p>Saved tracks, the last 30 unique discoveries, your optional display name, and appearance preference stay in this browser. They are not synced to an account. Use <strong>Clear data</strong> above to remove saved tracks, history, and your display name.</p>
                <div className="settings-privacy-links">
                  <a href="https://docs.audd.io/" target="_blank" rel="noopener noreferrer">AudD documentation <ExternalLink size={13} /></a>
                  <a href="https://audd.io/privacy/index.php" target="_blank" rel="noopener noreferrer">AudD privacy policy <ExternalLink size={13} /></a>
                  <a href="https://audd.io/legal/terms/" target="_blank" rel="noopener noreferrer">AudD API terms <ExternalLink size={13} /></a>
                </div>
              </section>
              {notice && <div className="inline-notice page-notice" role="status" aria-live="polite">{notice}</div>}
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
                <h2>{name.trim() || "Guest profile"}</h2>
                <p>No account is created. Your display name stays in this browser.</p>
                <label>Display name<input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>
                <div className="inline-notice">This profile is local only. Cloud sync and sign-in are not enabled.</div>
              </div>
            </section>
          )}

          <footer className="page-footer">
            <span>© 2026 EchoID</span>
            <span>Music discovery, with a little more feeling.</span>
            <span>Audio recognition · AudD</span>
            <button className="privacy-footer-link" onClick={() => setPage("Settings")}>Audio &amp; privacy</button>
          </footer>
        </div>
      </section>
      <nav className="mobile-nav" aria-label="Main navigation">
        {nav("Discover", Search)}
        {nav("Your library", Library, "Library")}
        {nav("History", HistoryIcon)}
        {nav("Settings", Settings2)}
        {nav("Account", UserRound)}
      </nav>
    </main>
  );
}
