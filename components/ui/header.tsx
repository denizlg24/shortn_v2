"use client";
import { Link } from "@/i18n/navigation";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "./navigation-menu";
import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import Hamburger from "hamburger-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible";
import {
  BarChart,
  ChevronDown,
  Contact,
  HelpCircle,
  LinkIcon,
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
  SheetDescription,
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

export const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setOpen] = useState(false);
  const [isToursBurgerOpen, setToursBurgerOpen] = useState(false);

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
        "fixed top-0 p-2 w-full sm:h-16 h-12 bg-background backdrop-blur-3xl z-90 transition-shadow flex flex-row",
        isScrolled && "shadow-md"
      )}
    >
      <div className="max-w-7xl mx-auto flex flex-row justify-between w-full">
        <Link href="/" className="h-full">
          <Image
            src="/logo.png"
            width={256}
            height={256}
            priority
            alt="Logo"
            className="w-auto h-full aspect-square rounded shadow"
          />
        </Link>
        <NavigationMenu className="w-full h-full sm:flex hidden">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Platform</NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="md:w-[400px] lg:w-[650px] w-[300px] grid lg:grid-cols-2 grid-cols-1 py-6 px-4 gap-4">
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
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                asChild
                className={navigationMenuTriggerStyle()}
              >
                <Link href="/pricing">Pricing</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Resources</NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="md:w-[400px] lg:w-[650px] w-[300px] grid lg:grid-cols-2 grid-cols-1 py-6 px-4 gap-4">
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
                  </Button>

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
                        <p className="text-xs">Get in touch with our team.</p>
                      </div>
                    </Link>
                  </Button>
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
                        <p className="text-xs">Find out more about shortn.</p>
                      </div>
                    </Link>
                  </Button>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem asChild>
              <Button asChild>
                <Link href="/login">Login</Link>
              </Button>
            </NavigationMenuItem>
            <NavigationMenuItem asChild>
              <Button variant={"outline"} asChild>
                <Link href="/register">Register</Link>
              </Button>
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
              <NavigationMenu className="flex flex-col w-full max-w-full! px-4 py-4 items-stretch relative justify-start">
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
                  <NavigationMenuItem asChild>
                    <Button asChild>
                      <Link href="/login">Login</Link>
                    </Button>
                  </NavigationMenuItem>
                  <NavigationMenuItem asChild>
                    <Button variant={"outline"} asChild>
                      <Link href="/register">Register</Link>
                    </Button>
                  </NavigationMenuItem>
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
