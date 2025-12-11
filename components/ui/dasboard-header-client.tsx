"use client";
import { Skeleton } from "./skeleton";

import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Popover, PopoverTrigger } from "./popover";
import { Button } from "./button";
import {
  ChevronDown,
  Folder,
  HelpCircle,
  HomeIcon,
  LinkIcon,
  LogOut,
  NotepadText,
  Plus,
  QrCode,
  Settings,
} from "lucide-react";
import { Separator } from "./separator";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "./locale-switcher";
import { signOutUser } from "@/app/actions/signOut";
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";
import Hamburger from "hamburger-react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { cn, fetchApi } from "@/lib/utils";
import { ScrollPopoverContent } from "./scroll-popover-content";
import { authClient } from "@/lib/authClient";
import { SubscriptionsType } from "@/utils/plan-utils";

export const DashboardHeaderClient = () => {
  const { isPending, isRefetching, data } = authClient.useSession();
  const [plan, setPlan] = useState<string>("free");

  useEffect(() => {
    let isMounted = true;

    const fetchPlan = async () => {
      try {
        const res = await fetchApi<{
          plan: SubscriptionsType;
          lastPaid?: Date;
        }>("auth/user/subscription");

        if (isMounted) {
          if (res.success) {
            console.log("Fetched plan:", res.plan);
            setPlan(res.plan);
          } else {
            setPlan("free");
          }
        }
      } catch (_error) {
        if (isMounted) setPlan("free");
      }
    };

    fetchPlan();

    return () => {
      isMounted = false;
    };
  }, [isRefetching, isPending]);
  const user = data?.user;
  const [open, setOpen] = useState(false);
  const [hamburguerOpen, setHamburguerOpen] = useState(false);
  const [createdNewOpen, createNewOpenChange] = useState(false);
  const pathname = usePathname();

  return (
    <header className="fixed top-0 p-2 w-full sm:h-14 h-12 border-b shadow bg-background z-85 transition-shadow flex flex-row justify-between gap-4">
      <div className="md:block hidden"></div>
      <div className="w-auto h-full aspect-square md:hidden flex items-center justify-center">
        <Sheet onOpenChange={setHamburguerOpen} open={hamburguerOpen}>
          <SheetTrigger>
            <Hamburger size={16} toggled={hamburguerOpen} />
          </SheetTrigger>
          <SheetContent
            side="left"
            className="sm:pt-16! pt-12! w-full sm:max-w-[540px] max-w-[300px] border-l"
          >
            <div className="hidden">
              <SheetHeader>
                <SheetTitle>Hamburguer Menu</SheetTitle>
              </SheetHeader>
            </div>
            <div className="flex flex-col w-full gap-2 items-stretch p-3">
              <Button
                onClick={() => {
                  createNewOpenChange(false);
                  setHamburguerOpen(false);
                }}
                variant={"link"}
                className="justify-start px-0!"
                asChild
              >
                <Link href={"/dashboard"}>
                  <Image
                    alt="Shortn-logo"
                    src={"/logo.png"}
                    width={1080}
                    height={1080}
                    className="w-8 h-8 rounded"
                  />
                  <span>Shortn.at</span>
                </Link>
              </Button>
              <Separator />
              <Dialog open={createdNewOpen} onOpenChange={createNewOpenChange}>
                <DialogTrigger asChild>
                  <Button variant={"default"} className="justify-start rounded">
                    <Plus />
                    Create new
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-full lg:max-w-[800px]! md:max-w-[500px]! z-99">
                  <DialogHeader>
                    <DialogTitle className="mb-2 font-semibold! text-lg!">
                      What do you want to create?
                    </DialogTitle>
                    <div className="lg:grid grid-cols-3 flex flex-col w-full gap-4">
                      <Button
                        onClick={() => {
                          createNewOpenChange(false);
                          setHamburguerOpen(false);
                        }}
                        variant="outline"
                        className="h-fit text-base"
                        asChild
                      >
                        <Link href={`/dashboard/links/create`}>
                          <LinkIcon className="text-primary" />
                          Shorten a link
                        </Link>
                      </Button>

                      <Button
                        onClick={() => {
                          createNewOpenChange(false);
                          setHamburguerOpen(false);
                        }}
                        variant="outline"
                        className="h-fit text-base"
                        asChild
                      >
                        <Link href={`/dashboard/qr-codes/create`}>
                          <QrCode className="text-primary" />
                          Create a QR Code
                        </Link>
                      </Button>

                      <Button
                        onClick={() => {
                          createNewOpenChange(false);
                          setHamburguerOpen(false);
                        }}
                        variant="outline"
                        className="h-fit text-base"
                        asChild
                      >
                        <Link href={`/dashboard/pages/create`}>
                          <NotepadText className="text-primary" />
                          Build a landing page
                        </Link>
                      </Button>
                    </div>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
              <Button
                onClick={() => {
                  createNewOpenChange(false);
                  setHamburguerOpen(false);
                }}
                asChild
                variant={"link"}
                className="justify-start rounded"
              >
                <Link
                  className={cn(
                    "border-r-2 rounded-none! border-r-transparent",
                    pathname == "/dashboard" && "border-r-primary bg-accent",
                  )}
                  href={`/dashboard`}
                >
                  <HomeIcon />
                  Home
                </Link>
              </Button>
              <Button
                onClick={() => {
                  createNewOpenChange(false);
                  setHamburguerOpen(false);
                }}
                asChild
                variant={"link"}
                className="justify-start rounded"
              >
                <Link
                  className={cn(
                    "border-r-2 rounded-none! border-r-transparent",
                    pathname.startsWith("/dashboard/links") &&
                      "border-r-primary bg-accent",
                  )}
                  href={`/dashboard/links`}
                >
                  <LinkIcon />
                  Links
                </Link>
              </Button>
              <Button
                onClick={() => {
                  createNewOpenChange(false);
                  setHamburguerOpen(false);
                }}
                asChild
                variant={"link"}
                className="justify-start rounded"
              >
                <Link
                  className={cn(
                    "border-r-2 rounded-none! border-r-transparent",
                    pathname.startsWith("/dashboard/qr-codes") &&
                      "border-r-primary bg-accent",
                  )}
                  href={`/dashboard/qr-codes`}
                >
                  <QrCode />
                  QR Codes
                </Link>
              </Button>
              <Button
                onClick={() => {
                  createNewOpenChange(false);
                  setHamburguerOpen(false);
                }}
                asChild
                variant={"link"}
                className="justify-start rounded"
              >
                <Link
                  className={cn(
                    "border-r-2 rounded-none! border-r-transparent",
                    pathname.startsWith("/dashboard/pages") &&
                      "border-r-primary bg-accent",
                  )}
                  href={`/dashboard/pages`}
                >
                  <NotepadText />
                  Pages
                </Link>
              </Button>
              <Button
                onClick={() => {
                  createNewOpenChange(false);
                  setHamburguerOpen(false);
                }}
                asChild
                variant={"link"}
                className="justify-start rounded"
              >
                <Link
                  className={cn(
                    "border-r-2 rounded-none! border-r-transparent",
                    pathname.startsWith("/dashboard/campaigns") &&
                      "border-r-primary bg-accent",
                  )}
                  href={`/dashboard/campaigns`}
                >
                  <Folder />
                  Campaigns
                </Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex flex-row items-center gap-4">
        {!user && (
          <>
            <Skeleton className="h-full w-36 aspect-square rounded" />
            <Skeleton className="h-full w-auto aspect-square rounded-full" />
          </>
        )}
        {user && (
          <>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild className="group">
                <Button
                  variant={"outline"}
                  className="py-1! h-full px-2! max-w-36"
                >
                  <Avatar className="h-full! w-auto! aspect-square! rounded-full!">
                    <AvatarImage
                      className="object-cover"
                      src={user.image ?? undefined}
                      alt={user.name}
                    />
                    <AvatarFallback>
                      {user.name
                        .trim()
                        .split(/\s+/)
                        .filter(Boolean)
                        .map((w) => w[0].toUpperCase())
                        .filter((_, i, a) => i === 0 || i === a.length - 1)
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <p className="truncate">{user.name}</p>
                  <ChevronDown className="group-data-[state=open]:rotate-180 transition-transform" />
                </Button>
              </PopoverTrigger>
              <ScrollPopoverContent className="w-[300px] p-0 z-99">
                <div className="w-full p-4 flex flex-row gap-2 items-stretch justify-start">
                  <Avatar className="h-full! w-auto! max-h-10 aspect-square! rounded-full!">
                    {user.image && (
                      <AvatarImage
                        className="object-cover"
                        src={user.image}
                        alt={user.name}
                      />
                    )}
                    <AvatarFallback className="w-auto! h-10 aspect-square! rounded-full!">
                      {user.name
                        .trim()
                        .split(/\s+/)
                        .filter(Boolean)
                        .map((w) => w[0].toUpperCase())
                        .filter((_, i, a) => i === 0 || i === a.length - 1)
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col h-full grow justify-between">
                    <p className="text-sm font-semibold">{user.name}</p>
                    <p className="text-xs">{user.email}</p>
                  </div>
                </div>
                <Separator />
                <div className="w-full p-4 flex flex-row gap-2 items-start justify-between">
                  <div className="flex flex-col gap-0 items-start">
                    <p className="text-sm">{user.sub.split("|")[1]}</p>
                    {plan == "pro" && (
                      <p className="text-xs text-muted-foreground">
                        Pro Account
                      </p>
                    )}
                    {plan == "plus" && (
                      <p className="text-xs text-muted-foreground">
                        Plus Account
                      </p>
                    )}
                    {plan == "basic" && (
                      <p className="text-xs text-muted-foreground">
                        Basic Account
                      </p>
                    )}
                    {plan == "free" && (
                      <p className="text-xs text-muted-foreground">
                        Free Account
                      </p>
                    )}
                  </div>
                  {plan != "pro" && (
                    <Button
                      onClick={() => {
                        setOpen(false);
                      }}
                      asChild
                      className="h-fit text-xs px-2 py-1 rounded!"
                    >
                      <Link href={`/dashboard/subscription`}>Upgrade</Link>
                    </Button>
                  )}
                </div>
                <Separator />
                <div className="w-full py-2 flex flex-col gap-0">
                  <Button
                    onClick={() => {
                      setOpen(false);
                    }}
                    asChild
                    className="rounded-none justify-start"
                    variant="ghost"
                  >
                    <Link href={`/dashboard/settings`}>
                      <Settings />
                      Settings
                    </Link>
                  </Button>

                  <Button
                    onClick={() => {
                      setOpen(false);
                    }}
                    asChild
                    className="rounded-none justify-start"
                    variant="ghost"
                  >
                    <Link href={`/dashboard/help`}>
                      <HelpCircle />
                      Help
                    </Link>
                  </Button>
                </div>
                <Separator />
                <div className="w-full py-2 flex flex-col gap-0">
                  <Button
                    onClick={() => {
                      setOpen(false);
                      signOutUser();
                    }}
                    className="rounded-none justify-start"
                    variant="ghost"
                  >
                    <LogOut />
                    Sign out
                  </Button>
                </div>
              </ScrollPopoverContent>
            </Popover>
            <LocaleSwitcher />
          </>
        )}
      </div>
    </header>
  );
};
