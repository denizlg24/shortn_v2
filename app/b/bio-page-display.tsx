"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";
const BioHeader = ({
  header,
}: {
  header: {
    headerStyle: "centered" | "left-aligned" | "right-aligned";
    headerImageUrl?: string;
    headerImageStyle: "square" | "rounded" | "circle";
    headerBackgroundImage?: string;
    headerBackgroundColor: string;
    headerTitle?: string;
    headerSubtitle?: string;
  };
}) => {
  switch (header.headerStyle) {
    case "left-aligned":
      return (
        <header
          className="w-full flex flex-col items-start p-4 border-b h-[100px]"
          style={{
            backgroundColor: header.headerBackgroundColor || "#0f172b",
            backgroundImage: header.headerBackgroundImage
              ? `url(${header.headerBackgroundImage})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {header.headerImageUrl && (
            <Image
              src={header.headerImageUrl}
              alt="Header Image"
              className={`mb-4 ${header.headerImageStyle === "circle" ? "rounded-full" : header.headerImageStyle === "rounded" ? "rounded-lg" : ""}`}
            />
          )}
          {header.headerTitle && (
            <h1 className="text-3xl font-bold">{header.headerTitle}</h1>
          )}
          {header.headerSubtitle && (
            <p className="text-lg">{header.headerSubtitle}</p>
          )}
        </header>
      );
    case "right-aligned":
      return (
        <header
          className="w-full flex flex-col items-end p-4 border-b  h-[100px]"
          style={{
            backgroundColor: header.headerBackgroundColor || "#0f172b",
            backgroundImage: header.headerBackgroundImage
              ? `url(${header.headerBackgroundImage})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {header.headerImageUrl && (
            <Image
              src={header.headerImageUrl}
              alt="Header Image"
              className={`mb-4 ${header.headerImageStyle === "circle" ? "rounded-full" : header.headerImageStyle === "rounded" ? "rounded-lg" : ""}`}
            />
          )}
          {header.headerTitle && (
            <h1 className="text-3xl font-bold">{header.headerTitle}</h1>
          )}
          {header.headerSubtitle && (
            <p className="text-lg">{header.headerSubtitle}</p>
          )}
        </header>
      );
    case "centered":
    default:
      return (
        <header
          className="w-full flex flex-col items-center p-4 border-b  h-[100px]"
          style={{
            backgroundColor: header.headerBackgroundColor || "#0f172b",
            backgroundImage: header.headerBackgroundImage
              ? `url(${header.headerBackgroundImage})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {header.headerImageUrl && (
            <Image
              src={header.headerImageUrl}
              alt="Header Image"
              className={`mb-4 ${header.headerImageStyle === "circle" ? "rounded-full" : header.headerImageStyle === "rounded" ? "rounded-lg" : ""}`}
            />
          )}
          {header.headerTitle && (
            <h1 className="text-3xl font-bold">{header.headerTitle}</h1>
          )}
          {header.headerSubtitle && (
            <p className="text-lg">{header.headerSubtitle}</p>
          )}
        </header>
      );
  }
};

export const BioPageDisplay = ({
  bio,
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
        headerImageUrl?: string;
        headerImageStyle: "square" | "rounded" | "circle";
        headerBackgroundImage?: string;
        headerBackgroundColor: string;
        headerTitle?: string;
        headerSubtitle?: string;
      };
    };
    links: {
      link: { shortUrl: string; title: string };
      image?: string;
      title?: string;
    }[];
    socials?: {
      instagram?: string;
      twitter?: string;
      github?: string;
      linkedin?: string;
    };
    createdAt: Date;
    updatedAt: Date;
  };
}) => {
  return (
    <div
      style={{
        background: bio.theme?.background || "#ffffff",
        color: bio.theme?.textColor || "#000000",
      }}
      className="w-full h-full flex flex-col gap-2"
    >
      {bio.theme?.header && <BioHeader header={bio.theme?.header} />}
      {bio.avatarUrl && (
        <Avatar className="mx-auto">
          <AvatarImage
            className="object-cover"
            src={bio.avatarUrl}
            alt={bio.title}
          />
          <AvatarFallback className="capitalize">
            {bio.title.substring(0, 2)}
          </AvatarFallback>
        </Avatar>
      )}

      <h1 className="mx-auto text-xl font-black text-center">{bio.title}</h1>
      {bio.description && (
        <h2 className="text-muted-foreground text-sm text-center mx-auto">
          {bio.description}
        </h2>
      )}
    </div>
  );
};
