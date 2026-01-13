"use client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  ChevronLeft,
  Folder,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { useState } from "react";
import { authClient } from "@/lib/authClient";
import logo from "@/public/logo.png";
import { useTranslations } from "next-intl";

export const AppSidebar = () => {
  const { data } = authClient.useSession();
  const session = data;
  const { toggleSidebar, state } = useSidebar();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations("dashboard.sidebar");

  return (
    <Sidebar collapsible="icon" className="z-90">
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
                  src={logo}
                  width={1080}
                  height={1080}
                  className="w-8 h-8 rounded"
                />
                <span>{t("brand")}</span>
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
                state == "collapsed" && "rotate-180 transition-transform",
              )}
            />
            <span className="sr-only">{t("toggle-sidebar")}</span>
          </Button>
        </div>
        <SidebarGroup className="mt-4 pt-0!">
          {session && session.user && (
            <>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuButton asChild>
                    <Dialog
                      open={createDialogOpen}
                      onOpenChange={setCreateDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <Button className="group-data-[collapsible=icon]:p-2.5! hover:bg-primary bg-primary text-primary-foreground hover:text-primary-foreground font-semibold group-data-[collapsible=icon]:w-10! h-10! group-data-[collapsible=icon]:h-10!">
                          {state == "collapsed" && (
                            <Plus className="w-5! h-5!" />
                          )}
                          {state != "collapsed" && (
                            <span className="mx-auto">{t("create-new")}</span>
                          )}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="w-full lg:max-w-[800px]! md:max-w-[500px]! z-99">
                        <DialogHeader>
                          <DialogTitle className="mb-2 font-semibold! text-lg!">
                            {t("create-dialog-title")}
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
                              <Link href={`/dashboard/links/create`}>
                                <LinkIcon className="text-primary" />
                                {t("shorten-link")}
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
                              <Link href={`/dashboard/qr-codes/create`}>
                                <QrCode className="text-primary" />
                                {t("create-qr-code")}
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
                              <Link href={`/dashboard/pages/create`}>
                                <NotepadText className="text-primary" />
                                {t("build-landing-page")}
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
                        pathname == "/dashboard" && "bg-muted",
                      )}
                      asChild
                    >
                      <Link href={`/dashboard`}>
                        {pathname == "/dashboard" && (
                          <div className="absolute w-1 h-5 bg-primary left-0 my-auto"></div>
                        )}
                        <Home className="w-5! h-5!" />
                        {state != "collapsed" && (
                          <span className="">{t("home")}</span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className={cn(
                        "group-data-[collapsible=icon]:p-2.5! relative group-data-[collapsible=icon]:w-10! h-10! group-data-[collapsible=icon]:h-10!",
                        pathname.startsWith("/dashboard/links") && "bg-muted",
                      )}
                      asChild
                    >
                      <Link href={`/dashboard/links`}>
                        {pathname.startsWith("/dashboard/links") && (
                          <div className="absolute w-1 h-5 bg-primary left-0 my-auto"></div>
                        )}
                        <LinkIcon className="w-5! h-5!" />
                        {state != "collapsed" && (
                          <span className="">{t("links")}</span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className={cn(
                        "group-data-[collapsible=icon]:p-2.5! relative group-data-[collapsible=icon]:w-10! h-10! group-data-[collapsible=icon]:h-10!",
                        pathname.startsWith("/dashboard/qr-codes") &&
                          "bg-muted",
                      )}
                      asChild
                    >
                      <Link href={`/dashboard/qr-codes`}>
                        {pathname.startsWith("/dashboard/qr-codes") && (
                          <div className="absolute w-1 h-5 bg-primary left-0 my-auto"></div>
                        )}
                        <QrCode className="w-5! h-5!" />
                        {state != "collapsed" && (
                          <span className="">{t("qr-codes")}</span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className={cn(
                        "group-data-[collapsible=icon]:p-2.5! relative group-data-[collapsible=icon]:w-10! h-10! group-data-[collapsible=icon]:h-10!",
                        pathname.startsWith("/dashboard/pages") && "bg-muted",
                      )}
                      asChild
                    >
                      <Link href={`/dashboard/pages`}>
                        {pathname.startsWith("/dashboard/pages") && (
                          <div className="absolute w-1 h-5 bg-primary left-0 my-auto"></div>
                        )}
                        <NotepadText className="w-5! h-5!" />
                        {state != "collapsed" && (
                          <span className="">{t("pages")}</span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className={cn(
                        "group-data-[collapsible=icon]:p-2.5! relative group-data-[collapsible=icon]:w-10! h-10! group-data-[collapsible=icon]:h-10!",
                        pathname.startsWith("/dashboard/campaigns") &&
                          "bg-muted",
                      )}
                      asChild
                    >
                      <Link href={`/dashboard/campaigns`}>
                        {pathname.startsWith("/dashboard/campaigns") && (
                          <div className="absolute w-1 h-5 bg-primary left-0 my-auto"></div>
                        )}
                        <Folder className="w-5! h-5!" />
                        {state != "collapsed" && (
                          <span className="">{t("campaigns")}</span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </>
          )}
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};
