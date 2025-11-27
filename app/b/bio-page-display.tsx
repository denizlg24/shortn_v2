"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageIcon } from "lucide-react";
import { GetSocialIcon } from "../[locale]/dashboard/pages/[slug]/customize/customize-page";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { loadFont } from "@/lib/fonts";
const BioHeader = ({
  header,
  preview,
  bio,
}: {
  bio: {
    title: string;
    description?: string;
    avatarUrl?: string;
    avatarShape?: "circle" | "square" | "rounded";
  };
  header?: {
    headerStyle: "centered" | "left-aligned" | "right-aligned";
    headerBackgroundImage?: string;
    headerBackgroundColor?: string;
  };
  preview: boolean;
}) => {
  switch (header?.headerStyle) {
    case "left-aligned":
      return (
        <header
          className="w-full flex flex-col items-start p-4 h-[15vh] min-h-[100px] relative"
          style={{
            backgroundColor: header.headerBackgroundColor || "#0f172b",
            backgroundImage: header.headerBackgroundImage
              ? `url(${header.headerBackgroundImage})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute flex flex-col gap-4 items-start w-full max-w-2xs  -bottom-11">
            {preview || bio.avatarUrl ? (
              <Avatar
                className={cn("w-24 h-24", {
                  "rounded-full": bio.avatarShape === "circle",
                  "rounded-lg": bio.avatarShape === "rounded",
                  "rounded-none": bio.avatarShape === "square",
                })}
              >
                <AvatarImage
                  className="object-cover"
                  src={bio.avatarUrl}
                  alt={bio.title}
                />
                <AvatarFallback className="capitalize">
                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="pointer-events-none w-24 h-24"></div>
            )}
          </div>
        </header>
      );
    case "right-aligned":
      return (
        <header
          className="w-full flex flex-col items-end p-4 h-[15vh] min-h-[100px] relative"
          style={{
            backgroundColor: header.headerBackgroundColor || "#0f172b",
            backgroundImage: header.headerBackgroundImage
              ? `url(${header.headerBackgroundImage})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute flex flex-col gap-4 items-end w-full max-w-2xs -bottom-11">
            {preview || bio.avatarUrl ? (
              <Avatar
                className={cn("w-24 h-24", {
                  "rounded-full": bio.avatarShape === "circle",
                  "rounded-lg": bio.avatarShape === "rounded",
                  "rounded-none": bio.avatarShape === "square",
                })}
              >
                <AvatarImage
                  className="object-cover"
                  src={bio.avatarUrl}
                  alt={bio.title}
                />
                <AvatarFallback className="capitalize">
                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="pointer-events-none w-24 h-24"></div>
            )}
          </div>
        </header>
      );
    case "centered":
      return (
        <header
          className="w-full flex flex-col items-center p-4 h-[15vh] min-h-[100px] relative"
          style={{
            backgroundColor: header.headerBackgroundColor || "#0f172b",
            backgroundImage: header.headerBackgroundImage
              ? `url(${header.headerBackgroundImage})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute flex flex-col gap-4 items-center w-full max-w-2xs -bottom-11">
            {preview || bio.avatarUrl ? (
              <Avatar
                className={cn("w-24 h-24", {
                  "rounded-full": bio.avatarShape === "circle",
                  "rounded-lg": bio.avatarShape === "rounded",
                  "rounded-none": bio.avatarShape === "square",
                })}
              >
                <AvatarImage
                  className="object-cover"
                  src={bio.avatarUrl}
                  alt={bio.title}
                />
                <AvatarFallback className="capitalize">
                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="pointer-events-none w-24 h-24"></div>
            )}
          </div>
        </header>
      );
    default:
      return (
        <header className="w-full flex flex-col items-center pt-12">
          <div className="flex flex-col gap-4 items-center w-full max-w-2xs">
            {(preview || bio.avatarUrl) && (
              <Avatar
                className={cn("w-24 h-24", {
                  "rounded-full": bio.avatarShape === "circle",
                  "rounded-lg": bio.avatarShape === "rounded",
                  "rounded-none": bio.avatarShape === "square",
                })}
              >
                <AvatarImage
                  className="object-cover"
                  src={bio.avatarUrl}
                  alt={bio.title}
                />
                <AvatarFallback className="capitalize">
                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </header>
      );
  }
};

export const BioPageDisplay = ({
  bio,
  preview = true,
}: {
  bio: {
    userId: string;
    slug: string;
    title: string;
    description?: string;
    avatarUrl?: string;
    avatarShape?: "circle" | "square" | "rounded";
    theme?: {
      primaryColor?: string;
      background?: string;
      textColor?: string;
      buttonStyle?: "rounded" | "square" | "pill";
      font?: string;
      header?: {
        headerStyle: "centered" | "left-aligned" | "right-aligned";
        headerBackgroundImage?: string;
        headerBackgroundColor?: string;
      };
    };
    links: {
      link: { shortUrl: string; title: string };
      image?: string;
      title?: string;
    }[];
    socials?: { platform?: string; url?: string }[];
    socialColor: string | "original";
    createdAt: Date;
    updatedAt: Date;
  };
  preview?: boolean;
}) => {
  // Load the Google Font if one is specified
  useEffect(() => {
    if (bio.theme?.font && bio.theme.font !== "inherit") {
      // Extract just the font family name (remove fallbacks like ", sans-serif")
      const fontFamily = bio.theme.font
        .split(",")[0]
        .replace(/['"]/g, "")
        .trim();

      loadFont(fontFamily).catch((error) => {
        console.error(`Failed to load font "${fontFamily}":`, error);
      });
    }
  }, [bio.theme?.font]);

  return (
    <div
      style={{
        background: bio.theme?.background || "#ffffff",
        color: bio.theme?.textColor || "#000000",
        fontFamily: bio.theme?.font || "inherit",
      }}
      className="w-full h-full min-h-screen flex flex-col gap-2"
    >
      <BioHeader
        header={bio.theme?.header}
        preview={preview}
        bio={{
          title: bio.title,
          avatarUrl: bio.avatarUrl,
          avatarShape: bio.avatarShape,
          description: bio.description,
        }}
      />
      {!bio.theme?.header && (
        <div
          className={cn(
            "w-full flex flex-col gap-1 items-center text-center mt-6 px-4",
          )}
        >
          <h1 className="mx-auto text-xl font-black text-center">
            {bio.title}
          </h1>
          {bio.description && (
            <h2
              style={{ color: bio.theme?.textColor || "#000000" }}
              className="text-sm font-light opacity-75 text-center mx-auto truncate"
            >
              {bio.description}
            </h2>
          )}
        </div>
      )}
      {bio?.theme?.header?.headerStyle === "centered" && (
        <div
          className={cn(
            "w-full flex flex-col gap-1 items-center text-center mt-6 px-4",
            (bio.avatarUrl || preview) && "mt-12",
          )}
        >
          <h1 className="mx-auto text-xl font-black text-center">
            {bio.title}
          </h1>
          {bio.description && (
            <h2
              style={{ color: bio.theme?.textColor || "#000000" }}
              className="text-sm font-light opacity-75 text-center mx-auto truncate"
            >
              {bio.description}
            </h2>
          )}
        </div>
      )}
      {bio.theme?.header?.headerStyle === "right-aligned" && (
        <div
          className={cn(
            "w-full flex flex-col gap-1 items-end text-right mt-6 px-4",
            (bio.avatarUrl || preview) && "mt-12",
          )}
        >
          <h1 className="text-xl font-black text-right">{bio.title}</h1>
          {bio.description && (
            <h2
              style={{ color: bio.theme?.textColor || "#000000" }}
              className="text-sm font-light opacity-75 text-right truncate w-full"
            >
              {bio.description}
            </h2>
          )}
        </div>
      )}
      {bio.theme?.header?.headerStyle === "left-aligned" && (
        <div
          className={cn(
            "w-full flex flex-col gap-1 items-start text-left mt-6 px-4",
            (bio.avatarUrl || preview) && "mt-12",
          )}
        >
          <h1 className="text-xl font-black text-left">{bio.title}</h1>
          {bio.description && (
            <h2
              style={{ color: bio.theme?.textColor || "#000000" }}
              className="text-sm font-light opacity-75 text-left truncate w-full"
            >
              {bio.description}
            </h2>
          )}
        </div>
      )}
      {bio.socials && bio.socials.length > 0 && (
        <div
          className={cn(
            "w-full grid grid-cols-[repeat(auto-fit,_12.5%)] justify-center gap-0.55 max-w-2xs mx-auto",
          )}
        >
          {bio.socials
            .filter((s) => !!s.url)
            .map((social) => (
              <a
                key={social.platform}
                href={
                  social.url?.startsWith("http") ||
                  social.url?.startsWith("https")
                    ? social.url
                    : `https://${social.url}`
                }
                target="_blank"
                className="col-span-1 w-full h-auto aspect-square flex items-center justify-center hover:scale-105 transition-transform"
              >
                <GetSocialIcon
                  platform={social.platform}
                  color={
                    bio.socialColor === "original" ? undefined : bio.socialColor
                  }
                />
              </a>
            ))}
        </div>
      )}
    </div>
  );
};
