import Link from "next/link";

export default function OfflinePage() {
  return <main className="public-page"><section className="public-content"><div className="eyebrow"><span /> ECHOID OFFLINE</div><h1>You are <span>offline.</span></h1><p>The app shell is available, but catalog search and music recognition require an internet connection.</p><Link className="primary-button" href="/">Try again</Link></section></main>;
}
