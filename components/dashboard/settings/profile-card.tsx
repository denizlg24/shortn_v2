"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  //  AlertCircle,
  //  CheckCircle,
  CheckCircle2,
  //  ClockFading,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import z from "zod";

import { isValidPhoneNumber } from "react-phone-number-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { useLocale } from "next-intl";
import en from "react-phone-number-input/locale/en";
import pt from "react-phone-number-input/locale/pt";
import es from "react-phone-number-input/locale/es";
import { useUser } from "@/utils/UserContext";
import { Skeleton } from "@/components/ui/skeleton";
//import { getTaxVerification, updateTaxId } from "@/app/actions/stripeActions";
//import { TaxIdInput } from "@/components/ui/tax-id-input";
import { toast } from "sonner";
import { updatePhone } from "@/app/actions/stripeActions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { uploadImage } from "@/app/actions/uploadImage";
import { updateUserField } from "@/app/actions/userActions";
import { deleteProfilePicture } from "@/app/actions/userActions";
import { signOutUser } from "@/app/actions/signOut";
import { updateEmail } from "@/app/actions/userActions";
import { sendVerificationEmail } from "@/app/actions/userActions";
//import { checkVAT, countries } from "jsvat";
//import Stripe from "stripe";
//import {
//  HoverCard,
//  HoverCardContent,
//  HoverCardTrigger,
//} from "@/components/ui/hover-card";

const updateEmailFormSchema = z.object({
  email: z
    .string()
    .min(1, "Please provide an email")
    .email("Must be a valid email address"),
});

const updateProfileFormSchema = z.object({
  fullName: z
    .string()
    .min(1, "Please provide a display name")
    .max(64, "Can't be longer than 64 characters"),
  username: z
    .string()
    .min(1, "Please provide a username")
    .max(32, "Username must be at most 32 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Only letters, numbers, and underscores are allowed",
    ),
  /*"tax-id": z.string().refine(
    (val) => {
      if (val) {
        return checkVAT(val, countries).isValid;
      }
      return true;
    },
    {
      message: "Must be a valid tax number",
    }
  ),*/
  phone: z.string().refine(
    (t) => {
      if (t) return isValidPhoneNumber(t);
      return true;
    },
    { message: "Invalid phone number" },
  ),
});

export const ProfileCard = ({
  initialUser,
}: {
  initialUser: {
    id: string;
    sub: string;
    email: string;
    displayName: string;
    profilePicture: string | undefined;
    stripeId: string;
    username: string;
    emailVerified: boolean;
    createdAt: Date;
    plan: {
      subscription: string;
      lastPaid: Date;
    };
    links_this_month: number;
    qr_codes_this_month: number;
    phone_number: string;
    tax_id: string;
  };
}) => {
  const locale = useLocale();
  const localeMap = {
    en: en,
    pt: pt,
    es: es,
  };

  const { refresh, loading } = useUser();

  const inputRef = useRef<HTMLInputElement>(null);
  const [changesLoading, setChangesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [user, setUser] = useState<{
    id: string;
    sub: string;
    email: string;
    displayName: string;
    profilePicture: string | undefined;
    stripeId: string;
    username: string;
    emailVerified: boolean;
    createdAt: Date;
    plan: {
      subscription: string;
      lastPaid: Date;
    };
    links_this_month: number;
    qr_codes_this_month: number;
    phone_number: string;
    tax_id: string;
  }>(initialUser);
  /*const [verification, setVerification] = useState<
    Stripe.TaxId.Verification | undefined
  >(undefined);*/
  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      const validTypes = ["image/jpeg", "image/png", "image/gif"];
      const maxSizeInBytes = 10 * 1024 * 1024;

      if (!validTypes.includes(file.type)) {
        toast.error("Invalid file type. Only JPG, PNG, and GIF are allowed.");
        return;
      }

      if (file.size > maxSizeInBytes) {
        toast.error("File is too large. Must be under 10MB.");
        return;
      }
      setUploading(true);
      const { success, url } = await uploadImage(file);
      if (success && url) {
        const { success } = await updateUserField("profilePicture", url);
        if (success) {
          toast.success("Profile picture has been updated!");
          setUser((prev) => ({
            ...prev,
            profilePicture: url as string,
          }));
          const accountActivity = {
            sub: user.sub,
            type: "picture-changed",
            success: true,
          };
          fetch("/api/auth/track-activity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(accountActivity),
          });
          await refresh();
        } else {
          toast.success("There was a problem updating profile picture.");
        }
      }
      setUploading(false);
    }
  };

  const form = useForm<z.infer<typeof updateProfileFormSchema>>({
    resolver: zodResolver(updateProfileFormSchema),
    defaultValues: {
      fullName: user?.displayName || "",
      username: user?.username || "",
      //"tax-id": user?.tax_id || "",
      phone: user?.phone_number || "",
    },
  });

  const updateEmailForm = useForm<z.infer<typeof updateEmailFormSchema>>({
    resolver: zodResolver(updateEmailFormSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmitEmail(values: z.infer<typeof updateEmailFormSchema>) {
    if (!user) {
      return;
    }
    setUpdatingEmail(true);
    const { success, message } = await updateEmail(values.email);
    if (success) {
      const accountActivity = {
        sub: user.sub,
        type: "email-changed",
        success: true,
      };
      fetch("/api/auth/track-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountActivity),
      });
      await sendVerificationEmail(values.email, locale);
      await signOutUser(`/${locale}/verification-sent/${values.email}`);
    } else if (message) {
      if (message == "email-taken") {
        updateEmailForm.setError("email", {
          type: "manual",
          message: "Email is already registered to another account",
        });
      } else {
        updateEmailForm.setError("email", {
          type: "manual",
          message: "There was a problem updating your email",
        });
      }
    }
    setUpdatingEmail(false);
  }

  async function onSubmit(values: z.infer<typeof updateProfileFormSchema>) {
    if (!user) {
      return;
    }
    setChangesLoading(true);

    const updateField = async (
      field: "phone",
      updater: (
        stripeId: string,
        value: string,
      ) => Promise<{ success: boolean; message: string | null }>,
      errorMessages: { invalid: string; server: string },
    ) => {
      if (!form.getFieldState(field).isDirty) return false;

      const { success, message } = await updater(user.stripeId, values[field]);
      if (success) {
        const accountActivity = {
          sub: user.sub,
          type: "phone-changed",
          success: true,
        };
        fetch("/api/auth/track-activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(accountActivity),
        });
        return true;
      }

      form.setError(field, {
        type: "manual",
        message:
          message === "server-error"
            ? errorMessages.server
            : errorMessages.invalid,
      });

      return false;
    };

    const updated = [0, 0, 0];

    {
      /*if (
      await updateField("tax-id", updateTaxId, {
        invalid: "Your tax ID is not valid.",
        server: "There was a problem updating your tax ID.",
      })
    ) {
      updated++;
    }*/
    }
    const updateFields: Record<string, string> = {};
    if (
      await updateField("phone", updatePhone, {
        invalid: "Your phone number is not valid.",
        server: "There was a problem updating your phone number.",
      })
    ) {
      updateFields["phone_number"] = values.phone;
      updated[2] = 1;
    }
    if (form.getFieldState("username").isDirty) {
      const { success, message } = await updateUserField(
        "username",
        values.username,
      );
      if (success) {
        updateFields["username"] = values.username;
        updated[1] = 1;
      } else {
        form.setError("username", {
          type: "manual",
          message:
            message === "server-error"
              ? "There was a problem updating your username."
              : message == "duplicate"
                ? "That username is already taken."
                : "Your username is not valid.",
        });
      }
    }
    if (form.getFieldState("fullName").isDirty) {
      const { success, message } = await updateUserField(
        "displayName",
        values.fullName,
      );
      if (success) {
        updateFields["displayName"] = values.fullName;
        updated[0] = 1;
      } else {
        form.setError("fullName", {
          type: "manual",
          message:
            message === "server-error"
              ? "There was a problem updating your display name."
              : "That display name is invalid.",
        });
      }
    }

    if (updated.some((a) => a == 1)) {
      const accountActivity = {
        sub: user.sub,
        type: "profile-changed",
        success: true,
      };
      fetch("/api/auth/track-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountActivity),
      });
      toast.success("Your profile has been updated!");
      await refresh();
      setUser((prev) => ({
        ...prev,
        ...updateFields,
      }));
    }

    setChangesLoading(false);
  }

  useEffect(() => {
    form.reset(user, {
      keepErrors: true,
      keepDirty: false,
      keepTouched: false,
      keepDirtyValues: false,
    });
  }, [form, user]);

  if (loading) {
    return (
      <div className="w-full flex flex-col">
        <h1 className="lg:text-xl md:text-lg sm:text-base text-sm font-semibold">
          Profile Details
        </h1>
        <h2 className="lg:text-base sm:text-sm text-xs text-muted-foreground">
          Update your photo and personal details here.
        </h2>
        <Separator className="my-4" />
        <div className="flex flex-row items-stretch justify-start gap-4 w-full">
          <Skeleton className="h-auto! w-full! min-w-12! max-w-24! aspect-square rounded-lg! bg-muted-foreground!" />
          <div className="w-full grow h-full flex flex-col justify-between py-1">
            <Skeleton className="w-16 col-span-1 h-4 rounded bg-muted-foreground!" />
            <div className="flex flex-col gap-1 items-start w-full">
              <div className="flex flex-row items-center justify-start gap-2 w-full">
                <Skeleton className="w-28 h-6 bg-muted-foreground!" />
              </div>
              <Skeleton className="w-36 col-span-1 h-4 rounded bg-muted-foreground!" />
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 grid-cols-1 max-w-xl gap-x-8 gap-y-4 w-full my-4 items-start">
          <div className="flex flex-col gap-1 w-full col-span-1">
            <Skeleton className="w-[25%] col-span-1 h-4 rounded bg-muted-foreground!" />
            <Skeleton className="w-full col-span-1 h-8 rounded bg-muted-foreground!" />
          </div>
          <div className="flex flex-col gap-1 w-full col-span-1">
            <Skeleton className="w-[25%] col-span-1 h-4 rounded bg-muted-foreground!" />
            <Skeleton className="w-full col-span-1 h-8 rounded bg-muted-foreground!" />
          </div>
          <div className="flex flex-col gap-1 w-full col-span-1">
            <Skeleton className="w-[25%] col-span-1 h-4 rounded bg-muted-foreground!" />
            <Skeleton className="w-full col-span-1 h-8 rounded bg-muted-foreground!" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col">
      <h1 className="lg:text-xl md:text-lg sm:text-base text-sm font-semibold">
        Profile Details
      </h1>
      <h2 className="lg:text-base sm:text-sm text-xs text-muted-foreground">
        Update your photo and personal details here.
      </h2>
      <Separator className="my-4" />
      <div className="flex sm:flex-row flex-col items-stretch justify-start gap-4 w-full">
        <Avatar className="h-auto! w-full! min-w-12! max-w-24! aspect-square rounded-lg! border">
          {user.profilePicture && (
            <AvatarImage
              className="object-cover"
              src={user.profilePicture != "" ? user.profilePicture : undefined}
              alt={user.displayName}
            />
          )}
          <AvatarFallback className="bg-muted-foreground text-primary-foreground rounded-lg!">
            {user.displayName
              .trim()
              .split(/\s+/)
              .filter(Boolean)
              .map((w) => w[0].toUpperCase())
              .filter((_, i, a) => i === 0 || i === a.length - 1)
              .join("")}
          </AvatarFallback>
        </Avatar>
        <div className="w-full grow h-full flex flex-col justify-between py-1">
          <p className="font-semibold">Profile Picture</p>
          <div className="flex flex-col gap-0 items-start w-full">
            <div className="flex flex-row items-center justify-start gap-2">
              <Button
                disabled={uploading || removing}
                className="text-sm! p-2! py-1! h-fit w-fit"
                onClick={handleClick}
              >
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>Upload Image</>
                )}
                <Upload />
              </Button>
              {user.profilePicture && (
                <Button
                  variant="outline"
                  disabled={uploading || removing}
                  className="text-sm! p-2! py-1! h-fit w-fit"
                  onClick={async () => {
                    if (user.profilePicture) {
                      setRemoving(true);
                      const { success } = await deleteProfilePicture(
                        user.sub,
                        user.profilePicture,
                      );
                      if (success) {
                        toast.success("Successfully removed profile picture.");
                        await refresh();
                      } else {
                        toast.error("Couldn't remove your profile picture.");
                      }
                      setRemoving(false);
                    }
                  }}
                >
                  {removing ? (
                    <>
                      <Loader2 className="animate-spin" /> Removing...
                    </>
                  ) : (
                    <>Remove</>
                  )}
                  <Trash2 />
                </Button>
              )}
            </div>

            <input
              ref={inputRef}
              type="file"
              onChange={handleChange}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground">
              We support PNGs, JPEGS and GIF&apos;s under 10MB.
            </p>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid sm:grid-cols-2 grid-cols-1 max-w-xl gap-x-8 gap-y-4 w-full my-4 items-start"
        >
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input className="bg-background" placeholder="" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input className="bg-background" placeholder="" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem className="flex flex-col items-start">
                <FormLabel className="text-left">Phone Number</FormLabel>
                <FormControl className="w-full">
                  <PhoneInput
                    labels={localeMap[locale as "en" | "es" | "pt"]}
                    defaultCountry="PT"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid xs:grid-cols-2 grid-cols-1 w-full col-span-full gap-6 gap-y-2">
            {form.formState.isDirty && (
              <>
                <Button type="submit" disabled={changesLoading}>
                  {changesLoading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>Save Changes</>
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    form.reset({
                      fullName: user.displayName || "",
                      username: user.username || "",
                      //"tax-id": user.tax_id || "",
                      phone: user.phone_number || "",
                    });
                  }}
                  variant={"outline"}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </form>
      </Form>
      <Separator className="my-4" />
      <div className="w-full flex flex-col gap-0">
        <h1 className="lg:text-xl md:text-lg sm:text-base text-sm font-semibold">
          Email address
        </h1>
        <h2 className="lg:text-base sm:text-sm text-xs text-muted-foreground">
          Add or update your email address
        </h2>
      </div>
      <Separator className="my-4" />
      <div className="flex flex-col w-full">
        <div className="grid grid-cols-4 w-full max-w-xl gap-1">
          <p className="text-left w-full sm:col-span-2 col-span-3 font-semibold">
            Email address
          </p>
          <p className="text-left w-full sm:col-span-2 col-span-1 font-semibold">
            Status
          </p>
          <Separator className="col-span-full" />
          <p className="text-left w-full sm:col-span-2 col-span-3 truncate">
            {user.email}
          </p>
          <p className="text-left w-full sm:col-span-2 col-span-1 truncate flex flex-row items-center gap-1">
            {user.emailVerified && (
              <>
                <CheckCircle2 className="text-green-600 h-4 w-4" /> Verified
              </>
            )}
          </p>
          <Separator className="col-span-full" />
          <Dialog>
            <DialogTrigger asChild>
              <Button className="mt-2 w-fit">Update Email</Button>
            </DialogTrigger>
            <DialogContent className="z-99">
              <DialogHeader>
                <DialogTitle>Update your email address</DialogTitle>
                <DialogDescription>
                  A verification email will be sent to this address after
                  clicking Save.{" "}
                  <span className="font-semibold">You will be signed out!</span>
                </DialogDescription>
              </DialogHeader>
              <Form {...updateEmailForm}>
                <form
                  onSubmit={updateEmailForm.handleSubmit(onSubmitEmail)}
                  className="flex flex-col w-full items-stretch gap-2"
                >
                  <FormField
                    control={updateEmailForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New email address</FormLabel>
                        <FormControl>
                          <Input placeholder="" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button>
                    {updatingEmail ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>Update email</>
                    )}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};
