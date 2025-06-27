"use client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  ChevronLeft,
  Home,
  LinkIcon,
  NotepadText,
  Plus,
  QrCode,
} from "lucide-react";
import { Button } from "./ui/button";
import { Link, usePathname } from "@/i18n/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Separator } from "./ui/separator";

export const AppSidebar = () => {
  const { toggleSidebar, state } = useSidebar();
  const pathname = usePathname();
  return (
    <Sidebar collapsible="icon" className="z-99">
      <SidebarHeader className="py-2">
        <SidebarMenu className="">
          <SidebarMenuItem>
            <SidebarMenuButton
              className="group-data-[collapsible=icon]:p-1! rounded! hover:bg-transparent! group-data-[collapsible=icon]:w-10! h-10! group-data-[collapsible=icon]:h-10!"
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
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <Separator />
      <SidebarContent>
        <div className="absolute -right-3 top-11 z-90">
          <Button
            data-sidebar="trigger"
            data-slot="sidebar-trigger"
            variant="ghost"
            size="icon"
            className="p-1! w-fit h-auto aspect-square rounded-full border bg-background shadow"
            onClick={() => {
              toggleSidebar();
            }}
          >
            <ChevronLeft
              className={cn(
                state == "collapsed" && "rotate-180 transition-transform"
              )}
            />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
        </div>
        <SidebarGroup className="mt-4 pt-0!">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuButton
                className={cn(
                  "group-data-[collapsible=icon]:p-2.5! hover:bg-primary bg-primary text-primary-foreground hover:text-primary-foreground font-semibold group-data-[collapsible=icon]:w-10! h-10! group-data-[collapsible=icon]:h-10!"
                )}
                asChild
              >
                <Link href={"/dashboard"}>
                  {state == "collapsed" && <Plus className="w-5! h-5!" />}
                  {state != "collapsed" && (
                    <span className="mx-auto">Create Link</span>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenu>
          </SidebarGroupContent>
          <Separator className="my-2" />
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={cn(
                    "group-data-[collapsible=icon]:p-2.5! relative group-data-[collapsible=icon]:w-10! h-10! group-data-[collapsible=icon]:h-10!",
                    /^\/dashboard\/[^/]+$/.test(pathname) && "bg-muted"
                  )}
                  asChild
                >
                  <Link href={"/dashboard"}>
                    {/^\/dashboard\/[^/]+$/.test(pathname) && (
                      <div className="absolute w-1 h-5 bg-primary left-0 my-auto"></div>
                    )}
                    <Home className="w-5! h-5!" />
                    {state != "collapsed" && <span className="">Home</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={cn(
                    "group-data-[collapsible=icon]:p-2.5! relative group-data-[collapsible=icon]:w-10! h-10! group-data-[collapsible=icon]:h-10!",
                    /^\/dashboard\/links(?:\/.*)?$/.test(pathname) && "bg-muted"
                  )}
                  asChild
                >
                  <Link href={"/dashboard/org/links"}>
                    {/^\/dashboard\/links(?:\/.*)?$/.test(pathname) && (
                      <div className="absolute w-1 h-5 bg-primary left-0 my-auto"></div>
                    )}
                    <LinkIcon className="w-5! h-5!" />
                    {state != "collapsed" && <span className="">Links</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={cn(
                    "group-data-[collapsible=icon]:p-2.5! relative group-data-[collapsible=icon]:w-10! h-10! group-data-[collapsible=icon]:h-10!",
                    /^\/dashboard\/qr-codes(?:\/.*)?$/.test(pathname) &&
                      "bg-muted"
                  )}
                  asChild
                >
                  <Link href={"/dashboard/org/qr-codes"}>
                    {/^\/dashboard\/qr-codes(?:\/.*)?$/.test(pathname) && (
                      <div className="absolute w-1 h-5 bg-primary left-0 my-auto"></div>
                    )}
                    <QrCode className="w-5! h-5!" />
                    {state != "collapsed" && <span className="">QR Codes</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={cn(
                    "group-data-[collapsible=icon]:p-2.5! relative group-data-[collapsible=icon]:w-10! h-10! group-data-[collapsible=icon]:h-10!",
                    /^\/dashboard\/pages(?:\/.*)?$/.test(pathname) && "bg-muted"
                  )}
                  asChild
                >
                  <Link href={"/dashboard/org/pages"}>
                    {/^\/dashboard\/pages(?:\/.*)?$/.test(pathname) && (
                      <div className="absolute w-1 h-5 bg-primary left-0 my-auto"></div>
                    )}
                    <NotepadText className="w-5! h-5!" />
                    {state != "collapsed" && <span className="">Pages</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};
