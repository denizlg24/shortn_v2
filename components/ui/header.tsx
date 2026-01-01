"use client";
import { Link } from "@/i18n/navigation";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "./navigation-menu";
import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import Hamburger from "hamburger-react";
import logo from "@/public/logo.png";
import {
  BarChart,
  ChevronDown,
  Contact,
  ExternalLink,
  HelpCircle,
  LinkIcon,
  LogIn,
  NotepadText,
  QrCode,
  Users,
} from "lucide-react";
import { Button } from "./button";
import { Separator } from "./separator";
import { LocaleSwitcher } from "./locale-switcher";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { PopoverClose } from "@radix-ui/react-popover";
import { authClient } from "@/lib/authClient";
import { Avatar, AvatarImage } from "./avatar";
import { AvatarFallback } from "@radix-ui/react-avatar";

export const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setOpen] = useState(false);
  const { data } = authClient.useSession();
  const user = data?.user;
  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={cn(
        "fixed sm:top-4 top-0 sm:w-fit w-full sm:h-16 h-12 backdrop-blur-3xl bg-background/50 z-90 transition-all flex flex-row sm:rounded-full sm:p-4 p-2 sm:px-6 px-4 shadow-xs border",
        isScrolled && "shadow-md bg-background",
        isOpen && "shadow-none bg-background backdrop-none border-0",
      )}
    >
      <div className="max-w-7xl mx-auto flex flex-row justify-between w-full gap-4">
        <Link href="/" className="h-full">
          <Image
            src={logo}
            width={256}
            height={256}
            priority
            alt="Logo"
            className="w-auto h-full aspect-square rounded shadow"
          />
        </Link>
        <NavigationMenu className="border-l w-full h-full sm:flex hidden pl-4">
          <NavigationMenuList className="gap-4">
            <Popover>
              <PopoverTrigger className="group" asChild>
                <Button
                  className={cn(
                    "p-0! bg-transparent! border-0! shadow-none! text-primary! hover:cursor-pointer",
                    !isScrolled && "bg-transparent!",
                    navigationMenuTriggerStyle(),
                  )}
                >
                  Platform
                  <ChevronDown className="group-data-[state=open]:rotate-180 transition-transform" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="center" asChild>
                <div className="md:w-[400px] lg:w-[650px] w-[300px] grid lg:grid-cols-2 grid-cols-1 py-6 px-4 gap-4 z-99">
                  <div className="col-span-full w-full flex flex-col items-start gap-2">
                    <h1 className="font-semibold uppercase text-muted-foreground">
                      Products
                    </h1>
                    <Separator className="col-span-full w-full" />
                  </div>
                  <Button
                    asChild
                    variant={"ghost"}
                    className="h-full! p-2! -ml-2!"
                  >
                    <PopoverClose asChild>
                      <Link
                        href={"/products/url-shortener"}
                        className="flex flex-row gap-2 items-stretch col-span-1 hover:bg-border/65"
                      >
                        <div className="h-full w-auto aspect-square rounded bg-accent flex items-center justify-center p-2">
                          <LinkIcon className="text-primary w-full h-auto aspect-square" />
                        </div>
                        <div className="flex flex-col gap-0 w-full">
                          <h2 className="text-primary font-semibold text-sm">
                            URL Shortener
                          </h2>
                          <p className="text-xs">
                            Customize, share and track links
                          </p>
                        </div>
                      </Link>
                    </PopoverClose>
                  </Button>

                  <Button
                    asChild
                    variant={"ghost"}
                    className="h-full! p-2! -ml-2!"
                  >
                    <PopoverClose asChild>
                      <Link
                        href={"/products/qr-code"}
                        className="flex flex-row gap-2 items-stretch col-span-1 hover:bg-border/65"
                      >
                        <div className="h-full w-auto aspect-square rounded bg-muted flex items-center justify-center p-2">
                          <QrCode className="text-primary w-full h-auto aspect-square" />
                        </div>
                        <div className="flex flex-col gap-0 w-full">
                          <h2 className="text-primary font-semibold text-sm">
                            QR Code Generator
                          </h2>
                          <p className="text-xs">
                            Dynamic solutions to fit every business need
                          </p>
                        </div>
                      </Link>
                    </PopoverClose>
                  </Button>
                  <Button
                    asChild
                    variant={"ghost"}
                    className="h-full! p-2! -ml-2!"
                  >
                    <PopoverClose asChild>
                      <Link
                        href={"/products/pages"}
                        className="flex flex-row gap-2 items-stretch col-span-1 hover:bg-border/65"
                      >
                        <div className="h-full w-auto aspect-square rounded bg-muted flex items-center justify-center p-2">
                          <NotepadText className="text-primary w-full h-auto aspect-square" />
                        </div>
                        <div className="flex flex-col gap-0 w-full">
                          <h2 className="text-primary font-semibold text-sm">
                            Pages
                          </h2>
                          <p className="text-xs">
                            Mobile-friendly, no-code landing pages
                          </p>
                        </div>
                      </Link>
                    </PopoverClose>
                  </Button>
                  <Button
                    asChild
                    variant={"ghost"}
                    className="h-full! p-2! -ml-2!"
                  >
                    <PopoverClose asChild>
                      <Link
                        href={"/products/analytics"}
                        className="flex flex-row gap-2 items-stretch col-span-1 hover:bg-border/65"
                      >
                        <div className="h-full w-auto aspect-square rounded bg-muted flex items-center justify-center p-2">
                          <BarChart className="text-primary w-full h-auto aspect-square" />
                        </div>
                        <div className="flex flex-col gap-0 w-full">
                          <h2 className="text-primary font-semibold text-sm">
                            Analytics
                          </h2>
                          <p className="text-xs">
                            A central place to track performance
                          </p>
                        </div>
                      </Link>
                    </PopoverClose>
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <NavigationMenuItem>
              <NavigationMenuLink
                asChild
                className={cn(
                  "p-0! hover:bg-transparent!",
                  !isScrolled && "bg-transparent!",
                  navigationMenuTriggerStyle(),
                )}
              >
                <Link href="/pricing">Pricing</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <Popover>
              <PopoverTrigger className="group" asChild>
                <Button
                  className={cn(
                    "p-0! bg-transparent! border-0! shadow-none! text-primary! hover:cursor-pointer",
                    !isScrolled && "bg-transparent!",
                    navigationMenuTriggerStyle(),
                  )}
                >
                  Resources
                  <ChevronDown className="group-data-[state=open]:rotate-180 transition-transform" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="center" asChild>
                <div className="md:w-[400px] lg:w-[650px] w-[300px] grid lg:grid-cols-2 grid-cols-1 py-6 px-4 gap-4 z-99">
                  <div className="col-span-full w-full flex flex-col items-start gap-2">
                    <h1 className="font-semibold uppercase text-muted-foreground">
                      Find Answers
                    </h1>
                    <Separator className="col-span-full w-full" />
                  </div>
                  <Button
                    asChild
                    variant={"ghost"}
                    className="h-full! p-2! -ml-2!"
                  >
                    <PopoverClose asChild>
                      <Link
                        href={"/help"}
                        className="flex flex-row gap-2 items-stretch col-span-1 hover:bg-border/65"
                      >
                        <div className="h-full w-auto aspect-square rounded bg-accent flex items-center justify-center p-2">
                          <HelpCircle className="text-primary w-full h-auto aspect-square" />
                        </div>
                        <div className="flex flex-col gap-0 w-full">
                          <h2 className="text-primary font-semibold text-sm">
                            Help Center
                          </h2>
                          <p className="text-xs">Get help for our products.</p>
                        </div>
                      </Link>
                    </PopoverClose>
                  </Button>

                  <Button
                    asChild
                    variant={"ghost"}
                    className="h-full! p-2! -ml-2!"
                  >
                    <PopoverClose asChild>
                      <Link
                        href={"/contact"}
                        className="flex flex-row gap-2 items-stretch col-span-1 hover:bg-border/65"
                      >
                        <div className="h-full w-auto aspect-square rounded bg-muted flex items-center justify-center p-2">
                          <Contact className="text-primary w-full h-auto aspect-square" />
                        </div>
                        <div className="flex flex-col gap-0 w-full">
                          <h2 className="text-primary font-semibold text-sm">
                            Contact Us
                          </h2>
                          <p className="text-xs">Get in touch with our team.</p>
                        </div>
                      </Link>
                    </PopoverClose>
                  </Button>
                  <Button
                    asChild
                    variant={"ghost"}
                    className="h-full! p-2! -ml-2!"
                  >
                    <PopoverClose asChild>
                      <Link
                        href={"/about"}
                        className="flex flex-row gap-2 items-stretch col-span-1 hover:bg-border/65"
                      >
                        <div className="h-full w-auto aspect-square rounded bg-muted flex items-center justify-center p-2">
                          <Users className="text-primary w-full h-auto aspect-square" />
                        </div>
                        <div className="flex flex-col gap-0 w-full">
                          <h2 className="text-primary font-semibold text-sm">
                            About Us
                          </h2>
                          <p className="text-xs">Find out more about shortn.</p>
                        </div>
                      </Link>
                    </PopoverClose>
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <div className="w-px h-7 bg-border"></div>
            <NavigationMenuItem asChild>
              {user ? (
                <Button
                  className="rounded-full h-auto w-fit p-0! -mr-3 border shadow-xs aspect-square!"
                  variant={"outline"}
                  asChild
                >
                  <Link href="/dashboard">
                    <Avatar className="w-8 h-8 rounded-full">
                      {user.image && (
                        <AvatarImage
                          src={user.image}
                          className="object-cover rounded-full"
                        />
                      )}
                      <AvatarFallback className="bg-muted flex items-center justify-center text-center w-full h-full aspect-square">
                        {user.name?.charAt(0)}
                        {user.name?.charAt(1)}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                </Button>
              ) : (
                <Button
                  className="rounded-full h-auto w-fit p-2! -mr-3 border shadow-xs aspect-square!"
                  variant={"default"}
                  asChild
                >
                  <Link href="/login">
                    <LogIn />
                  </Link>
                </Button>
              )}
            </NavigationMenuItem>
            <NavigationMenuItem>
              <LocaleSwitcher />
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
        <div className="w-auto h-full aspect-square sm:hidden flex items-center justify-center z-99">
          <Sheet onOpenChange={setOpen} open={isOpen}>
            <SheetTrigger>
              <Hamburger size={16} toggled={isOpen} />
            </SheetTrigger>
            <SheetContent className="sm:pt-16! pt-12! w-full sm:max-w-[540px] max-w-[300px] border-l">
              <div className="hidden">
                <SheetHeader>
                  <SheetTitle>Hamburguer Menu</SheetTitle>
                </SheetHeader>
              </div>
              <NavigationMenu className="flex flex-col w-full max-w-full! px-4 py-4 items-stretch relative justify-start border-t">
                <NavigationMenuList className="flex flex-col w-full items-stretch">
                  <NavigationMenuItem>
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="item-1">
                        <AccordionTrigger>Products</AccordionTrigger>
                        <AccordionContent>
                          <Separator />
                          <SheetClose asChild>
                            <Button
                              asChild
                              variant={"ghost"}
                              className="h-full! p-2! -ml-2!"
                            >
                              <Link
                                href={"/products/url-shortener"}
                                className="flex flex-row gap-2 items-stretch col-span-1 hover:bg-border/65"
                              >
                                <div className="h-full w-auto aspect-square rounded bg-accent flex items-center justify-center p-2">
                                  <LinkIcon className="text-primary w-full h-auto aspect-square" />
                                </div>
                                <div className="flex flex-col gap-0 w-full">
                                  <h2 className="text-primary font-semibold text-sm">
                                    URL Shortener
                                  </h2>
                                  <p className="text-xs">
                                    Customize, share and track links
                                  </p>
                                </div>
                              </Link>
                            </Button>
                          </SheetClose>
                          <SheetClose asChild>
                            <Button
                              asChild
                              variant={"ghost"}
                              className="h-full! p-2! -ml-2!"
                            >
                              <Link
                                href={"/products/qr-code"}
                                className="flex flex-row gap-2 items-stretch col-span-1 hover:bg-border/65"
                              >
                                <div className="h-full w-auto aspect-square rounded bg-muted flex items-center justify-center p-2">
                                  <QrCode className="text-primary w-full h-auto aspect-square" />
                                </div>
                                <div className="flex flex-col gap-0 w-full">
                                  <h2 className="text-primary font-semibold text-sm">
                                    QR Code Generator
                                  </h2>
                                  <p className="text-xs">
                                    Dynamic solutions to fit every business need
                                  </p>
                                </div>
                              </Link>
                            </Button>
                          </SheetClose>
                          <SheetClose asChild>
                            <Button
                              asChild
                              variant={"ghost"}
                              className="h-full! p-2! -ml-2!"
                            >
                              <Link
                                href={"/products/pages"}
                                className="flex flex-row gap-2 items-stretch col-span-1 hover:bg-border/65"
                              >
                                <div className="h-full w-auto aspect-square rounded bg-muted flex items-center justify-center p-2">
                                  <NotepadText className="text-primary w-full h-auto aspect-square" />
                                </div>
                                <div className="flex flex-col gap-0 w-full">
                                  <h2 className="text-primary font-semibold text-sm">
                                    Pages
                                  </h2>
                                  <p className="text-xs">
                                    Mobile-friendly, no-code landing pages
                                  </p>
                                </div>
                              </Link>
                            </Button>
                          </SheetClose>
                          <SheetClose asChild>
                            <Button
                              asChild
                              variant={"ghost"}
                              className="h-full! p-2! -ml-2!"
                            >
                              <Link
                                href={"/products/analytics"}
                                className="flex flex-row gap-2 items-stretch col-span-1 hover:bg-border/65"
                              >
                                <div className="h-full w-auto aspect-square rounded bg-muted flex items-center justify-center p-2">
                                  <BarChart className="text-primary w-full h-auto aspect-square" />
                                </div>
                                <div className="flex flex-col gap-0 w-full">
                                  <h2 className="text-primary font-semibold text-sm">
                                    Analytics
                                  </h2>
                                  <p className="text-xs">
                                    A central place to track performance
                                  </p>
                                </div>
                              </Link>
                            </Button>
                          </SheetClose>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <SheetClose asChild>
                      <NavigationMenuLink
                        asChild
                        className={cn(navigationMenuTriggerStyle(), "pl-0")}
                      >
                        <Link href="/pricing">Pricing</Link>
                      </NavigationMenuLink>
                    </SheetClose>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="item-1">
                        <AccordionTrigger>Resources</AccordionTrigger>
                        <AccordionContent>
                          <Separator />
                          <SheetClose asChild>
                            <Button
                              asChild
                              variant={"ghost"}
                              className="h-full! p-2! -ml-2!"
                            >
                              <Link
                                href={"/help"}
                                className="flex flex-row gap-2 items-stretch col-span-1 hover:bg-border/65"
                              >
                                <div className="h-full w-auto aspect-square rounded bg-accent flex items-center justify-center p-2">
                                  <HelpCircle className="text-primary w-full h-auto aspect-square" />
                                </div>
                                <div className="flex flex-col gap-0 w-full">
                                  <h2 className="text-primary font-semibold text-sm">
                                    Help Center
                                  </h2>
                                  <p className="text-xs">
                                    Get help for our products.
                                  </p>
                                </div>
                              </Link>
                            </Button>
                          </SheetClose>
                          <SheetClose asChild>
                            <Button
                              asChild
                              variant={"ghost"}
                              className="h-full! p-2! -ml-2!"
                            >
                              <Link
                                href={"/contact"}
                                className="flex flex-row gap-2 items-stretch col-span-1 hover:bg-border/65"
                              >
                                <div className="h-full w-auto aspect-square rounded bg-muted flex items-center justify-center p-2">
                                  <Contact className="text-primary w-full h-auto aspect-square" />
                                </div>
                                <div className="flex flex-col gap-0 w-full">
                                  <h2 className="text-primary font-semibold text-sm">
                                    Contact Us
                                  </h2>
                                  <p className="text-xs">
                                    Get in touch with our team.
                                  </p>
                                </div>
                              </Link>
                            </Button>
                          </SheetClose>
                          <SheetClose asChild>
                            <Button
                              asChild
                              variant={"ghost"}
                              className="h-full! p-2! -ml-2!"
                            >
                              <Link
                                href={"/about"}
                                className="flex flex-row gap-2 items-stretch col-span-1 hover:bg-border/65"
                              >
                                <div className="h-full w-auto aspect-square rounded bg-muted flex items-center justify-center p-2">
                                  <Users className="text-primary w-full h-auto aspect-square" />
                                </div>
                                <div className="flex flex-col gap-0 w-full">
                                  <h2 className="text-primary font-semibold text-sm">
                                    About Us
                                  </h2>
                                  <p className="text-xs">
                                    Find out more about shortn.
                                  </p>
                                </div>
                              </Link>
                            </Button>
                          </SheetClose>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </NavigationMenuItem>
                  {user ? (
                    <NavigationMenuItem asChild>
                      <SheetClose asChild>
                        <Button asChild>
                          <Link href="/dashboard">
                            Dashboard <ExternalLink />
                          </Link>
                        </Button>
                      </SheetClose>
                    </NavigationMenuItem>
                  ) : (
                    <>
                      <NavigationMenuItem asChild>
                        <SheetClose asChild>
                          <Button asChild>
                            <Link href="/login">Login</Link>
                          </Button>
                        </SheetClose>
                      </NavigationMenuItem>
                      <NavigationMenuItem asChild>
                        <SheetClose asChild>
                          <Button variant={"outline"} asChild>
                            <Link href="/register">Register</Link>
                          </Button>
                        </SheetClose>
                      </NavigationMenuItem>
                    </>
                  )}
                </NavigationMenuList>
              </NavigationMenu>
              <SheetFooter>
                <div className="mx-auto">
                  <LocaleSwitcher />
                </div>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};
