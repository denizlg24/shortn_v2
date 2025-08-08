"use client";

import { cn } from "@/lib/utils";
import QRCodeStyling, { Options } from "qr-code-styling";
import { useRef, useEffect, useState } from "react";

export const StyledQRCode = ({
  options,
  className,
}: {
  options: Partial<Options>;
  className?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = "";

    const width = containerRef.current.offsetWidth;
    const height = containerRef.current.offsetHeight;
    try {
      const qr = new QRCodeStyling({
        ...options,
        width,
        height,
      });

      qr.append(containerRef.current);
    } catch (error) {}

    return () => {
      if (containerRef.current) containerRef.current!.innerHTML = "";
    };
  }, [options]);

  return (
    <div
      ref={containerRef}
      className={cn("w-full h-auto aspect-square", className)}
      style={{ position: "relative" }}
    />
  );
};
