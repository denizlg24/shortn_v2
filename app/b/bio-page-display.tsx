"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageIcon } from "lucide-react";
const BioHeader = ({
  header,
  preview,
  bio,
}: {
  bio: {
    title: string;
    description?: string;
    avatarUrl?: string;
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
          className="w-full flex flex-col items-start p-4 h-[100px]"
          style={{
            backgroundColor: header.headerBackgroundColor || "#0f172b",
            backgroundImage: header.headerBackgroundImage
              ? `url(${header.headerBackgroundImage})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="flex flex-col gap-4 items-start w-full max-w-2xs translate-y-8">
            {preview || bio.avatarUrl ? (
              <Avatar className="w-24 h-24">
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
            <div className="w-full flex flex-col gap-1 items-start text-left">
              <h1 className="text-xl font-black text-left">{bio.title}</h1>
              {bio.description && (
                <h2 className="text-muted-foreground text-sm text-left truncate w-full">
                  {bio.description}
                </h2>
              )}
            </div>
          </div>
        </header>
      );
    case "right-aligned":
      return (
        <header
          className="w-full flex flex-col items-end p-4 h-[100px]"
          style={{
            backgroundColor: header.headerBackgroundColor || "#0f172b",
            backgroundImage: header.headerBackgroundImage
              ? `url(${header.headerBackgroundImage})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="flex flex-col gap-4 items-end w-full max-w-2xs translate-y-8">
            {preview || bio.avatarUrl ? (
              <Avatar className="w-24 h-24">
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
            <div className="w-full flex flex-col gap-1 items-end text-right">
              <h1 className="text-xl font-black text-right">{bio.title}</h1>
              {bio.description && (
                <h2 className="text-muted-foreground text-sm text-right truncate w-full">
                  {bio.description}
                </h2>
              )}
            </div>
          </div>
        </header>
      );
    case "centered":
      return (
        <header
          className="w-full flex flex-col items-center p-4 h-[100px]"
          style={{
            backgroundColor: header.headerBackgroundColor || "#0f172b",
            backgroundImage: header.headerBackgroundImage
              ? `url(${header.headerBackgroundImage})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="flex flex-col gap-4 items-center w-full max-w-2xs translate-y-8">
            {preview || bio.avatarUrl ? (
              <Avatar className="mx-auto w-24 h-24">
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
            <div className="w-full flex flex-col gap-1 items-center text-center">
              <h1 className="mx-auto text-xl font-black text-center">
                {bio.title}
              </h1>
              {bio.description && (
                <h2 className="text-muted-foreground text-sm text-center mx-auto truncate">
                  {bio.description}
                </h2>
              )}
            </div>
          </div>
        </header>
      );
    default:
      return (
        <header className="w-full flex flex-col items-center">
          <div className="flex flex-col gap-4 items-center w-full max-w-2xs translate-y-8">
            {(preview || bio.avatarUrl) && (
              <Avatar className="mx-auto w-24 h-24">
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
            <div className="w-full flex flex-col gap-1 items-center text-center">
              <h1 className="mx-auto text-xl font-black text-center">
                {bio.title}
              </h1>
              {bio.description && (
                <h2 className="text-muted-foreground text-sm text-center mx-auto truncate">
                  {bio.description}
                </h2>
              )}
            </div>
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
    theme?: {
      primaryColor?: string;
      background?: string;
      textColor?: string;
      buttonStyle?: "rounded" | "square" | "pill";
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
    createdAt: Date;
    updatedAt: Date;
  };
  preview?: boolean;
}) => {
  return (
    <div
      style={{
        background: bio.theme?.background || "#ffffff",
        color: bio.theme?.textColor || "#000000",
      }}
      className="w-full h-full flex flex-col gap-2"
    >
      <BioHeader
        header={bio.theme?.header}
        preview={preview}
        bio={{
          title: bio.title,
          avatarUrl: bio.avatarUrl,
          description: bio.description,
        }}
      />
    </div>
  );
};
