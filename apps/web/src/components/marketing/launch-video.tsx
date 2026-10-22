"use client";

import { useEffect, useRef } from "react";

/**
 * Plays muted while at least half of it is on screen, unless the visitor
 * prefers reduced motion; then it stays on the poster until they press play.
 */
export function LaunchVideo({
  src,
  poster,
  label,
}: {
  src: string;
  poster: string;
  label: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    video.muted = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (!entry.isIntersecting) video.pause();
        else if (!reduced.matches && video.muted)
          video.play().catch(() => undefined);
      },
      { threshold: 0.5 },
    );
    observer.observe(video);
    const onMotionChange = () => {
      if (reduced.matches) video.pause();
    };
    reduced.addEventListener("change", onMotionChange);
    return () => {
      observer.disconnect();
      reduced.removeEventListener("change", onMotionChange);
    };
  }, []);

  return (
    <video
      ref={ref}
      className="block size-full object-cover"
      poster={poster}
      aria-label={label}
      controls
      muted
      loop
      playsInline
      preload="none"
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
