"use client";
import { Skeleton } from "./skeleton";

import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "./button";
import { ChevronDown, HelpCircle, LogOut, Settings } from "lucide-react";
import { Separator } from "./separator";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./locale-switcher";
import { useUser } from "@/utils/UserContext";
import { signOutUser } from "@/app/actions/signOut";
import { useState } from "react";

export const DashboardHeaderClient = () => {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed top-0 p-2 w-full sm:h-14 h-12 border-b shadow bg-background z-90 transition-shadow flex flex-row justify-end gap-4">
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
                    src={user.profilePicture}
                    alt={user.displayName}
                  />
                  <AvatarFallback>
                    {user.displayName
                      .trim()
                      .split(/\s+/)
                      .filter(Boolean)
                      .map((w) => w[0].toUpperCase())
                      .filter((_, i, a) => i === 0 || i === a.length - 1)
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <p className="truncate">{user.displayName}</p>
                <ChevronDown className="group-data-[state=open]:rotate-180 transition-transform" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0 z-99">
              <div className="w-full p-4 flex flex-row gap-2 items-stretch justify-start">
                <Avatar className="h-full! w-auto! max-h-10 aspect-square! rounded-full!">
                  {user.profilePicture && (
                    <AvatarImage
                      className="object-cover"
                      src={user.profilePicture}
                      alt={user.displayName}
                    />
                  )}
                  <AvatarFallback className="w-auto! h-10 aspect-square! rounded-full!">
                    {user.displayName
                      .trim()
                      .split(/\s+/)
                      .filter(Boolean)
                      .map((w) => w[0].toUpperCase())
                      .filter((_, i, a) => i === 0 || i === a.length - 1)
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col h-full grow justify-between">
                  <p className="text-sm font-semibold">{user.displayName}</p>
                  <p className="text-xs">{user.email}</p>
                </div>
              </div>
              <Separator />
              <div className="w-full p-4 flex flex-row gap-2 items-start justify-between">
                <div className="flex flex-col gap-0 items-start">
                  <p className="text-sm">{user.sub.split("|")[1]}</p>
                  {user.plan.subscription == "pro" && (
                    <p className="text-xs text-muted-foreground">Pro Account</p>
                  )}
                  {user.plan.subscription == "plus" && (
                    <p className="text-xs text-muted-foreground">
                      Plus Account
                    </p>
                  )}
                  {user.plan.subscription == "basic" && (
                    <p className="text-xs text-muted-foreground">
                      Basic Account
                    </p>
                  )}
                  {user.plan.subscription == "free" && (
                    <p className="text-xs text-muted-foreground">
                      Free Account
                    </p>
                  )}
                </div>
                {user.plan.subscription != "pro" && (
                  <Button
                    onClick={() => {
                      setOpen(false);
                    }}
                    asChild
                    className="h-fit text-xs px-2 py-1 rounded!"
                  >
                    <Link
                      href={`/dashboard/${user.sub.split("|")[1]}/subscription`}
                    >
                      Upgrade
                    </Link>
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
                  <Link href={`/dashboard/${user.sub.split("|")[1]}/settings`}>
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
                  <Link href={`/dashboard/${user.sub.split("|")[1]}/help`}>
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
            </PopoverContent>
          </Popover>
          <LocaleSwitcher />
        </>
      )}
    </header>
  );
};
