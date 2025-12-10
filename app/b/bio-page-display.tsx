"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageIcon } from "lucide-react";
import { GetSocialIcon } from "../[locale]/dashboard/pages/[slug]/customize/customize-page";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { loadFont } from "@/lib/fonts";
import { Spinner } from "@/components/ui/spinner";
import { default as NextImage } from "next/image";
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
      buttonTextColor?: string;
      background?: string;
      textColor?: string;
      buttonStyle?: "rounded" | "square" | "pill";
      font?: string;
      titleFontSize?: string;
      titleFontWeight?: string;
      descriptionFontSize?: string;
      descriptionFontWeight?: string;
      buttonFontSize?: string;
      buttonFontWeight?: string;
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
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    const loadAssets = async () => {
      const assetsToLoad: Promise<void>[] = [];
      let totalAssets = 0;
      let loadedAssets = 0;

      const incrementProgress = () => {
        loadedAssets++;
        setLoadingProgress((loadedAssets / totalAssets) * 100);
      };

      if (bio.theme?.font && bio.theme.font !== "inherit") {
        totalAssets++;
        const fontFamily = bio.theme.font
          .split(",")[0]
          .replace(/['"]/g, "")
          .trim();

        const fontPromise = loadFont(fontFamily)
          .then(() => {
            incrementProgress();
          })
          .catch((error) => {
            console.error(`Failed to load font "${fontFamily}":`, error);
            incrementProgress();
          });

        assetsToLoad.push(fontPromise);
      }

      if (bio.avatarUrl) {
        totalAssets++;
        const avatarUrl = bio.avatarUrl;
        const avatarPromise = new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            incrementProgress();
            resolve();
          };
          img.onerror = () => {
            console.error(`Failed to load avatar image: ${avatarUrl}`);
            incrementProgress();
            resolve();
          };
          img.src = avatarUrl;
        });
        assetsToLoad.push(avatarPromise);
      }

      if (bio.theme?.header?.headerBackgroundImage) {
        totalAssets++;
        const headerBgUrl = bio.theme.header.headerBackgroundImage;
        const headerBgPromise = new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            incrementProgress();
            resolve();
          };
          img.onerror = () => {
            console.error(`Failed to load header background: ${headerBgUrl}`);
            incrementProgress();
            resolve();
          };
          img.src = headerBgUrl;
        });
        assetsToLoad.push(headerBgPromise);
      }

      const linkImages = bio.links.filter((link) => link.image);
      linkImages.forEach((link) => {
        totalAssets++;
        const linkImagePromise = new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            incrementProgress();
            resolve();
          };
          img.onerror = () => {
            console.error(`Failed to load link image: ${link.image}`);
            incrementProgress();
            resolve();
          };
          img.src = link.image!;
        });
        assetsToLoad.push(linkImagePromise);
      });

      if (totalAssets === 0) {
        setIsLoading(false);
        return;
      }

      try {
        await Promise.all(assetsToLoad);
      } catch (error) {
        console.error("Error loading assets:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAssets();
  }, [
    bio.theme?.font,
    bio.avatarUrl,
    bio.theme?.header?.headerBackgroundImage,
    bio.links,
  ]);

  console.log(bio.links);

  if (isLoading) {
    return (
      <div
        style={{
          background: bio.theme?.background || "#ffffff",
          color: bio.theme?.textColor || "#000000",
        }}
        className="w-full h-screen flex flex-col items-center justify-center gap-4"
      >
        <div className="flex flex-col items-center gap-2">
          <Spinner />
          <p className="text-sm opacity-75">
            Loading... {Math.round(loadingProgress)}%
          </p>
        </div>
      </div>
    );
  }

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
          <h1
            style={{
              fontSize: bio.theme?.titleFontSize || "1.25rem",
              fontWeight: bio.theme?.titleFontWeight || "900",
            }}
            className="mx-auto text-center"
          >
            {bio.title}
          </h1>
          {bio.description && (
            <h2
              style={{
                color: bio.theme?.textColor || "#000000",
                fontSize: bio.theme?.descriptionFontSize || "0.875rem",
                fontWeight: bio.theme?.descriptionFontWeight || "300",
              }}
              className="opacity-75 text-center mx-auto truncate"
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
          <h1
            style={{
              fontSize: bio.theme?.titleFontSize || "1.25rem",
              fontWeight: bio.theme?.titleFontWeight || "900",
            }}
            className="mx-auto text-center"
          >
            {bio.title}
          </h1>
          {bio.description && (
            <h2
              style={{
                color: bio.theme?.textColor || "#000000",
                fontSize: bio.theme?.descriptionFontSize || "0.875rem",
                fontWeight: bio.theme?.descriptionFontWeight || "300",
              }}
              className="opacity-75 text-center mx-auto truncate"
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
          <h1
            style={{
              fontSize: bio.theme?.titleFontSize || "1.25rem",
              fontWeight: bio.theme?.titleFontWeight || "900",
            }}
            className="text-right"
          >
            {bio.title}
          </h1>
          {bio.description && (
            <h2
              style={{
                color: bio.theme?.textColor || "#000000",
                fontSize: bio.theme?.descriptionFontSize || "0.875rem",
                fontWeight: bio.theme?.descriptionFontWeight || "300",
              }}
              className="opacity-75 text-right truncate w-full"
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
          <h1
            style={{
              fontSize: bio.theme?.titleFontSize || "1.25rem",
              fontWeight: bio.theme?.titleFontWeight || "900",
            }}
            className="text-left"
          >
            {bio.title}
          </h1>
          {bio.description && (
            <h2
              style={{
                color: bio.theme?.textColor || "#000000",
                fontSize: bio.theme?.descriptionFontSize || "0.875rem",
                fontWeight: bio.theme?.descriptionFontWeight || "300",
              }}
              className="opacity-75 text-left truncate w-full"
            >
              {bio.description}
            </h2>
          )}
        </div>
      )}
      {bio.socials && bio.socials.length > 0 && (
        <div
          className={cn(
            "w-full grid grid-cols-[repeat(auto-fit,12.5%)] justify-center gap-0.55 max-w-2xs mx-auto",
          )}
        >
          {bio.socials
            .filter((s) => !!s.url)
            .map((social) => (
              <a
                target="_blank"
                key={social.platform}
                href={
                  social.url?.startsWith("http") ||
                  social.url?.startsWith("https")
                    ? social.url
                    : `https://${social.url}`
                }
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
      <div
        className={cn(
          "w-full max-w-2xl mt-6 grid items-center grid-cols-1 gap-4 mx-auto px-4",
          bio.theme?.buttonStyle == "square" && "grid-cols-3 gap-2",
        )}
      >
        {bio.links.map((link, index) =>
          bio.theme?.buttonStyle == "square" ? (
            <a
              key={index}
              href={link.link.shortUrl}
              style={{
                background: bio.theme.primaryColor || "#0f172b",
                color: bio.theme.buttonTextColor || "#ffffff",
                fontSize: bio.theme?.buttonFontSize || "0.875rem",
                fontWeight: bio.theme?.buttonFontWeight || "500",
              }}
              className="flex items-center justify-center rounded-none hover:shadow hover:scale-[1.01] hover:cursor-pointer transition-transform break-all w-full h-auto aspect-square"
            >
              {link.image ? (
                <NextImage
                  src={link.image}
                  className="w-full h-auto aspect-square object-cover"
                  alt={link.title || "link image"}
                />
              ) : (
                <p className="w-full truncate text-center px-4">{link.title}</p>
              )}
            </a>
          ) : (
            <a
              key={index}
              href={link.link.shortUrl}
              style={{
                background: bio.theme?.primaryColor || "#0f172b",
                color: bio.theme?.buttonTextColor || "#ffffff",
                fontSize: bio.theme?.buttonFontSize || "0.875rem",
                fontWeight: bio.theme?.buttonFontWeight || "500",
              }}
              className={cn(
                "flex items-center justify-center h-8 hover:shadow hover:scale-[1.01] hover:cursor-pointer transition-transform w-full relative rounded-full px-6",
                bio.theme?.buttonStyle == "rounded" && "rounded",
              )}
              target="_blank"
            >
              {link.image && (
                <NextImage
                  width={128}
                  height={128}
                  src={link.image}
                  className="w-6 h-6 aspect-square rounded-full shadow object-cover absolute left-2"
                  alt={link.title || "link image"}
                />
              )}
              <p className="w-full truncate text-center">{link.title}</p>
            </a>
          ),
        )}
      </div>
    </div>
  );
};
