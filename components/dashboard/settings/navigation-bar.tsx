"use client";

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ChevronUp } from "lucide-react";

export const NavigationBar = () => {
  const pathname = usePathname();
  const prefix = `/dashboard}`;
  return (
    <NavigationMenu className="w-full max-w-full! block! border-b pb-3">
      <NavigationMenuList className="w-full! flex flex-row items-center gap-4 max-w-xl! justify-between!">
        <NavigationMenuItem className="relative mx-auto">
          <Link
            className={cn(
              pathname.endsWith(`/settings`) && "font-semibold text-primary"
            )}
            href={`${prefix}/settings`}
          >
            Profile
          </Link>
          {pathname.endsWith(`/settings`) && (
            <div className="absolute w-full flex flex-col items-center gap-0 top-5">
              <ChevronUp className="text-primary w-4 h-4  " />
            </div>
          )}
        </NavigationMenuItem>
        <NavigationMenuItem className="relative mx-auto">
          <Link
            className={cn(
              pathname.endsWith(`/security`) && "font-semibold text-primary"
            )}
            href={`${prefix}/settings/security`}
          >
            Security
          </Link>
          {pathname.endsWith(`/security`) && (
            <div className="absolute w-full flex flex-col items-center gap-0 top-5">
              <ChevronUp className="text-primary w-4 h-4  " />
            </div>
          )}
        </NavigationMenuItem>
        <NavigationMenuItem className="relative mx-auto">
          <Link
            className={cn(
              pathname.endsWith(`/plan`) && "font-semibold text-primary"
            )}
            href={`${prefix}/settings/plan`}
          >
            Plan
          </Link>
          {pathname.endsWith(`/plan`) && (
            <div className="absolute w-full flex flex-col items-center gap-0 top-5">
              <ChevronUp className="text-primary w-4 h-4  " />
            </div>
          )}
        </NavigationMenuItem>
        <NavigationMenuItem className="relative mx-auto">
          <Link
            className={cn(
              pathname.endsWith(`/billing`) && "font-semibold text-primary"
            )}
            href={`${prefix}/settings/billing`}
          >
            Billing
          </Link>
          {pathname.endsWith(`/billing`) && (
            <div className="absolute w-full flex flex-col items-center gap-0 top-5">
              <ChevronUp className="text-primary w-4 h-4  " />
            </div>
          )}
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
};
