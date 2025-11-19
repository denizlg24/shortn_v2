"use client";
import { createBioPage } from "@/app/actions/bioPageActions";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { useUser } from "@/utils/UserContext";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LockIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";

const pageFormSchema = z.object({
  title: z
    .string()
    .max(100, "Title can't be longer than 100 characters")
    .optional(),
  slug: z
    .string()
    .min(3, "Page URL must be at least 3 characters long")
    .max(52, "Page URL can't be longer than 52 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Page URL can only contain letters, numbers, dashes (-), and underscores (_)",
    ),
});

export const CreatePage = () => {
  const BASEURL = window.location.origin ?? "http://localhost:3000";
  const session = useUser();
  const [creating, setCreating] = useState(false);
  const pageForm = useForm<z.infer<typeof pageFormSchema>>({
    resolver: zodResolver(pageFormSchema),
    defaultValues: {
      title: "",
      slug: "",
    },
  });

  const router = useRouter();

  return (
    <div className="w-full flex flex-col gap-6 items-start col-span-full">
      <h1 className="font-bold lg:text-3xl md:text-2xl sm:text-xl text-lg">
        Create a new Link-in-bio Page
      </h1>
      <div className="rounded bg-background lg:p-6 md:p-4 p-3 w-full flex flex-col gap-4">
        <Form {...pageForm}>
          <form className="w-full flex flex-col gap-4">
            <FormField
              control={pageForm.control}
              name="title"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>Tittle (optional)</FormLabel>
                  <FormControl>
                    <Input className="w-full" placeholder="" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <h2 className="font-semibold lg:text-xl sm:text-lg text-base">
              Your page
            </h2>
            <div className="w-full flex flex-row items-end justify-center gap-2 -mt-2">
              <div className="w-full grow flex flex-col items-start gap-2">
                <p className="sm:text-sm text-xs font-semibold">Domain</p>
                <Input disabled className="w-full" readOnly value={BASEURL} />
              </div>
              <div className="h-9 text-sm flex items-center justify-center">
                <p>/b/</p>
              </div>
              <div className="w-full grow flex flex-col items-start gap-2">
                <p className="sm:text-sm text-xs font-semibold">
                  Link in bio code
                </p>
                <FormField
                  control={pageForm.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem className="w-full relative">
                      <FormControl>
                        <Input className="w-full" placeholder="" {...field} />
                      </FormControl>
                      <FormMessage className="absolute -bottom-6" />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <div className="w-full flex flex-col gap-0.5 items-start">
              <p className="text-sm text-muted-foreground">
                Your Page&apos;s link will look like
              </p>
              <Input
                className="w-full bg-muted"
                value={`${BASEURL}/b/${pageForm.watch("slug")}`}
                disabled
              />
            </div>
          </form>
          <FormRootError />
        </Form>
        <div className="flex flex-row items-center justify-between mt-4">
          <Button
            onClick={() => {
              router.push("/dashboard");
            }}
            variant={"secondary"}
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (session.user?.plan.subscription != "pro") {
                router.push("/dashboard/subscription");
                return;
              }
              setCreating(true);
              const valid = await pageForm.trigger();
              if (!valid) {
                setCreating(false);
                return;
              }
              const data = pageForm.getValues();
              const { success, slug, message } = await createBioPage({
                title: data.title,
                slug: data.slug,
              });
              if (success) {
                router.push(`/dashboard/pages/${slug}`);
              } else {
                switch (message) {
                  case "duplicate":
                    pageForm.setError("slug", {
                      message:
                        "This page URL is already taken. Please choose another one.",
                    });
                    break;
                  case "plan-restricted":
                    pageForm.setError("root", {
                      message:
                        "Your current plan does not allow creating a new page.",
                    });
                    break;
                  case "no-user":
                    pageForm.setError("root", {
                      message: "User not found. Please log in again.",
                    });
                    break;
                  case "server-error":
                    pageForm.setError("root", {
                      message: "Server error. Please try again later.",
                    });
                    break;
                  default:
                    pageForm.setError("root", {
                      message: "Unknown error. Please try again.",
                    });
                }
                setCreating(false);
              }
            }}
            disabled={creating}
            variant={"default"}
          >
            {session.user?.plan.subscription != "pro" ? (
              <>
                <LockIcon /> Upgrade to Pro
              </>
            ) : creating ? (
              <>
                <Loader2 className="animate-spin" /> Creating...
              </>
            ) : (
              <>Create your page</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
