"use client";
import { useState } from "react";
import { bioEmbedUrl } from "@shortn/core/bio-urls";
export function BioEmbed({
  provider,
  url,
  preview,
  loadLabel,
  consentLabel,
}: {
  provider: string;
  url: string;
  preview: boolean;
  loadLabel: string;
  consentLabel: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const src = bioEmbedUrl(provider, url);
  if (!src) return null;
  return loaded && !preview ? (
    <iframe
      className="bio-embed"
      src={src}
      title={provider}
      sandbox="allow-scripts allow-same-origin allow-presentation"
      allow="encrypted-media; fullscreen"
      referrerPolicy="no-referrer"
      loading="lazy"
    />
  ) : (
    <div className="bio-embed-consent">
      <p>{consentLabel.replace("{provider}", provider)}</p>
      <button type="button" disabled={preview} onClick={() => setLoaded(true)}>
        {loadLabel.replace("{provider}", provider)}
      </button>
    </div>
  );
}
