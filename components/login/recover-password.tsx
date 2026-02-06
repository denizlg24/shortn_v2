"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { BASEURL } from "@/lib/utils";
import { authClient } from "@/lib/authClient";
const resetFormSchema = z.object({
  email: z.string().email("Must be a valid email address").min(1, {
    message: "Please fill out your email or username",
  }),
});
export const RecoverPassword = () => {
  const locale = useLocale();
  const t = useTranslations("recover");
  const router = useRouter();
  const [loading, setLoading] = useState(0);

  const form = useForm<z.infer<typeof resetFormSchema>>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof resetFormSchema>) {
    setLoading(1);
    const { error } = await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: `${BASEURL}/${locale}/reset`,
    });
    if (error) {
      toast.error(error.message || t("error-sending"));
      form.reset();
      setLoading(0);
    } else {
      toast.success(t("recovery-sent"));
      router.push(`/login`);
      setLoading(0);
    }
  }
  return (
    <>
      <div className="flex flex-col gap-0 w-full items-center text-center">
        <h1 className="lg:text-3xl md:text-2xl sm:text-xl text-lg font-bold">
          {t("title")}
        </h1>
        <h2 className="lg:text-lg md:text-base text-sm">{t("subtitle")}</h2>
      </div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4 w-full"
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("your-email")}
                  <span className="text-destructive text-xs">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button disabled={loading > 0} className="w-full" type="submit">
            {loading == 1 ? t("sending") : t("send-me-link")}
            {loading == 1 && <Loader2 className="animate-spin" />}
          </Button>
        </form>
      </Form>
    </>
  );
};
