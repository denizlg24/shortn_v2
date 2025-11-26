"use client";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Trash2 } from "lucide-react";
import { BioPageDisplay } from "@/app/b/bio-page-display";
import { useRef, useState } from "react";
import InputColor from "@/components/ui/color-input";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { uploadImage } from "@/app/actions/uploadImage";
import { deletePicture } from "@/app/actions/deletePicture";
import { Spinner } from "@/components/ui/spinner";
import { useHasObjectChanges } from "@/lib/use-has-changes";

export const CustomizeBioPage = ({
  initialBio,
}: {
  initialBio: {
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
  const [bio, updateBio] = useState(initialBio);
  const [uploading, setUploading] = useState("");

  const profilePictureRef = useRef<HTMLInputElement | null>(null);
  const hasChanges = useHasObjectChanges(bio, initialBio, 300);

  const uploadFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    callback: (arg0: string) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/svg"];
    const maxSizeInBytes = 5 * 1024 * 1024;

    if (!validTypes.includes(file.type)) {
      toast.error("Invalid file type. Only JPG, PNG, and SVG are allowed.");
      if (e.target) {
        e.target.value = "";
      }
      return;
    }

    if (file.size > maxSizeInBytes) {
      toast.error("File is too large. Must be under 5MB.");
      if (e.target) {
        e.target.value = "";
      }
      return;
    }
    setUploading("Uploading...");
    const { success, url } = await uploadImage(file);
    if (success && url) {
      callback(url as string);
    }
    setUploading("");
  };

  const removeFile = async (url: string, callback: () => void) => {
    setUploading("Removing...");
    await deletePicture(url);
    callback();
    setUploading("");
  };

  return (
    <div className="w-full max-w-7xl flex flex-col gap-4">
      <div className="flex sm:flex-row flex-col items-center justify-between gap-2">
        <h1 className="font-black lg:text-3xl md:text-2xl text-xl">
          Customize your page
        </h1>
        {hasChanges && (
          <div className="flex flex-row items-center gap-1 justify-end">
            <Button>Save Changes</Button>
            <Button
              variant="outline"
              onClick={() => {
                updateBio(initialBio);
              }}
            >
              Discard Changes
            </Button>
          </div>
        )}
      </div>

      <div className="w-full max-w-7xl mx-auto flex lg:flex-row lg:items-start items-center gap-6 flex-col-reverse">
        <div className="grow w-full flex flex-col gap-6">
          <Card className="w-full flex flex-col gap-4 p-4! rounded!">
            <CardTitle className="text-lg font-bold">Profile</CardTitle>
            <CardContent className="p-0 flex flex-col gap-4 flex-wrap w-full">
              <div className="flex sm:flex-row flex-col sm:items-center gap-2 justify-start">
                <div className="flex flex-col gap-2 shrink-0 items-start">
                  <Label>Profile Image</Label>
                  <Avatar className="w-24 h-24">
                    <AvatarImage
                      className="object-cover"
                      src={bio.avatarUrl}
                      alt={bio.title}
                    />
                    <AvatarFallback className="capitalize"></AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex flex-row gap-1 items-center">
                  <Input
                    ref={profilePictureRef}
                    disabled={uploading !== ""}
                    onChange={(e) => {
                      uploadFile(e, (url) => {
                        updateBio((prev) => ({
                          ...prev,
                          avatarUrl: url,
                        }));
                      });
                    }}
                    type="file"
                    className="w-full"
                  />
                  {bio.avatarUrl && (
                    <Button
                      disabled={uploading !== ""}
                      onClick={() => {
                        removeFile(bio.avatarUrl as string, () => {
                          updateBio((prev) => ({
                            ...prev,
                            avatarUrl: undefined,
                          }));
                          if (profilePictureRef.current) {
                            profilePictureRef.current.value = "";
                          }
                        });
                      }}
                      size={"icon"}
                      variant="destructive"
                    >
                      {uploading === "" ? <Trash2 /> : <Spinner />}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
            <CardTitle className="text-lg font-bold">About</CardTitle>
            <CardContent className="p-0 flex flex-col gap-4 flex-wrap w-full">
              <div className="flex flex-col gap-1 items-start w-full">
                <Label>Title</Label>
                <Input
                  type="text"
                  className="w-full"
                  value={bio.title}
                  onChange={(e) => {
                    updateBio((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }));
                  }}
                />
              </div>
              <div className="flex flex-col gap-1 items-start w-full">
                <Label>Description</Label>
                <Input
                  type="text"
                  className="w-full"
                  value={bio.description}
                  onChange={(e) => {
                    updateBio((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }));
                  }}
                />
              </div>
            </CardContent>
          </Card>
          <Card className="w-full flex flex-col gap-4 p-4! rounded!">
            <CardTitle>Theme</CardTitle>
            <CardContent className="p-0 flex flex-col gap-4 flex-wrap w-full">
              <Tabs defaultValue="color">
                <TabsList>
                  <TabsTrigger value="color">Solid Color</TabsTrigger>
                  <TabsTrigger value="image">Background Image</TabsTrigger>
                </TabsList>
                <TabsContent value="color">
                  <div className="w-full grid sm:grid-cols-2 grid-cols-1 gap-2">
                    <InputColor
                      className="mt-0! w-full"
                      size="h-8"
                      onBlur={() => {}}
                      label="Background Color"
                      value={bio.theme?.background || "#ffffff"}
                      onChange={(v) => {
                        updateBio((prev) => ({
                          ...prev,
                          theme: {
                            ...prev.theme,
                            background: v,
                          },
                        }));
                      }}
                    />
                    <InputColor
                      className="mt-0! w-full"
                      size="h-8"
                      onBlur={() => {}}
                      label="Text Color"
                      value={bio.theme?.textColor || "#000000"}
                      onChange={(v) => {
                        updateBio((prev) => ({
                          ...prev,
                          theme: {
                            ...prev.theme,
                            textColor: v,
                          },
                        }));
                      }}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="image">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2 w-full">
                      <Label>Background Image</Label>
                      <Input type="file" className="w-full" />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="hidden lg:flex w-full max-w-[375px] shrink-0 flex-col items-center gap-4">
          <div className="w-full h-[550px] border rounded">
            <BioPageDisplay bio={bio} />
          </div>
          <h1 className="font-semibold text-base text-yellow-800 bg-yellow-50 px-3 py-1 rounded border border-yellow-800">
            Draft preview
          </h1>
        </div>

        <Collapsible className="lg:hidden w-full">
          <CollapsibleTrigger className="w-full group">
            <div className="flex items-center justify-between p-2! bg-background border rounded-md">
              <div className="font-semibold xs:text-sm text-xs text-yellow-800 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-800">
                Draft preview
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="max-w-[375px] w-full h-[550px] border rounded mt-2 mx-auto">
              <BioPageDisplay bio={bio} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
};
