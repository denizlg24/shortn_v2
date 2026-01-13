"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { GithubOriginal, GoogleOriginal } from "devicons-react";
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
import { useState } from "react";
import { Eye, EyeOff, Loader2, AtSign, Mail } from "lucide-react";
import { Separator } from "../ui/separator";
import { Link, useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { authClient } from "@/lib/authClient";
import { BASEURL } from "@/lib/utils";

const mapBetterAuthLoginError = (
  error: { code?: string; message?: string; status?: number },
  form: ReturnType<typeof useForm<z.infer<typeof loginFormSchema>>>,
  isUsername: boolean,
  t: ReturnType<typeof useTranslations<"login">>,
) => {
  const code = error.code?.toUpperCase();

  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
    case "INVALID_CREDENTIALS":
    case "INVALID_PASSWORD":
      if (isUsername) {
        form.setError("password", {
          type: "manual",
          message: t("errors.invalid-username-or-password"),
        });
      } else {
        form.setError("password", {
          type: "manual",
          message: t("errors.invalid-email-or-password"),
        });
      }
      break;
    case "USER_NOT_FOUND":
    case "USER_DOES_NOT_EXIST":
      form.setError("email", {
        type: "manual",
        message: isUsername
          ? t("errors.no-account-username")
          : t("errors.no-account-email"),
      });
      break;
    case "INVALID_EMAIL":
      form.setError("email", {
        type: "manual",
        message: t("errors.invalid-email"),
      });
      break;
    case "ACCOUNT_NOT_FOUND":
      form.setError("email", {
        type: "manual",
        message: t("errors.account-not-found"),
      });
      break;
    case "TOO_MANY_REQUESTS":
    case "RATE_LIMIT_EXCEEDED":
      form.setError("root", {
        type: "manual",
        message: t("errors.too-many-requests"),
      });
      break;
    case "SOCIAL_ACCOUNT_ALREADY_LINKED":
      form.setError("root", {
        type: "manual",
        message: t("errors.social-account-linked"),
      });
      break;
    default:
      form.setError("root", {
        type: "manual",
        message: error.message || t("errors.unable-to-sign-in"),
      });
  }
};

const loginFormSchema = z.object({
  email: z.string().min(1, {
    message: "Please enter your email or username",
  }),
  password: z.string().min(1, {
    message: "Please enter your password",
  }),
});

export const LoginForm = () => {
  const locale = useLocale();
  const t = useTranslations("login");
  const [loading, setLoading] = useState(0);
  const router = useRouter();
  const form = useForm<z.infer<typeof loginFormSchema>>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const [showPassword, toggleShowPassword] = useState(false);

  const watchedEmail = form.watch("email");
  const isEmail = watchedEmail.includes("@");

  async function onSubmit(values: z.infer<typeof loginFormSchema>) {
    const { email: identifier, password } = values;
    if (identifier.includes("@")) {
      await authClient.signIn.email(
        {
          email: identifier,
          password: password,
          callbackURL: `${BASEURL}/${locale}/dashboard`,
          rememberMe: false,
        },
        {
          onRequest: () => {
            setLoading(1);
          },
          onSuccess: async () => {
            const session = await authClient.getSession();

            if (!session.data?.user || !session.data?.session) {
              setLoading(0);
              form.setError("root", {
                type: "manual",
                message: t("errors.unable-to-retrieve-session"),
              });
              await authClient.signOut();
              return;
            }

            const user = session.data.user;

            if (!user.emailVerified) {
              setLoading(0);
              form.setError("root", {
                type: "manual",
                message: t("errors.verify-email-before-login"),
              });
              await authClient.signOut();
              return;
            }
            router.push("/dashboard");
            setLoading(0);
          },
          onError: (ctx) => {
            console.log(ctx);
            if (
              ctx.error.code === "EMAIL_NOT_VERIFIED" ||
              ctx.error.status === 403
            ) {
              toast.error(
                <p className="text-xs flex flex-row flex-wrap gap-1">
                  {t("errors.verify-email-toast")}{" "}
                  <Button
                    onClick={async () => {
                      await authClient.sendVerificationEmail(
                        {
                          email: identifier,
                          callbackURL: `${BASEURL}/${locale}/dashboard`,
                        },
                        {
                          onSuccess: () => {
                            toast.success(t("errors.verification-resent"));
                          },
                        },
                      );
                      toast.dismiss("not-verified-toast");
                    }}
                    variant={"link"}
                    className="text-xs p-0! h-fit! w-fit!"
                  >
                    {t("errors.resend-verification")}
                  </Button>
                </p>,
                { id: "not-verified-toast" },
              );
              setLoading(0);
              return;
            }
            setLoading(0);
            mapBetterAuthLoginError(ctx.error, form, false, t);
          },
        },
      );
    } else {
      await authClient.signIn.username(
        {
          username: identifier,
          password: password,
          callbackURL: `${BASEURL}/${locale}/dashboard`,
          rememberMe: false,
        },
        {
          onRequest: () => {
            setLoading(1);
          },
          onSuccess: async () => {
            const session = await authClient.getSession();

            if (!session.data?.user || !session.data?.session) {
              setLoading(0);
              form.setError("root", {
                type: "manual",
                message: t("errors.unable-to-retrieve-session"),
              });
              await authClient.signOut();
              return;
            }

            const user = session.data.user;

            if (!user.emailVerified) {
              setLoading(0);
              form.setError("root", {
                type: "manual",
                message: t("errors.verify-email-before-login"),
              });
              await authClient.signOut();
              return;
            }
            router.push("/dashboard");
            setLoading(0);
          },
          onError: (ctx) => {
            console.log(ctx);
            if (
              ctx.error.code === "EMAIL_NOT_VERIFIED" ||
              ctx.error.status === 403
            ) {
              toast.error(
                <p className="text-xs flex flex-row flex-wrap gap-1">
                  {t("errors.not-verified-username")}
                </p>,
                { id: "not-verified-toast" },
              );
              setLoading(0);
              return;
            }
            setLoading(0);
            mapBetterAuthLoginError(ctx.error, form, true, t);
          },
        },
      );
    }
  }

  return (
    <>
      <div className="flex flex-col gap-0 w-full text-center items-center">
        <h1 className="lg:text-3xl md:text-2xl sm:text-xl text-lg font-bold">
          {t("welcome-back")}
        </h1>
        <h2 className="lg:text-lg md:text-base text-sm">
          {t("login-subtitle")}
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
                <FormLabel>{t("email-or-username")}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors">
                      {isEmail ? (
                        <Mail className="h-4 w-4" />
                      ) : (
                        <AtSign className="h-4 w-4" />
                      )}
                    </span>
                    <Input
                      placeholder={
                        isEmail
                          ? t("email-placeholder")
                          : t("username-placeholder")
                      }
                      className="pl-9"
                      {...field}
                    />
                  </div>
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  {isEmail
                    ? t("signing-in-with-email")
                    : watchedEmail.length > 0
                      ? t("signing-in-with-username")
                      : t("enter-email-or-username")}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="relative">
                <FormLabel>{t("password")}</FormLabel>
                <FormControl>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="•••••••"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
                <Button
                  type="button"
                  onClick={() => {
                    toggleShowPassword((prev) => !prev);
                  }}
                  variant="link"
                  className="absolute right-0 top-6"
                >
                  {!showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </FormItem>
            )}
          />
          <Button disabled={loading > 0} className="w-full" type="submit">
            {loading == 1 ? t("signing-you-in") : t("login-button")}
            {loading == 1 && <Loader2 className="animate-spin" />}
          </Button>
          <FormRootError />
          <Link
            className="text-primary underline text-sm -mt-3 w-fit ml-auto"
            href={"/recover"}
          >
            {t("forgot-password")}
          </Link>
          <div className="w-full relative flex flex-row justify-center">
            <Separator className=""></Separator>
            <p className="text-xs text-center text-muted-foreground absolute mx-auto -top-2 bg-background px-2">
              {t("or")}
            </p>
          </div>

          <div className="w-full flex flex-col gap-2">
            <Button
              disabled={loading > 0}
              variant="outline"
              type="button"
              className="w-full"
              onClick={async () => {
                await authClient.signIn.social(
                  { provider: "github" },
                  {
                    onRequest: () => {
                      setLoading(2);
                    },
                    onError: (ctx) => {
                      console.log(ctx);
                      setLoading(0);
                      form.setError("root", {
                        type: "manual",
                        message: ctx.error.message,
                      });
                    },
                  },
                );
              }}
            >
              <GithubOriginal />
              {loading == 2 ? t("signing-you-in") : t("continue-with-github")}
              {loading == 2 && <Loader2 className="animate-spin" />}
            </Button>
            <Button
              disabled={loading > 0}
              variant="outline"
              type="button"
              className="w-full"
              onClick={async () => {
                await authClient.signIn.social(
                  { provider: "google" },
                  {
                    onRequest: () => {
                      setLoading(3);
                    },
                    onError: (ctx) => {
                      console.log(ctx);
                      setLoading(0);
                      form.setError("root", {
                        type: "manual",
                        message: ctx.error.message,
                      });
                    },
                  },
                );
              }}
            >
              <GoogleOriginal />
              {loading == 3 ? t("signing-you-in") : t("continue-with-google")}
              {loading == 3 && <Loader2 className="animate-spin" />}
            </Button>
          </div>
          <div className="flex flex-row items-center gap-1 text-sm justify-center w-full">
            <p>{t("no-account")} </p>
            <Link className="text-primary underline" href={"/register"}>
              {t("register-now")}
            </Link>
          </div>
        </form>
      </Form>
    </>
  );
};
