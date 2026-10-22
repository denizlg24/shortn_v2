import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { default: "Shortn Admin", template: "%s · Shortn Admin" },
  robots: { index: false, follow: false },
};

// Follows the OS theme before first paint.
const themeScript = `(()=>{const d=document.documentElement,m=matchMedia("(prefers-color-scheme: dark)"),a=()=>d.classList.toggle("dark",m.matches);a();m.addEventListener("change",a)})()`;

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </head>
      <body className="bg-bg text-fg antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
