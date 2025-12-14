"use client";

import { cn } from "@/lib/utils";
import QRCodeStyling, { Options } from "qr-code-styling";
import { useRef, useEffect, Dispatch, SetStateAction } from "react";

export const StyledQRCode = ({
  options,
  setStyledCode,
  className,
}: {
  options: Partial<Options>;
  setStyledCode?: Dispatch<SetStateAction<QRCodeStyling | undefined>>;
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
      if (setStyledCode) {
        setStyledCode(qr);
      }
    } catch (error) {
      console.error("Error generating QR code:", error);
    }

    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (containerRef.current) containerRef.current!.innerHTML = "";
    };
  }, [options, setStyledCode]);

  return (
    <div
      ref={containerRef}
      className={cn("w-full h-auto aspect-square", className)}
      style={{ position: "relative" }}
    />
  );
};
