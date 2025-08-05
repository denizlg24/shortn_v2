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
import { IPlan } from "@/models/auth/User";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { User } from "next-auth";
import { useUser } from "@/utils/UserContext";
import { useEffect, useState } from "react";

export const AppSidebar = () => {
  const { user } = useUser();
  const { toggleSidebar, state } = useSidebar();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
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
              <SidebarMenuButton asChild>
                <Dialog
                  open={createDialogOpen}
                  onOpenChange={setCreateDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button className="group-data-[collapsible=icon]:p-2.5! hover:bg-primary bg-primary text-primary-foreground hover:text-primary-foreground font-semibold group-data-[collapsible=icon]:w-10! h-10! group-data-[collapsible=icon]:h-10!">
                      {state == "collapsed" && <Plus className="w-5! h-5!" />}
                      {state != "collapsed" && (
                        <span className="mx-auto">Create new</span>
                      )}
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
                            setCreateDialogOpen(false);
                          }}
                          variant="outline"
                          className="h-fit text-base"
                          asChild
                        >
                          <Link
                            href={`/dashboard/${
                              user?.sub.split("|")[1]
                            }/links/create`}
                          >
                            <LinkIcon className="text-primary" />
                            Shorten a link
                          </Link>
                        </Button>
                        <Button
                          onClick={() => {
                            setCreateDialogOpen(false);
                          }}
                          variant="outline"
                          className="h-fit text-base"
                          asChild
                        >
                          <Link
                            href={`/dashboard/${
                              user?.sub.split("|")[1]
                            }/qr-codes/create`}
                          >
                            <QrCode className="text-primary" />
                            Create a QR Code
                          </Link>
                        </Button>
                        <Button
                          onClick={() => {
                            setCreateDialogOpen(false);
                          }}
                          variant="outline"
                          className="h-fit text-base"
                          asChild
                        >
                          <Link
                            href={`/dashboard/${
                              user?.sub.split("|")[1]
                            }/pages/create`}
                          >
                            <NotepadText className="text-primary" />
                            Build a landing page
                          </Link>
                        </Button>
                      </div>
                    </DialogHeader>
                  </DialogContent>
                </Dialog>
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
                    /^\/dashboard\/[^\/]+$/.test(pathname) && "bg-muted"
                  )}
                  asChild
                >
                  <Link href={`/dashboard`}>
                    {/^\/dashboard\/[^\/]+$/.test(pathname) && (
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
                    /^\/dashboard\/[^\/]+\/links(?:\/.*)?$/.test(pathname) &&
                      "bg-muted"
                  )}
                  asChild
                >
                  <Link href={`/dashboard/${user?.sub.split("|")[1]}/links`}>
                    {/^\/dashboard\/[^\/]+\/links(?:\/.*)?$/.test(pathname) && (
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
                    /^\/dashboard\/[^\/]+\/qr-codes(?:\/.*)?$/.test(pathname) &&
                      "bg-muted"
                  )}
                  asChild
                >
                  <Link href={`/dashboard/${user?.sub.split("|")[1]}/qr-codes`}>
                    {/^\/dashboard\/[^\/]+\/qr-codes(?:\/.*)?$/.test(
                      pathname
                    ) && (
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
                    /^\/dashboard\/[^\/]+\/pages(?:\/.*)?$/.test(pathname) &&
                      "bg-muted"
                  )}
                  asChild
                >
                  <Link href={`/dashboard/${user?.sub.split("|")[1]}/pages`}>
                    {/^\/dashboard\/[^\/]+\/pages(?:\/.*)?$/.test(pathname) && (
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
