import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EchoID — Find the song in the room",
  description: "Identify music with a short recording or audio clip, then save the track to your local library.",
  applicationName: "EchoID",
  openGraph: {
    title: "EchoID — Find the song in the room",
    description: "Identify music with a short recording or audio clip.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
