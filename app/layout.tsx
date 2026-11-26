import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EchoID — Find the music you feel",
  description: "Discover music by sound, lyrics, mood and melody.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
