"use client";

import { buttonVariants, cn } from "@shortn/ui";
import { Menu, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

type Link = { href: string; label: string };

// Below the desktop breakpoint the links fold into an in-page panel under the
// header (21 §3.1); it pushes content down rather than covering it.
export function MobileMenu({
  openLabel,
  closeLabel,
  navLabel,
  links,
  signIn,
  register,
}: {
  openLabel: string;
  closeLabel: string;
  navLabel: string;
  links: Link[];
  signIn: Link;
  register: Link;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const wide = window.matchMedia("(min-width: 48rem)");
    const reset = () => wide.matches && setOpen(false);
    window.addEventListener("keydown", close);
    wide.addEventListener("change", reset);
    return () => {
      window.removeEventListener("keydown", close);
      wide.removeEventListener("change", reset);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? closeLabel : openLabel}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-md" }),
          "ml-auto size-10 md:hidden",
        )}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-16 border-t border-line bg-bg md:hidden"
      >
        <nav aria-label={navLabel} className="px-4 pt-2 pb-5">
          <ul className="flex flex-col">
            {links.map((link) => (
              <li key={link.href} className="border-b border-line">
                <a
                  href={link.href}
                  className="flex h-13 items-center font-display text-subhead font-bold tracking-[-0.015em]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <a
              href={signIn.href}
              className={cn(buttonVariants({ size: "lg" }), "h-11")}
            >
              {signIn.label}
            </a>
            <a
              href={register.href}
              className={cn(
                buttonVariants({ variant: "primary", size: "lg" }),
                "h-11",
              )}
            >
              {register.label}
            </a>
          </div>
        </nav>
      </div>
    </>
  );
}
