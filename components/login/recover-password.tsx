"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import z from "zod";
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
import { sendRecoveryEmail } from "@/app/actions/userActions";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
const resetFormSchema = z.object({
  email: z.string().email("Must be a valid email address").min(1, {
    message: "Please fill out your email or username",
  }),
});
export const RecoverPassword = () => {
  const locale = useLocale();
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
    const { success, message } = await sendRecoveryEmail(values.email, locale);
    if (success) {
      router.push(`/recover/sent/${values.email}`);
    } else if (message) {
      if (message == "no-user") {
        form.setError("email", {
          type: "manual",
          message: "There is no account linked to this email address.",
        });
      } else {
        toast.error("There was a problem sending your email.");
        form.reset();
      }
      setLoading(0);
    }
  }
  return (
    <>
      <div className="flex flex-col gap-0 w-full">
        <h1 className="lg:text-3xl md:text-2xl sm:text-xl text-lg font-bold">
          Forgot your password?
        </h1>
        <h2 className="lg:text-lg md:text-base text-sm">
          No problem, we'll send you a link to recover it easily through your
          email.
        </h2>
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
                  Your email<span className="text-destructive text-xs">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button disabled={loading > 0} className="w-full" type="submit">
            {loading == 1 ? "Sending..." : "Send me a link"}
            {loading == 1 && <Loader2 className="animate-spin" />}
          </Button>
        </form>
      </Form>
    </>
  );
};
