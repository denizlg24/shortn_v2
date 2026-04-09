"use client";

import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/authClient";
import { cn } from "@/lib/utils";
import logo from "@/public/logo.png";
import { PopoverClose } from "@radix-ui/react-popover";
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  Contact,
  HelpCircle,
  Link2,
  LogIn,
  Menu,
  NotepadText,
  QrCode,
  Users,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Button } from "./button";
import { LocaleSwitcher } from "./locale-switcher";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "./sheet";

type NavEntry = {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
};

function DesktopMenu({ label, items }: { label: string; items: NavEntry[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="group inline-flex items-center gap-1.5 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground">
          {label}
          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[24rem] rounded-[1.75rem] border-black/5 bg-background/92 p-2 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.55)] backdrop-blur-2xl"
      >
        <div className="space-y-1">
          {items.map((item) => (
            <PopoverClose asChild key={item.href}>
              <Link
                href={item.href}
                className="group flex items-start gap-4 rounded-[1.2rem] px-4 py-3 transition-colors hover:bg-primary/[0.05]"
              >
                <span className="mt-1 text-primary/70 transition-transform duration-200 group-hover:translate-x-0.5">
                  {item.icon}
                </span>
                <span className="space-y-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {item.title}
                  </span>
                  <span className="block text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </Link>
            </PopoverClose>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MobileGroup({ label, items }: { label: string; items: NavEntry[] }) {
  return (
    <div className="space-y-4 border-t border-black/5 pt-6 first:border-t-0 first:pt-0">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </p>
      <div className="space-y-3">
        {items.map((item) => (
          <SheetClose asChild key={item.href}>
            <Link
              href={item.href}
              className="flex items-start gap-3 rounded-[1.25rem] px-4 py-3 transition-colors hover:bg-primary/[0.05]"
            >
              <span className="mt-1 text-primary/70">{item.icon}</span>
              <span>
                <span className="block text-sm font-semibold">
                  {item.title}
                </span>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </Link>
          </SheetClose>
        ))}
      </div>
    </div>
  );
}

export const Header = () => {
  const { data } = authClient.useSession();
  const user = data?.user;
  const t = useTranslations("header");
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const productLinks = useMemo<NavEntry[]>(
    () => [
      {
        href: "/products/url-shortener",
        title: t("url-shortener.title"),
        description: t("url-shortener.description"),
        icon: <Link2 className="h-4 w-4" />,
      },
      {
        href: "/products/qr-code",
        title: t("qr-code.title"),
        description: t("qr-code.description"),
        icon: <QrCode className="h-4 w-4" />,
      },
      {
        href: "/products/pages",
        title: t("pages.title"),
        description: t("pages.description"),
        icon: <NotepadText className="h-4 w-4" />,
      },
      {
        href: "/products/analytics",
        title: t("analytics.title"),
        description: t("analytics.description"),
        icon: <BarChart3 className="h-4 w-4" />,
      },
    ],
    [t],
  );

  const resourceLinks = useMemo<NavEntry[]>(
    () => [
      {
        href: "/help",
        title: t("help-center.title"),
        description: t("help-center.description"),
        icon: <HelpCircle className="h-4 w-4" />,
      },
      {
        href: "/contact",
        title: t("contact-us.title"),
        description: t("contact-us.description"),
        icon: <Contact className="h-4 w-4" />,
      },
      {
        href: "/about",
        title: t("about-us.title"),
        description: t("about-us.description"),
        icon: <Users className="h-4 w-4" />,
      },
    ],
    [t],
  );

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
      <div
        className={cn(
          "mx-auto flex w-full max-w-[72rem] items-center gap-4 rounded-[1.75rem] px-4 py-3 transition-all duration-300 sm:px-6",
          isScrolled || isOpen
            ? "bg-background/86 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.4)] ring-1 ring-black/5 backdrop-blur-2xl"
            : "bg-background/70 ring-1 ring-black/5 backdrop-blur-xl",
        )}
      >
        <Link href="/" className="flex items-center">
          <Image
            src={logo}
            width={40}
            height={40}
            alt="Shortn logo"
            className="sm:h-10 sm:w-10 w-8 h-8 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.4)] rounded"
          />
        </Link>

        <nav className="ml-2 hidden items-center gap-6 lg:flex">
          <DesktopMenu label={t("platform")} items={productLinks} />
          <Link
            href="/pricing"
            className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
          >
            {t("pricing")}
          </Link>
          <DesktopMenu label={t("resources")} items={resourceLinks} />
        </nav>

        <div className="ml-auto hidden items-center gap-3 lg:flex">
          <LocaleSwitcher />
          {user ? (
            <Button
              asChild
              variant="outline"
              className="rounded-full border-black/10 bg-white/70 px-2 backdrop-blur-sm"
            >
              <Link href="/dashboard">
                <Avatar className="h-8 w-8">
                  {user.image ? <AvatarImage src={user.image} /> : null}
                  <AvatarFallback>
                    {user.name?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="pr-1 text-sm">{t("dashboard")}</span>
              </Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                className="rounded-full text-foreground/75 hover:text-foreground"
              >
                <Link href="/login">{t("login")}</Link>
              </Button>
              <Button
                asChild
                className="rounded-full px-5 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.55)]"
              >
                <Link href="/register">
                  {t("register")}
                  <ArrowRight />
                </Link>
              </Button>
            </>
          )}
        </div>

        <div className="ml-auto lg:hidden">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full border border-black/10 bg-white/60 backdrop-blur-sm"
              >
                {isOpen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Menu className="h-4 w-4" />
                )}
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-full max-w-sm border-l border-black/5 bg-background/95 px-6 py-8 backdrop-blur-2xl overflow-y-auto"
            >
              <div className="flex h-full flex-col gap-8">
                <MobileGroup label={t("platform")} items={productLinks} />
                <div className="space-y-4 border-t border-black/5 pt-6">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    {t("pricing")}
                  </p>
                  <SheetClose asChild>
                    <Link
                      href="/pricing"
                      className="flex items-center justify-between rounded-[1.25rem] px-4 py-3 text-sm font-semibold transition-colors hover:bg-primary/[0.05]"
                    >
                      {t("pricing")}
                      <ArrowRight className="h-4 w-4 text-primary/70" />
                    </Link>
                  </SheetClose>
                </div>
                <MobileGroup label={t("resources")} items={resourceLinks} />
                <div className="space-y-4 border-t border-black/5 pt-6 flex flex-col gap-y-4">
                  <div className="grid grid-cols-2 items-center grow gap-3 w-full">
                    {user ? (
                      <SheetClose asChild>
                        <Button
                          asChild
                          className="w-full rounded-full shadow-[0_18px_50px_-24px_rgba(15,23,42,0.55)]"
                        >
                          <Link href="/dashboard">{t("dashboard")}</Link>
                        </Button>
                      </SheetClose>
                    ) : (
                      <>
                        <SheetClose asChild>
                          <Button
                            asChild
                            className="w-full rounded-full shadow-[0_18px_50px_-24px_rgba(15,23,42,0.55)]"
                          >
                            <Link href="/register">
                              {t("register")}
                              <ArrowRight />
                            </Link>
                          </Button>
                        </SheetClose>
                        <SheetClose asChild>
                          <Button
                            asChild
                            variant="outline"
                            className="w-full rounded-full border-black/10 bg-white/70 backdrop-blur-sm"
                          >
                            <Link href="/login">
                              {t("login")}
                              <LogIn className="h-4 w-4" />
                            </Link>
                          </Button>
                        </SheetClose>
                      </>
                    )}
                  </div>
                  <div className="w-8 h-8 mx-auto mb-4">
                    <LocaleSwitcher />
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};
