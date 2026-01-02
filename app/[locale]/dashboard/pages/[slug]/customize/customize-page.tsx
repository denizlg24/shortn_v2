"use client";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronLeft,
  GripVertical,
  ImageIcon,
  LinkIcon,
  Trash2,
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
import { z } from "zod";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sortable,
  SortableContent,
  SortableItem,
  SortableItemHandle,
} from "@/components/ui/sortable";
import { cn } from "@/lib/utils";
import {
  FaInstagram,
  FaGithub,
  FaYoutube,
  FaLinkedin,
  FaWhatsapp,
} from "react-icons/fa";
import { FaXTwitter, FaFacebook } from "react-icons/fa6";
import { Link, useRouter } from "@/i18n/navigation";
import { updateBioPage } from "@/app/actions/bioPageActions";
import { FontPicker } from "@/components/font-picker";
import { ButtonGroup } from "@/components/ui/button-group";
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
  socials: z
    .array(
      z
        .object({
          platform: z.string(),
          url: z.string(),
        })
        .superRefine((data, ctx) => {
          const { url, platform } = data;

          if (!url || url.trim() === "") return;

          try {
            const urlObj = new URL(
              url.startsWith("http") ? url : `https://${url}`,
            );
            let isValid = true;

            let errorMessage = "";

            switch (platform) {
              case "instagram":
                isValid = urlObj.hostname.includes("instagram.com");
                errorMessage =
                  "Please enter a valid Instagram URL (e.g., instagram.com/username)";
                break;
              case "twitter":
                isValid =
                  urlObj.hostname.includes("twitter.com") ||
                  urlObj.hostname.includes("x.com");
                errorMessage =
                  "Please enter a valid Twitter/X URL (e.g., twitter.com/username or x.com/username)";
                break;
              case "github":
                isValid = urlObj.hostname.includes("github.com");
                errorMessage =
                  "Please enter a valid GitHub URL (e.g., github.com/username)";
                break;
              case "facebook":
                isValid =
                  urlObj.hostname.includes("facebook.com") ||
                  urlObj.hostname.includes("fb.com");
                errorMessage =
                  "Please enter a valid Facebook URL (e.g., facebook.com/username)";
                break;
              case "youtube":
                isValid =
                  urlObj.hostname.includes("youtube.com") ||
                  urlObj.hostname.includes("youtu.be");
                errorMessage =
                  "Please enter a valid YouTube URL (e.g., youtube.com/@channel)";
                break;
              case "linkedin":
                isValid = urlObj.hostname.includes("linkedin.com");
                errorMessage =
                  "Please enter a valid LinkedIn URL (e.g., linkedin.com/in/username)";
                break;
              case "whatsapp":
                isValid =
                  urlObj.hostname.includes("wa.me") ||
                  urlObj.hostname.includes("whatsapp.com");
                errorMessage =
                  "Please enter a valid WhatsApp URL (e.g., wa.me/1234567890)";
                break;
              case "website":
                isValid = true;
                break;
              default:
                isValid = true;
            }

            if (!isValid) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["url"],
                message: errorMessage,
              });
            }
          } catch {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["url"],
              message: "Please enter a valid URL",
            });
          }
        }),
    )
    .optional(),
});

export const GetSocialIcon = ({
  platform,
  color,
}: {
  platform?: string;
  color?: string;
}): ReactNode => {
  switch (platform) {
    case "instagram":
      return (
        <FaInstagram color={color || "#FF0069"} className="w-5 h-5 shrink-0" />
      );
    case "twitter":
      return (
        <FaXTwitter color={color || "#000000"} className="w-5 h-5 shrink-0" />
      );
    case "github":
      return (
        <FaGithub color={color || "#181717"} className="w-5 h-5 shrink-0" />
      );
    case "facebook":
      return (
        <FaFacebook color={color || "#0866FF"} className="w-5 h-5 shrink-0" />
      );
    case "youtube":
      return (
        <FaYoutube color={color || "#FF0000"} className="w-5 h-5 shrink-0" />
      );
    case "linkedin":
      return (
        <FaLinkedin color={color || "#0866F"} className="w-5 h-5 shrink-0" />
      );
    case "whatsapp":
      return (
        <FaWhatsapp color={color || "#25D366"} className="w-5 h-5 shrink-0" />
      );
    default:
      return (
        <LinkIcon color={color || "#000000"} className="w-5 h-5 shrink-0" />
      );
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
    socials?: { url: string; platform: string }[];
    socialColor: string | "original";
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
  const router = useRouter();

  const uploadFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    callback: (_arg0: string) => void,
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
      const response = await updateBioPage({ bio });
      if (!response.success) {
        toast.error("Failed to save changes");
        setSaving(false);
        return;
      }
      toast.success("Changes saved successfully");
      router.refresh();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path.length === 3 && err.path[0] === "socials") {
            const platform = bio.socials?.[err.path[1] as number]?.platform;
            if (platform) {
              errors[platform] = err.message;
            }
          } else if (err.path[0]) {
            errors[err.path[0] as string] = err.message;
          }
        });
        setValidationErrors(errors);
        toast.error("Please fix the validation errors");
      }
    } finally {
      setSaving(false);
    }
  };

  const getFieldError = (field: string) => validationErrors[field];
  const hasFieldError = (field: string) => !!validationErrors[field];

  return (
    <div className="w-full max-w-7xl flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant={"link"} asChild>
          <Link className="font-semibold p-0!" href={`/dashboard/pages`}>
            <ChevronLeft />
            Back to list
          </Link>
        </Button>
        <Button variant={"outline"} asChild>
          <Link href={`/dashboard/pages/${bio.slug}`}>
            <LinkIcon className="h-4 w-4 mr-2" />
            Manage Links
          </Link>
        </Button>
      </div>
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
                <div className="flex flex-col gap-2 items-start sm:pt-4">
                  <div className="flex flex-row gap-1 items-center mt-auto">
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
                  <Label className="mt-2">Profile Image Shape</Label>
                  <RadioGroup
                    value={bio.avatarShape ?? "circle"}
                    onValueChange={(v) => {
                      updateBio((prev) => ({
                        ...prev,
                        avatarShape: v as (typeof prev)["avatarShape"],
                      }));
                    }}
                    className="flex flex-row items-center gap-2"
                  >
                    <div className="flex grow items-center gap-3">
                      <RadioGroupItem value="circle" id="r1" />
                      <Label htmlFor="r1">Circle</Label>
                    </div>
                    <div className="flex grow items-center gap-3">
                      <RadioGroupItem value="rounded" id="r2" />
                      <Label htmlFor="r2">Rounded</Label>
                    </div>
                    <div className="flex grow items-center gap-3">
                      <RadioGroupItem value="square" id="r3" />
                      <Label htmlFor="r3">Square</Label>
                    </div>
                  </RadioGroup>
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
                <div className="flex flex-col gap-2 items-start grow">
                  <div className="flex grow items-center gap-3">
                    <RadioGroupItem value="no-header" id="r1" />
                    <Label htmlFor="r1">No Header</Label>
                  </div>
                  <div className="w-full max-w-20 p-1 h-auto aspect-9/16 border flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-muted mx-auto mt-2 flex items-center justify-center">
                      <ImageIcon className="text-muted-foreground w-2.5 h-2.5" />
                    </div>
                    <div className="w-[50%] mx-auto h-1 rounded-full bg-muted-foreground mt-1"></div>
                    <div className="w-[95%] mx-auto h-1.5 rounded-full bg-primary mt-2.5"></div>
                    <div className="w-[95%] mx-auto h-1.5 rounded-full bg-primary mt-0.5"></div>
                    <div className="w-[95%] mx-auto h-1.5 rounded-full bg-primary mt-0.5"></div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-start grow">
                  <div className="flex grow items-center gap-3">
                    <RadioGroupItem value="centered" id="r2" />
                    <Label htmlFor="r2">Centered</Label>
                  </div>
                  <div className="w-full max-w-20 p-0 h-auto aspect-9/16 border flex flex-col items-center">
                    <div className="relative flex items-center flex-col w-full h-8 bg-primary">
                      <div className="w-6 h-6 rounded-full bg-muted mx-auto flex items-center justify-center absolute mt-5">
                        <ImageIcon className="text-muted-foreground w-2.5 h-2.5" />
                      </div>
                      <div className="w-[50%] mx-auto h-1 rounded-full bg-muted-foreground mt-12 absolute"></div>
                    </div>

                    <div className="w-[90%] mx-auto h-1.5 rounded-full bg-primary mt-7"></div>
                    <div className="w-[90%] mx-auto h-1.5 rounded-full bg-primary mt-0.5"></div>
                    <div className="w-[90%] mx-auto h-1.5 rounded-full bg-primary mt-0.5"></div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-start grow">
                  <div className="flex grow items-center gap-3">
                    <RadioGroupItem value="left-aligned" id="r3" />
                    <Label htmlFor="r3">Leftmost</Label>
                  </div>
                  <div className="w-full max-w-20 p-0 h-auto aspect-9/16 border flex flex-col items-center">
                    <div className="relative flex items-start flex-col w-full h-8 bg-primary">
                      <div className="w-6 h-6 rounded-full bg-muted ml-1 flex items-center justify-center absolute mt-5">
                        <ImageIcon className="text-muted-foreground w-2.5 h-2.5" />
                      </div>
                      <div className="w-[50%] ml-1 h-1 rounded-full bg-muted-foreground mt-12 absolute"></div>
                    </div>

                    <div className="w-[90%] mx-auto h-1.5 rounded-full bg-primary mt-7"></div>
                    <div className="w-[90%] mx-auto h-1.5 rounded-full bg-primary mt-0.5"></div>
                    <div className="w-[90%] mx-auto h-1.5 rounded-full bg-primary mt-0.5"></div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-start grow">
                  <div className="flex grow items-center gap-3">
                    <RadioGroupItem value="right-aligned" id="r4" />
                    <Label htmlFor="r4">Rightmost</Label>
                  </div>
                  <div className="w-full max-w-20 p-0 h-auto aspect-9/16 border flex flex-col items-center">
                    <div className="relative flex items-end flex-col w-full h-8 bg-primary">
                      <div className="w-6 h-6 rounded-full bg-muted mr-1 flex items-center justify-center absolute mt-5">
                        <ImageIcon className="text-muted-foreground w-2.5 h-2.5" />
                      </div>
                      <div className="w-[50%] mr-1 h-1 rounded-full bg-muted-foreground mt-12 absolute"></div>
                    </div>

                    <div className="w-[90%] mx-auto h-1.5 rounded-full bg-primary mt-7"></div>
                    <div className="w-[90%] mx-auto h-1.5 rounded-full bg-primary mt-0.5"></div>
                    <div className="w-[90%] mx-auto h-1.5 rounded-full bg-primary mt-0.5"></div>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
            {bio.theme?.header && (
              <CardContent className="p-0 flex flex-col gap-4 flex-wrap w-full">
                <Tabs
                  defaultValue={
                    bio.theme?.header.headerBackgroundImage ? "image" : "color"
                  }
                >
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
                    <div className="flex flex-col gap-4 w-full">
                      <div className="flex flex-col gap-2 w-full">
                        <Label>Background Image</Label>
                        <div className="flex flex-row items-center justify-start gap-1">
                          <Input
                            ref={headerBackgroundRef}
                            disabled={uploading !== ""}
                            type="file"
                            className=""
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
            <CardContent className="p-0 flex flex-col gap-4 flex-wrap w-full">
              <Label className="text-lg font-bold">Typography</Label>
              <div className="flex flex-col gap-2">
                <Label>Font Family</Label>
                <FontPicker
                  value={bio.theme?.font}
                  onChange={(fontFamily) => {
                    updateBio((prev) => ({
                      ...prev,
                      theme: { ...prev.theme, font: fontFamily },
                    }));
                  }}
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Title Font Size</Label>
                <ButtonGroup>
                  <Button
                    type="button"
                    variant={
                      bio.theme?.titleFontSize === "1rem"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateBio((prev) => ({
                        ...prev,
                        theme: { ...prev.theme, titleFontSize: "1rem" },
                      }))
                    }
                  >
                    Small
                  </Button>
                  <Button
                    type="button"
                    variant={
                      !bio.theme?.titleFontSize ||
                      bio.theme?.titleFontSize === "1.25rem"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateBio((prev) => ({
                        ...prev,
                        theme: { ...prev.theme, titleFontSize: "1.25rem" },
                      }))
                    }
                  >
                    Medium
                  </Button>
                  <Button
                    type="button"
                    variant={
                      bio.theme?.titleFontSize === "1.5rem"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateBio((prev) => ({
                        ...prev,
                        theme: { ...prev.theme, titleFontSize: "1.5rem" },
                      }))
                    }
                  >
                    Large
                  </Button>
                  <Button
                    type="button"
                    variant={
                      bio.theme?.titleFontSize === "2rem"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateBio((prev) => ({
                        ...prev,
                        theme: { ...prev.theme, titleFontSize: "2rem" },
                      }))
                    }
                  >
                    XLarge
                  </Button>
                </ButtonGroup>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Title Font Weight</Label>
                <ButtonGroup>
                  <Button
                    type="button"
                    variant={
                      bio.theme?.titleFontWeight === "400"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateBio((prev) => ({
                        ...prev,
                        theme: { ...prev.theme, titleFontWeight: "400" },
                      }))
                    }
                  >
                    Normal
                  </Button>
                  <Button
                    type="button"
                    variant={
                      bio.theme?.titleFontWeight === "600"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateBio((prev) => ({
                        ...prev,
                        theme: { ...prev.theme, titleFontWeight: "600" },
                      }))
                    }
                  >
                    Semibold
                  </Button>
                  <Button
                    type="button"
                    variant={
                      bio.theme?.titleFontWeight === "700"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateBio((prev) => ({
                        ...prev,
                        theme: { ...prev.theme, titleFontWeight: "700" },
                      }))
                    }
                  >
                    Bold
                  </Button>
                  <Button
                    type="button"
                    variant={
                      !bio.theme?.titleFontWeight ||
                      bio.theme?.titleFontWeight === "900"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateBio((prev) => ({
                        ...prev,
                        theme: { ...prev.theme, titleFontWeight: "900" },
                      }))
                    }
                  >
                    Black
                  </Button>
                </ButtonGroup>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Description Font Size</Label>
                <ButtonGroup>
                  <Button
                    type="button"
                    variant={
                      bio.theme?.descriptionFontSize === "0.75rem"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateBio((prev) => ({
                        ...prev,
                        theme: {
                          ...prev.theme,
                          descriptionFontSize: "0.75rem",
                        },
                      }))
                    }
                  >
                    Small
                  </Button>
                  <Button
                    type="button"
                    variant={
                      !bio.theme?.descriptionFontSize ||
                      bio.theme?.descriptionFontSize === "0.875rem"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateBio((prev) => ({
                        ...prev,
                        theme: {
                          ...prev.theme,
                          descriptionFontSize: "0.875rem",
                        },
                      }))
                    }
                  >
                    Medium
                  </Button>
                  <Button
                    type="button"
                    variant={
                      bio.theme?.descriptionFontSize === "1rem"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateBio((prev) => ({
                        ...prev,
                        theme: { ...prev.theme, descriptionFontSize: "1rem" },
                      }))
                    }
                  >
                    Large
                  </Button>
                </ButtonGroup>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Description Font Weight</Label>
                <ButtonGroup>
                  <Button
                    type="button"
                    variant={
                      !bio.theme?.descriptionFontWeight ||
                      bio.theme?.descriptionFontWeight === "300"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateBio((prev) => ({
                        ...prev,
                        theme: { ...prev.theme, descriptionFontWeight: "300" },
                      }))
                    }
                  >
                    Light
                  </Button>
                  <Button
                    type="button"
                    variant={
                      bio.theme?.descriptionFontWeight === "400"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateBio((prev) => ({
                        ...prev,
                        theme: { ...prev.theme, descriptionFontWeight: "400" },
                      }))
                    }
                  >
                    Normal
                  </Button>
                  <Button
                    type="button"
                    variant={
                      bio.theme?.descriptionFontWeight === "600"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateBio((prev) => ({
                        ...prev,
                        theme: { ...prev.theme, descriptionFontWeight: "600" },
                      }))
                    }
                  >
                    Semibold
                  </Button>
                </ButtonGroup>
              </div>
            </CardContent>
          </Card>
          <Card className="w-full flex flex-col gap-4 p-4! rounded!">
            <CardTitle className="text-lg font-bold">Buttons</CardTitle>
            <CardContent className="p-0 flex flex-col gap-4 flex-wrap w-full">
              <Label>Button Style</Label>
              <RadioGroup
                onValueChange={(v) => {
                  updateBio((prev) => ({
                    ...prev,
                    theme: {
                      ...prev.theme,
                      buttonStyle: v as "rounded" | "square" | "pill",
                    },
                  }));
                }}
                className="w-full flex flex-row gap-1 items-start flex-wrap"
                value={bio.theme?.buttonStyle || "rounded"}
              >
                <div className="flex flex-col gap-2 items-start grow">
                  <div className="flex grow items-center gap-3">
                    <RadioGroupItem value="rounded" id="btn-rounded" />
                    <Label htmlFor="btn-rounded">Rounded</Label>
                  </div>
                  <div className="w-full max-w-20 p-1 h-auto aspect-9/16 border flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-muted mx-auto mt-2 flex items-center justify-center">
                      <ImageIcon className="text-muted-foreground w-2.5 h-2.5" />
                    </div>
                    <div className="w-[50%] mx-auto h-1 rounded-full bg-muted-foreground mt-1"></div>
                    <div className="w-[95%] mx-auto h-1.5 rounded-none bg-primary mt-2.5"></div>
                    <div className="w-[95%] mx-auto h-1.5 rounded-none bg-primary mt-0.5"></div>
                    <div className="w-[95%] mx-auto h-1.5 rounded-none bg-primary mt-0.5"></div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-start grow">
                  <div className="flex grow items-center gap-3">
                    <RadioGroupItem value="square" id="btn-square" />
                    <Label htmlFor="btn-square">Square</Label>
                  </div>
                  <div className="w-full max-w-20 p-1 h-auto aspect-9/16 border flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-muted mx-auto mt-2 flex items-center justify-center">
                      <ImageIcon className="text-muted-foreground w-2.5 h-2.5" />
                    </div>
                    <div className="w-[50%] mx-auto h-1 rounded-full bg-muted-foreground mt-1"></div>
                    <div className="grid grid-cols-3 w-[95%] mt-2.5 gap-px">
                      <div className="col-span-1 bg-primary h-auto aspect-square"></div>
                      <div className="col-span-1 bg-primary h-auto aspect-square"></div>
                      <div className="col-span-1 bg-primary h-auto aspect-square"></div>
                      <div className="col-span-1 bg-primary h-auto aspect-square"></div>
                      <div className="col-span-1 bg-primary h-auto aspect-square"></div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-start grow">
                  <div className="flex grow items-center gap-3">
                    <RadioGroupItem value="pill" id="btn-pill" />
                    <Label htmlFor="btn-pill">Pill</Label>
                  </div>
                  <div className="w-full max-w-20 p-1 h-auto aspect-9/16 border flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-muted mx-auto mt-2 flex items-center justify-center">
                      <ImageIcon className="text-muted-foreground w-2.5 h-2.5" />
                    </div>
                    <div className="w-[50%] mx-auto h-1 rounded-full bg-muted-foreground mt-1"></div>
                    <div className="w-[95%] mx-auto h-1.5 rounded-full bg-primary mt-2.5"></div>
                    <div className="w-[95%] mx-auto h-1.5 rounded-full bg-primary mt-0.5"></div>
                    <div className="w-[95%] mx-auto h-1.5 rounded-full bg-primary mt-0.5"></div>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
            <CardContent className="p-0 flex flex-col gap-4 flex-wrap w-full">
              <Label className="text-lg font-bold">Button Typography</Label>
              <div className="flex flex-col gap-2">
                <Label>Button Font Size</Label>
                <ButtonGroup>
                  <Button
                    type="button"
                    variant={
                      bio.theme?.buttonFontSize === "0.75rem"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateBio((prev) => ({
                        ...prev,
                        theme: { ...prev.theme, buttonFontSize: "0.75rem" },
                      }))
                    }
                  >
                    Small
                  </Button>
                  <Button
                    type="button"
                    variant={
                      !bio.theme?.buttonFontSize ||
                      bio.theme?.buttonFontSize === "0.875rem"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateBio((prev) => ({
                        ...prev,
                        theme: { ...prev.theme, buttonFontSize: "0.875rem" },
                      }))
                    }
                  >
                    Medium
                  </Button>
                  <Button
                    type="button"
                    variant={
                      bio.theme?.buttonFontSize === "1rem"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateBio((prev) => ({
                        ...prev,
                        theme: { ...prev.theme, buttonFontSize: "1rem" },
                      }))
                    }
                  >
                    Large
                  </Button>
                </ButtonGroup>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Button Font Weight</Label>
                <ButtonGroup>
                  <Button
                    type="button"
                    variant={
                      bio.theme?.buttonFontWeight === "400"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateBio((prev) => ({
                        ...prev,
                        theme: { ...prev.theme, buttonFontWeight: "400" },
                      }))
                    }
                  >
                    Normal
                  </Button>
                  <Button
                    type="button"
                    variant={
                      !bio.theme?.buttonFontWeight ||
                      bio.theme?.buttonFontWeight === "500"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateBio((prev) => ({
                        ...prev,
                        theme: { ...prev.theme, buttonFontWeight: "500" },
                      }))
                    }
                  >
                    Medium
                  </Button>
                  <Button
                    type="button"
                    variant={
                      bio.theme?.buttonFontWeight === "600"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateBio((prev) => ({
                        ...prev,
                        theme: { ...prev.theme, buttonFontWeight: "600" },
                      }))
                    }
                  >
                    Semibold
                  </Button>
                  <Button
                    type="button"
                    variant={
                      bio.theme?.buttonFontWeight === "700"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateBio((prev) => ({
                        ...prev,
                        theme: { ...prev.theme, buttonFontWeight: "700" },
                      }))
                    }
                  >
                    Bold
                  </Button>
                </ButtonGroup>
              </div>
            </CardContent>
            <CardContent className="p-0 flex flex-col gap-4 flex-wrap w-full">
              <Label className="text-lg font-bold">Button Colors</Label>
              <div className="flex flex-row items-center gap-2 justify-start flex-wrap">
                <InputColor
                  className="mt-0! w-full"
                  size="h-8"
                  onBlur={() => {}}
                  label="Button Background"
                  value={bio.theme?.primaryColor || "#0f172b"}
                  onChange={(v) => {
                    updateBio((prev) => ({
                      ...prev,
                      theme: { ...prev.theme, primaryColor: v },
                    }));
                  }}
                />
                <InputColor
                  className="mt-0! w-full"
                  size="h-8"
                  onBlur={() => {}}
                  label="Button Text Color"
                  value={bio.theme?.buttonTextColor || "#ffffff"}
                  onChange={(v) => {
                    updateBio((prev) => ({
                      ...prev,
                      theme: { ...prev.theme, buttonTextColor: v },
                    }));
                  }}
                />
              </div>
            </CardContent>
          </Card>
          <Card className="w-full flex flex-col gap-4 p-4! rounded!">
            <CardTitle className="text-lg font-bold">Socials</CardTitle>
            <Label className="">Select icons</Label>
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

            {(bio.socials || []).length > 0 && (
              <Label className="">Edit links</Label>
            )}
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
                <div className="p-0 flex flex-col gap-4 flex-wrap w-full">
                  {bio.socials?.map((social) => {
                    return (
                      <SortableItem
                        key={social.platform}
                        value={social.platform}
                        asChild
                      >
                        <div
                          className={cn(
                            "w-full flex flex-row items-center gap-1",
                            hasFieldError(social.platform) && "mb-4",
                          )}
                        >
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
                            className="w-full ml-2 relative"
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
                              <FieldError className="absolute top-full left-0 mt-1">
                                {getFieldError(social.platform)}
                              </FieldError>
                            )}
                          </Field>
                          <Button
                            onClick={() => {
                              updateBio((prev) => ({
                                ...prev,
                                socials:
                                  (prev.socials?.filter(
                                    (s) => s.platform !== social.platform,
                                  )?.length ?? 0) > 0
                                    ? prev.socials?.filter(
                                        (s) => s.platform !== social.platform,
                                      )
                                    : undefined,
                              }));
                            }}
                            variant={"destructive"}
                            size={"icon"}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </SortableItem>
                    );
                  })}
                </div>
              </SortableContent>
            </Sortable>
            {(bio.socials || []).length > 0 && (
              <CardContent className="p-0 flex flex-col gap-4 flex-wrap w-full">
                <Tabs
                  onValueChange={(v) => {
                    if (v == "original") {
                      updateBio((prev) => ({
                        ...prev,
                        socialColor: "original",
                      }));
                    } else {
                      updateBio((prev) => ({
                        ...prev,
                        socialColor: "#0f172b",
                      }));
                    }
                  }}
                  defaultValue={
                    bio.socialColor === "original" ||
                    bio.socialColor === "#000000" ||
                    bio.socialColor === "#ffffff"
                      ? "original"
                      : "color"
                  }
                >
                  <div className="flex flex-row items-center justify-between">
                    <Label>Icon color</Label>
                    <TabsList>
                      <TabsTrigger value="original">Original</TabsTrigger>
                      <TabsTrigger value="color">Custom Color</TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="color">
                    <InputColor
                      className="-mt-2! w-full"
                      size="h-8"
                      onBlur={() => {}}
                      label=""
                      value={bio.socialColor || "#000000"}
                      onChange={(v) => {
                        updateBio((prev) => ({
                          ...prev,
                          socialColor: v,
                        }));
                      }}
                    />
                  </TabsContent>
                  <TabsContent value="original">
                    <RadioGroup
                      value={bio.socialColor}
                      onValueChange={(v) => {
                        updateBio((prev) => ({
                          ...prev,
                          socialColor: v,
                        }));
                      }}
                      className="w-full flex flex-row gap-4 items-start flex-wrap"
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="original" id="r1" />
                        <Label htmlFor="r1">Original</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="#000000" id="r2" />
                        <Label htmlFor="r2">Black</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="#ffffff" id="r3" />
                        <Label htmlFor="r3">White</Label>
                      </div>
                    </RadioGroup>
                  </TabsContent>
                </Tabs>
              </CardContent>
            )}
          </Card>
        </div>

        <div className="hidden lg:flex sticky top-20 w-full max-w-[375px] shrink-0 flex-col items-center gap-4">
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
