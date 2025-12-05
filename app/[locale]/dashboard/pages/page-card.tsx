"use client";

import { deleteBioPage } from "@/app/actions/bioPageActions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { ScrollPopoverContent } from "@/components/ui/scroll-popover-content";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useRouter } from "@/i18n/navigation";
import { BASEURL } from "@/lib/utils";
import {
  EllipsisIcon,
  ImageIcon,
  LinkIcon,
  Palette,
  Share2,
  Trash2,
} from "lucide-react";
import {
  EmailIcon,
  EmailShareButton,
  FacebookIcon,
  FacebookShareButton,
  RedditIcon,
  RedditShareButton,
  TwitterIcon,
  TwitterShareButton,
  WhatsappIcon,
  WhatsappShareButton,
} from "next-share";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

export const PageCard = ({
  page,
}: {
  page: {
    title: string;
    slug: string;
    createdAt: Date;
    linkCount: number;
    image?: string;
  };
}) => {
  const [justCopied, setJustCopied] = useState(false);
  const router = useRouter();
  return (
    <div className="w-full md:p-6 sm:p-4 p-3 bg-background rounded-md border flex sm:flex-row flex-col gap-4 sm:items-stretch">
      <div className="w-full sm:max-w-[15%] max-w-[35%] sm:mx-0 mx-auto aspect-square h-auto sm:flex hidden items-center justify-center relative">
        {page.image ? (
          <Image
            src={page.image}
            alt={page.title}
            width={1080}
            height={1080}
            className="w-full h-auto aspect-square object-cover rounded-md"
          />
        ) : (
          <>
            <Skeleton className="w-full h-auto aspect-square rounded-md animate-none!" />
            <ImageIcon className="w-6 h-6 mx-auto my-auto absolute text-muted-foreground" />
          </>
        )}
      </div>
      <div className="grow h-full flex flex-col items-start gap-2 justify-between w-full">
        <div className="w-full flex flex-row gap-2 items-start justify-between">
          <div className="flex flex-col gap-1 items-start max-w-[70%] w-full">
            <h2 className="font-semibold lg:text-xl md:text-lg xs:text-base text-sm truncate w-full">
              {page.title}
            </h2>
            <Link
              className="xs:text-sm text-xs text-blue-600 hover:text-blue-900 truncate w-full"
              href={`${BASEURL}/b/${page.slug}`}
            >
              /b/{page.slug}
            </Link>
          </div>
          <div className="w-fit max-w-[30%] flex flex-col gap-1">
            <p className="sm:text-sm text-xs text-right font-medium w-max">
              {page.linkCount} Links
            </p>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  className="sm:hidden flex"
                  size="icon"
                  variant={"outline"}
                >
                  <EllipsisIcon />
                </Button>
              </PopoverTrigger>
              <ScrollPopoverContent className="p-0 gap-1 px-0 py-1">
                <div className="w-full flex flex-col gap-2">
                  <Button
                    asChild
                    variant={"outline"}
                    className="w-full border-none! rounded-none! justify-start! shadow-none!"
                  >
                    <Link href={`/dashboard/pages/${page.slug}`}>
                      <LinkIcon />
                      Manage links
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant={"outline"}
                    className="w-full border-none! rounded-none! justify-start! shadow-none!"
                  >
                    <Link href={`/dashboard/pages/${page.slug}/customize`}>
                      <Palette />
                      Customize
                    </Link>
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant={"outline"}
                        className="w-full border-none! rounded-none! justify-start! shadow-none!"
                      >
                        <Share2 />
                        Share
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Share your Shortn Page</DialogTitle>
                        <DialogDescription>
                          Share your page across social media.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="w-full grid grid-cols-5 gap-4">
                        <FacebookShareButton
                          url={`${BASEURL}/b/${page.slug}`}
                          quote={
                            "Check out my landing page built with Shortn.at"
                          }
                        >
                          <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                            <FacebookIcon size={32} round />
                          </div>
                        </FacebookShareButton>
                        <RedditShareButton
                          url={`${BASEURL}/b/${page.slug}`}
                          title={
                            "Check out my landing page built with Shortn.at"
                          }
                        >
                          <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                            <RedditIcon size={32} round />
                          </div>
                        </RedditShareButton>
                        <TwitterShareButton
                          url={`${BASEURL}/b/${page.slug}`}
                          title={
                            "Check out my landing page built with Shortn.at"
                          }
                        >
                          <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                            <TwitterIcon size={32} round />
                          </div>
                        </TwitterShareButton>
                        <WhatsappShareButton
                          url={`${BASEURL}/b/${page.slug}`}
                          title={
                            "Check out my landing page built with Shortn.at"
                          }
                          separator=" "
                        >
                          <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                            <WhatsappIcon size={32} round />
                          </div>
                        </WhatsappShareButton>
                        <EmailShareButton
                          url={`${BASEURL}/b/${page.slug}`}
                          subject="Checkout my Shortn.at landing page!"
                          body="Check out my landing page built with Shortn.at"
                        >
                          <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                            <EmailIcon size={32} round />
                          </div>
                        </EmailShareButton>
                      </div>
                      <Separator />
                      <div className="relative w-full flex items-center">
                        <Input
                          value={`${BASEURL}/b/${page.slug}`}
                          readOnly
                          className="w-full bg-background"
                        />
                        <Button
                          onClick={async () => {
                            await navigator.clipboard.writeText(
                              `${BASEURL}/b/${page.slug}`,
                            );
                            setJustCopied(true);
                            setTimeout(() => {
                              setJustCopied(false);
                            }, 1000);
                          }}
                          variant={"secondary"}
                          className="h-fit! py-1! px-2 text-xs font-bold z-10 hover:cursor-pointer absolute right-2"
                        >
                          {justCopied ? <>Copied</> : <>Copy</>}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button
                    onClick={() => {
                      toast.promise<{ success: boolean }>(
                        () => deleteBioPage({ slug: page.slug }),
                        {
                          loading: "Loading...",
                          success: () => {
                            router.refresh();
                            return "Your page has been deleted successfully.";
                          },
                          error: "Error",
                        },
                      );
                    }}
                    variant={"outline"}
                    className="w-full border-none! rounded-none! justify-start! shadow-none!"
                  >
                    <Trash2 />
                    Delete Page
                  </Button>
                </div>
              </ScrollPopoverContent>
            </Popover>
          </div>
        </div>
        <div className="w-full sm:flex flex-row items-center gap-2 flex-wrap justify-start hidden">
          <Button asChild variant={"outline"}>
            <Link href={`/dashboard/pages/${page.slug}`}>
              <LinkIcon />
              Manage links
            </Link>
          </Button>
          <Button asChild variant={"outline"}>
            <Link href={`/dashboard/pages/${page.slug}/customize`}>
              <Palette />
              Customize
            </Link>
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant={"outline"}>
                <Share2 />
                Share
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Share your Shortn Page</DialogTitle>
                <DialogDescription>
                  Share your page across social media.
                </DialogDescription>
              </DialogHeader>
              <div className="w-full grid grid-cols-5 gap-4">
                <FacebookShareButton
                  url={`${BASEURL}/b/${page.slug}`}
                  quote={"Check out my landing page built with Shortn.at"}
                >
                  <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                    <FacebookIcon size={32} round />
                  </div>
                </FacebookShareButton>
                <RedditShareButton
                  url={`${BASEURL}/b/${page.slug}`}
                  title={"Check out my landing page built with Shortn.at"}
                >
                  <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                    <RedditIcon size={32} round />
                  </div>
                </RedditShareButton>
                <TwitterShareButton
                  url={`${BASEURL}/b/${page.slug}`}
                  title={"Check out my landing page built with Shortn.at"}
                >
                  <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                    <TwitterIcon size={32} round />
                  </div>
                </TwitterShareButton>
                <WhatsappShareButton
                  url={`${BASEURL}/b/${page.slug}`}
                  title={"Check out my landing page built with Shortn.at"}
                  separator=" "
                >
                  <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                    <WhatsappIcon size={32} round />
                  </div>
                </WhatsappShareButton>
                <EmailShareButton
                  url={`${BASEURL}/b/${page.slug}`}
                  subject="Checkout my Shortn.at landing page!"
                  body="Check out my landing page built with Shortn.at"
                >
                  <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                    <EmailIcon size={32} round />
                  </div>
                </EmailShareButton>
              </div>
              <Separator />
              <div className="relative w-full flex items-center">
                <Input
                  value={`${BASEURL}/b/${page.slug}`}
                  readOnly
                  className="w-full bg-background"
                />
                <Button
                  onClick={async () => {
                    await navigator.clipboard.writeText(
                      `${BASEURL}/b/${page.slug}`,
                    );
                    setJustCopied(true);
                    setTimeout(() => {
                      setJustCopied(false);
                    }, 1000);
                  }}
                  variant={"secondary"}
                  className="h-fit! py-1! px-2 text-xs font-bold z-10 hover:cursor-pointer absolute right-2"
                >
                  {justCopied ? <>Copied</> : <>Copy</>}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            onClick={() => {
              toast.promise<{ success: boolean }>(
                () => deleteBioPage({ slug: page.slug }),
                {
                  loading: "Loading...",
                  success: () => {
                    router.refresh();
                    return "Your page has been deleted successfully.";
                  },
                  error: "Error",
                },
              );
            }}
            variant={"outline"}
          >
            <Trash2 />
            Delete Page
          </Button>
        </div>
      </div>
    </div>
  );
};
