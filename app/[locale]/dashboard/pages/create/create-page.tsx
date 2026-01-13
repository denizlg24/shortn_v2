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
import { BASEURL } from "@/lib/utils";
import { IUrl } from "@/models/url/UrlV3";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LockIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { usePlan } from "@/hooks/use-plan";
import { useTranslations } from "next-intl";

export const CreatePage = ({ url }: { url?: IUrl }) => {
  const t = useTranslations("create-page");
  const { plan } = usePlan();
  const [creating, setCreating] = useState(false);

  const pageFormSchema = z.object({
    title: z.string().max(100, t("validation.title-max")).optional(),
    slug: z
      .string()
      .min(3, t("validation.slug-min"))
      .max(52, t("validation.slug-max"))
      .regex(/^[a-zA-Z0-9_-]+$/, t("validation.slug-format")),
  });

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
        {t("title")}
      </h1>
      <div className="rounded bg-background lg:p-6 md:p-4 p-3 w-full flex flex-col gap-4">
        <Form {...pageForm}>
          <form className="w-full flex flex-col gap-4">
            <FormField
              control={pageForm.control}
              name="title"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>{t("title-label")}</FormLabel>
                  <FormControl>
                    <Input className="w-full" placeholder="" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <h2 className="font-semibold lg:text-xl sm:text-lg text-base">
              {t("your-page")}
            </h2>
            <div className="w-full flex flex-row items-end justify-center gap-2 -mt-2">
              <div className="w-full grow flex flex-col items-start gap-2">
                <p className="sm:text-sm text-xs font-semibold">
                  {t("domain")}
                </p>
                <Input disabled className="w-full" readOnly value={BASEURL} />
              </div>
              <div className="h-9 text-sm flex items-center justify-center">
                <p className="w-max">/b/</p>
              </div>
              <div className="w-full grow flex flex-col items-start gap-2">
                <p className="sm:text-sm text-xs font-semibold">
                  {t("link-in-bio-code")}
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
                {t("page-link-preview")}
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
            {t("cancel")}
          </Button>
          <Button
            onClick={async () => {
              if (plan != "pro") {
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
                urlCode: url?.urlCode,
              });
              if (success) {
                router.push(`/dashboard/pages/${slug}/customize`);
              } else {
                switch (message) {
                  case "duplicate":
                    pageForm.setError("slug", {
                      message: t("errors.duplicate"),
                    });
                    break;
                  case "plan-restricted":
                    pageForm.setError("root", {
                      message: t("errors.plan-restricted"),
                    });
                    break;
                  case "no-user":
                    pageForm.setError("root", {
                      message: t("errors.no-user"),
                    });
                    break;
                  case "server-error":
                    pageForm.setError("root", {
                      message: t("errors.server-error"),
                    });
                    break;
                  default:
                    pageForm.setError("root", {
                      message: t("errors.unknown"),
                    });
                }
                setCreating(false);
              }
            }}
            disabled={creating}
            variant={"default"}
          >
            {plan != "pro" ? (
              <>
                <LockIcon /> {t("upgrade-to-pro")}
              </>
            ) : creating ? (
              <>
                <Loader2 className="animate-spin" /> {t("creating")}
              </>
            ) : (
              <>{t("create-your-page")}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
