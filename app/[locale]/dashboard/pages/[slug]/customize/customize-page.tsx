"use client";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  GripVertical,
  ImageIcon,
  Link,
  Trash2,
  Youtube,
} from "lucide-react";
import { BioPageDisplay } from "@/app/b/bio-page-display";
import { ReactNode, useRef, useState } from "react";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import z from "zod";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sortable,
  SortableContent,
  SortableItem,
  SortableItemHandle,
  SortableOverlay,
} from "@/components/ui/sortable";
import {
  FacebookIcon,
  GithubIcon,
  InstagramIcon,
  LinkedinIcon,
  TwitterIcon,
  WhatsappIcon,
} from "next-share";
import { cn } from "@/lib/utils";

const bioSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(52, "Title must be 52 characters or less"),
  description: z
    .string()
    .max(256, "Description must be 256 characters or less")
    .optional(),
});

export const GetSocialIcon = ({
  platform,
}: {
  platform?: string;
}): ReactNode => {
  switch (platform) {
    case "instagram":
      return <InstagramIcon className="w-6 h-6 shrink-0" />;
    case "twitter":
      return <TwitterIcon className="w-6 h-6 shrink-0" />;
    case "github":
      return <GithubIcon className="w-6 h-6 shrink-0" />;
    case "facebook":
      return <FacebookIcon className="w-6 h-6 shrink-0" />;
    case "youtube":
      return <Youtube className="w-6 h-6 shrink-0" />;
    case "linkedin":
      return <LinkedinIcon className="w-6 h-6 shrink-0" />;
    case "whatsapp":
      return <WhatsappIcon className="w-6 h-6 shrink-0" />;
    default:
      return <Link className="w-6 h-6 shrink-0" />;
  }
};

export const SocialButton = ({
  platform,
  title,
  onClick,
  toggled,
}: {
  platform?: string;
  title?: string;
  onClick?: () => void;
  toggled?: boolean;
}): ReactNode => {
  return (
    <Button
      variant={"outline"}
      className={cn(toggled && "border-primary outline-primary/10")}
      onClick={onClick}
    >
      <GetSocialIcon platform={platform} />
      {title}
    </Button>
  );
};

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
        headerBackgroundImage?: string;
        headerBackgroundColor?: string;
      };
    };
    links: {
      link: { shortUrl: string; title: string };
      image?: string;
      title?: string;
    }[];
    socials?: { url: string; platform: string }[];
    createdAt: Date;
    updatedAt: Date;
  };
}) => {
  const [bio, updateBio] = useState(initialBio);
  const [uploading, setUploading] = useState("");

  const profilePictureRef = useRef<HTMLInputElement | null>(null);
  const headerBackgroundRef = useRef<HTMLInputElement | null>(null);

  const hasChanges = useHasObjectChanges(bio, initialBio, 100);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [saving, setSaving] = useState(false);

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

  const handleSave = async () => {
    setSaving(true);
    try {
      bioSchema.parse(bio);
      setValidationErrors({});
      toast.success("Changes saved successfully");
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0] as string] = err.message;
          }
        });
        setValidationErrors(errors);
      }
    } finally {
      setSaving(false);
    }
  };

  const getFieldError = (field: string) => validationErrors[field];
  const hasFieldError = (field: string) => !!validationErrors[field];

  return (
    <div className="w-full max-w-7xl flex flex-col gap-4">
      <div className="flex sm:flex-row flex-col items-center justify-between gap-2">
        <h1 className="font-black lg:text-3xl md:text-2xl text-xl">
          Customize your page
        </h1>
        {hasChanges && (
          <div className="flex flex-row items-center gap-1 justify-end">
            <Button disabled={saving} onClick={handleSave}>
              {saving ? (
                <>
                  <Spinner /> Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
            <Button
              disabled={saving}
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
                  <Avatar className="w-24 h-24  shadow border">
                    <AvatarImage
                      className="object-cover"
                      src={bio.avatarUrl}
                      alt={bio.title}
                    />
                    <AvatarFallback className="capitalize">
                      <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    </AvatarFallback>
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
              <Field data-invalid={hasFieldError("title")} className="w-full ">
                <FieldLabel>Title</FieldLabel>
                <Input
                  type="text"
                  className="w-full"
                  value={bio.title}
                  aria-invalid={hasFieldError("title")}
                  onChange={(e) => {
                    updateBio((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }));
                    if (hasFieldError("title")) {
                      setValidationErrors((prev) => {
                        const { title, ...rest } = prev;
                        console.log(title);
                        return rest;
                      });
                    }
                  }}
                />
                {hasFieldError("title") && (
                  <FieldError>{getFieldError("title")}</FieldError>
                )}
              </Field>
              <Field
                data-invalid={hasFieldError("description")}
                className="w-full "
              >
                <FieldLabel>Description</FieldLabel>
                <Input
                  type="text"
                  className="w-full"
                  value={bio.description ?? ""}
                  aria-invalid={hasFieldError("description")}
                  onChange={(e) => {
                    updateBio((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }));
                    if (hasFieldError("description")) {
                      setValidationErrors((prev) => {
                        const { description, ...rest } = prev;
                        console.log(description);
                        return rest;
                      });
                    }
                  }}
                />
                {hasFieldError("description") && (
                  <FieldError>{getFieldError("description")}</FieldError>
                )}
              </Field>
            </CardContent>
          </Card>
          <Card className="w-full flex flex-col gap-4 p-4! rounded!">
            <CardTitle className="text-lg font-bold">Page</CardTitle>
            <CardContent className="p-0 flex flex-col gap-4 flex-wrap w-full">
              <Label>Layout</Label>

              <RadioGroup
                onValueChange={(v) => {
                  switch (v) {
                    case "no-header":
                      if (bio.theme?.header?.headerBackgroundImage) {
                        removeFile(
                          bio.theme!.header!.headerBackgroundImage as string,
                          () => {},
                        );
                      }
                      updateBio((prev) => ({
                        ...prev,
                        theme: {
                          ...prev.theme,
                          header: undefined,
                        },
                      }));
                      break;
                    case "centered":
                    case "left-aligned":
                    case "right-aligned":
                      updateBio((prev) => ({
                        ...prev,
                        theme: {
                          ...prev.theme,
                          header: {
                            ...prev.theme?.header,
                            headerStyle: v,
                          },
                        },
                      }));
                      break;
                  }
                }}
                className="w-full flex flex-row gap-1 items-start flex-wrap"
                value={
                  bio.theme?.header ? bio.theme.header.headerStyle : "no-header"
                }
              >
                <div className="flex grow items-center gap-3">
                  <RadioGroupItem value="no-header" id="r1" />
                  <Label htmlFor="r1">No Header</Label>
                </div>
                <div className="flex grow items-center gap-3">
                  <RadioGroupItem value="centered" id="r2" />
                  <Label htmlFor="r2">Centered</Label>
                </div>
                <div className="flex grow items-center gap-3">
                  <RadioGroupItem value="left-aligned" id="r3" />
                  <Label htmlFor="r3">Leftmost</Label>
                </div>
                <div className="flex grow items-center gap-3">
                  <RadioGroupItem value="right-aligned" id="r4" />
                  <Label htmlFor="r4">Rightmost</Label>
                </div>
              </RadioGroup>
            </CardContent>
            {bio.theme?.header && (
              <CardContent className="p-0 flex flex-col gap-4 flex-wrap w-full">
                <Tabs defaultValue="color">
                  <div className="flex flex-row items-center justify-between">
                    <Label>Header</Label>
                    <TabsList>
                      <TabsTrigger value="color">Solid Color</TabsTrigger>
                      <TabsTrigger value="image">Background Image</TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="color">
                    <InputColor
                      className="mt-0! w-full"
                      size="h-8"
                      onBlur={() => {}}
                      label="Background Color"
                      value={
                        bio.theme?.header.headerBackgroundColor || "#0f172b"
                      }
                      onChange={(v) => {
                        updateBio((prev) => ({
                          ...prev,
                          theme: {
                            ...prev.theme,
                            header: {
                              ...prev.theme!.header!,
                              headerBackgroundColor: v,
                            },
                          },
                        }));
                      }}
                    />
                  </TabsContent>
                  <TabsContent value="image">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <Label>Background Image</Label>
                        <div className="flex flex-row items-center justify-start gap-1">
                          <Input
                            ref={headerBackgroundRef}
                            disabled={uploading !== ""}
                            type="file"
                            className="w-fit!"
                            onChange={(e) => {
                              uploadFile(e, (url) => {
                                updateBio((prev) => ({
                                  ...prev,
                                  theme: {
                                    ...prev.theme,
                                    header: {
                                      ...prev.theme!.header!,
                                      headerBackgroundImage: url,
                                    },
                                  },
                                }));
                              });
                            }}
                          />
                          {bio.theme?.header?.headerBackgroundImage && (
                            <Button
                              disabled={uploading !== ""}
                              onClick={() => {
                                removeFile(
                                  bio.theme!.header!
                                    .headerBackgroundImage as string,
                                  () => {
                                    updateBio((prev) => ({
                                      ...prev,
                                      theme: {
                                        ...prev.theme,
                                        header: {
                                          ...prev.theme!.header!,
                                          headerBackgroundImage: undefined,
                                        },
                                      },
                                    }));
                                    if (headerBackgroundRef.current) {
                                      headerBackgroundRef.current.value = "";
                                    }
                                  },
                                );
                              }}
                              size={"icon"}
                              variant="destructive"
                            >
                              {uploading === "" ? <Trash2 /> : <Spinner />}
                            </Button>
                          )}
                        </div>
                      </div>
                      <InputColor
                        className="mt-0! w-full"
                        size="h-8"
                        onBlur={() => {}}
                        label="Image Background Color"
                        value={
                          bio.theme?.header.headerBackgroundColor || "#0f172b"
                        }
                        onChange={(v) => {
                          updateBio((prev) => ({
                            ...prev,
                            theme: {
                              ...prev.theme,
                              header: {
                                ...prev.theme!.header!,
                                headerBackgroundColor: v,
                              },
                            },
                          }));
                        }}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            )}

            <CardContent className="p-0 flex flex-col gap-4 flex-wrap w-full">
              <Label className="text-lg font-bold">Colors</Label>
              <div className="flex flex-row items-center gap-2 justify-start flex-wrap">
                <InputColor
                  className="mt-0! w-full"
                  size="h-8"
                  onBlur={() => {}}
                  label="Background Color"
                  value={bio.theme?.background || "#ffffff"}
                  onChange={(v) => {
                    updateBio((prev) => ({
                      ...prev,
                      theme: { ...prev.theme, background: v },
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
                      theme: { ...prev.theme, textColor: v },
                    }));
                  }}
                />
              </div>
            </CardContent>
          </Card>
          <Card className="w-full flex flex-col gap-4 p-4! rounded!">
            <CardTitle className="text-lg font-bold">Socials</CardTitle>
            <CardContent className="p-0 flex flex-row items-center justify-start gap-2 flex-wrap w-full">
              <SocialButton
                platform="instagram"
                title="Instagram"
                toggled={bio.socials?.some((s) => s.platform === "instagram")}
                onClick={() => {
                  updateBio((prev) => ({
                    ...prev,
                    socials: prev.socials?.some(
                      (s) => s.platform === "instagram",
                    )
                      ? prev.socials.filter((s) => s.platform !== "instagram")
                      : [
                          ...(prev.socials || []),
                          { platform: "instagram", url: "" },
                        ],
                  }));
                }}
              />
              <SocialButton
                platform="twitter"
                title="Twitter"
                toggled={bio.socials?.some((s) => s.platform === "twitter")}
                onClick={() => {
                  updateBio((prev) => ({
                    ...prev,
                    socials: prev.socials?.some((s) => s.platform === "twitter")
                      ? prev.socials.filter((s) => s.platform !== "twitter")
                      : [
                          ...(prev.socials || []),
                          { platform: "twitter", url: "" },
                        ],
                  }));
                }}
              />
              <SocialButton
                platform="github"
                title="GitHub"
                toggled={bio.socials?.some((s) => s.platform === "github")}
                onClick={() => {
                  updateBio((prev) => ({
                    ...prev,
                    socials: prev.socials?.some((s) => s.platform === "github")
                      ? prev.socials.filter((s) => s.platform !== "github")
                      : [
                          ...(prev.socials || []),
                          { platform: "github", url: "" },
                        ],
                  }));
                }}
              />
              <SocialButton
                platform="facebook"
                title="Facebook"
                toggled={bio.socials?.some((s) => s.platform === "facebook")}
                onClick={() => {
                  updateBio((prev) => ({
                    ...prev,
                    socials: prev.socials?.some(
                      (s) => s.platform === "facebook",
                    )
                      ? prev.socials.filter((s) => s.platform !== "facebook")
                      : [
                          ...(prev.socials || []),
                          { platform: "facebook", url: "" },
                        ],
                  }));
                }}
              />
              <SocialButton
                platform="youtube"
                title="YouTube"
                toggled={bio.socials?.some((s) => s.platform === "youtube")}
                onClick={() => {
                  updateBio((prev) => ({
                    ...prev,
                    socials: prev.socials?.some((s) => s.platform === "youtube")
                      ? prev.socials.filter((s) => s.platform !== "youtube")
                      : [
                          ...(prev.socials || []),
                          { platform: "youtube", url: "" },
                        ],
                  }));
                }}
              />
              <SocialButton
                platform="linkedin"
                title="LinkedIn"
                toggled={bio.socials?.some((s) => s.platform === "linkedin")}
                onClick={() => {
                  updateBio((prev) => ({
                    ...prev,
                    socials: prev.socials?.some(
                      (s) => s.platform === "linkedin",
                    )
                      ? prev.socials.filter((s) => s.platform !== "linkedin")
                      : [
                          ...(prev.socials || []),
                          { platform: "linkedin", url: "" },
                        ],
                  }));
                }}
              />
              <SocialButton
                platform="whatsapp"
                title="WhatsApp"
                toggled={bio.socials?.some((s) => s.platform === "whatsapp")}
                onClick={() => {
                  updateBio((prev) => ({
                    ...prev,
                    socials: prev.socials?.some(
                      (s) => s.platform === "whatsapp",
                    )
                      ? prev.socials.filter((s) => s.platform !== "whatsapp")
                      : [
                          ...(prev.socials || []),
                          { platform: "whatsapp", url: "" },
                        ],
                  }));
                }}
              />
              <SocialButton
                platform="website"
                title="Website"
                toggled={bio.socials?.some((s) => s.platform === "website")}
                onClick={() => {
                  updateBio((prev) => ({
                    ...prev,
                    socials: prev.socials?.some((s) => s.platform === "website")
                      ? prev.socials.filter((s) => s.platform !== "website")
                      : [
                          ...(prev.socials || []),
                          { platform: "website", url: "" },
                        ],
                  }));
                }}
              />
            </CardContent>
            <Sortable
              value={bio.socials || []}
              onValueChange={(v) => {
                updateBio((prev) => ({
                  ...prev,
                  socials: v,
                }));
              }}
              getItemValue={(item) => item.platform}
              orientation="vertical"
            >
              <SortableContent asChild>
                <div className="p-0 flex flex-col gap-2 flex-wrap w-full">
                  {bio.socials?.map((social) => {
                    return (
                      <SortableItem
                        key={social.platform}
                        value={social.platform}
                        asChild
                      >
                        <div className="w-full flex flex-row items-center gap-1">
                          <SortableItemHandle asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 shrink-0"
                            >
                              <GripVertical className="h-4 w-4" />
                            </Button>
                          </SortableItemHandle>
                          <GetSocialIcon platform={social.platform} />
                          <Field
                            data-invalid={hasFieldError(social.platform)}
                            className="w-full ml-2"
                          >
                            <Input
                              type="text"
                              className="w-full grow"
                              value={social.url ?? ""}
                              aria-invalid={hasFieldError(social.platform)}
                              onChange={(e) => {
                                updateBio((prev) => ({
                                  ...prev,
                                  socials: prev.socials?.map((s) =>
                                    s.platform === social.platform
                                      ? { ...s, url: e.target.value }
                                      : s,
                                  ),
                                }));
                                if (hasFieldError(social.platform)) {
                                  setValidationErrors((prev) => {
                                    const { [social.platform]: _, ...rest } =
                                      prev;
                                    console.log(_);
                                    return rest;
                                  });
                                }
                              }}
                            />
                            {hasFieldError(social.platform) && (
                              <FieldError>
                                {getFieldError(social.platform)}
                              </FieldError>
                            )}
                          </Field>
                          <Button variant={"destructive"} size={"icon"}>
                            <Trash2 />
                          </Button>
                        </div>
                      </SortableItem>
                    );
                  })}
                </div>
              </SortableContent>
              <SortableOverlay>
                <div className="size-full rounded-none bg-primary/10" />
              </SortableOverlay>
            </Sortable>
          </Card>
        </div>

        <div className="hidden lg:flex w-full max-w-[375px] shrink-0 flex-col items-center gap-4">
          <div className="w-full h-[550px] border rounded-2xl shadow overflow-hidden">
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
            <div className="max-w-[375px] w-full h-[550px] border mt-2 mx-auto rounded-2xl shadow overflow-hidden">
              <BioPageDisplay bio={bio} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
};
