"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AudioLines, Mic, Square, Waves } from "lucide-react";

const NOTES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.012) return null;

  let start = 0;
  let end = buffer.length - 1;
  while (start < buffer.length / 2 && Math.abs(buffer[start]) < 0.15) start++;
  while (end > buffer.length / 2 && Math.abs(buffer[end]) < 0.15) end--;
  const size = end - start;
  if (size < 32) return null;

  const minLag = Math.floor(sampleRate / 900);
  const maxLag = Math.min(Math.floor(sampleRate / 75), size - 1);
  let bestLag = -1;
  let bestCorrelation = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let correlation = 0;
    for (let i = 0; i < size - lag; i++) correlation += buffer[start + i] * buffer[start + i + lag];
    correlation /= size - lag;
    if (correlation > bestCorrelation) { bestCorrelation = correlation; bestLag = lag; }
  }
  if (bestLag < 0 || bestCorrelation < 0.01) return null;
  return sampleRate / bestLag;
}

function frequencyToNote(frequency: number): string {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const octave = Math.floor(midi / 12) - 1;
  return NOTES[((midi % 12) + 12) % 12] + octave;
}

export default function HumLabPage() {
  const [recording, setRecording] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const startedRef = useRef(0);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) { setNotice("Microphone access is unavailable in this browser."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 4096;
      source.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      streamRef.current = stream; contextRef.current = context; startedRef.current = Date.now();
      setNotes([]); setRecording(true); setNotice("Listening for a single-note melodic contour. Keep humming clearly.");
      const tick = () => {
        analyser.getFloatTimeDomainData(samples);
        const frequency = detectPitch(samples, context.sampleRate);
        if (frequency && frequency > 70 && frequency < 1000) {
          const note = frequencyToNote(frequency);
          setNotes((previous) => previous[previous.length - 1] === note ? previous : [...previous, note].slice(-80));
        }
        if (Date.now() - startedRef.current >= 12000) { stop(); return; }
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    } catch (error) {
      setNotice(error instanceof Error && error.name === "NotAllowedError" ? "Microphone permission was denied." : "Could not start the microphone.");
    }
  }

  function stop() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    setRecording(false);
    setNotice("Melodic contour captured locally. No audio was uploaded.");
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(notes.join(" – ")); setNotice("Note sequence copied."); }
    catch { setNotice("Clipboard access is unavailable."); }
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/"><span className="brand-mark"><AudioLines size={21} /></span><span>echo<span className="brand-light">id</span></span></Link>
        <div className="side-label">MELODY LAB</div>
        <nav className="side-nav">
          <Link className="nav-item" href="/">Discover</Link>
          <Link className="nav-item" href="/intelligence">Intelligence</Link>
          <Link className="nav-item active" href="/hum">Hum 2.0</Link>
          <Link className="nav-item" href="/playlists">Playlists</Link>
          <Link className="nav-item" href="/statistics">Statistics</Link>
        </nav>
      </aside>
      <section className="main-content">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>Hum 2.0</strong></div><span className="status-pill status-ready">LOCAL PITCH ANALYSIS</span></header>
        <div className="content-wrap">
          <div className="page-title"><div className="eyebrow"><span /> MELODY RECOGNITION LAB</div><h1>Hum <span>2.0.</span></h1><p>Capture the contour of a hummed melody and convert stable pitches into note names.</p></div>
          <section className="search-card">
            <div className="search-body">
              <div className={"listen-button " + (recording ? "listening" : "")}><button onClick={() => recording ? stop() : void start()}>{recording ? <Square size={24} /> : <Mic size={27} />}</button><span className="pulse pulse-a" /><span className="pulse pulse-b" /></div>
              <h2>{recording ? "Listening to your melody…" : "Hum a melody."}</h2>
              <p>Allow microphone access, then hum one note at a time for up to 12 seconds.</p>
              {notice && <div className="inline-notice">{notice}</div>}
            </div>
          </section>
          {notes.length > 0 && <section className="results-section">
            <div className="section-head"><div><h3>Detected note contour</h3><p>{notes.length} note changes detected</p></div><button className="text-link" onClick={() => setNotes([])}>Clear</button></div>
            <div className="note-contour">{notes.map((note, index) => <span key={index}>{note}</span>)}</div>
            <div className="track-actions"><button className="primary-button" onClick={() => void copy()}>Copy note sequence</button><Link className="secondary-button" href="/intelligence">Explore similar moods</Link></div>
          </section>}
          <section className="feature-note"><Waves size={18} /><div><strong>What this beta does and does not do</strong><p>Hum 2.0 estimates a monophonic pitch contour in the browser and never uploads your microphone audio. It does not yet identify the original commercial track: that requires a searchable melody fingerprint index, which is not present in this project.</p></div></section>
          <footer className="page-footer"><span>© 2026 EchoID</span><span>Microphone analysis stays on this device</span><Link href="/">Back to EchoID</Link></footer>
        </div>
      </section>
    </main>
  );
}
