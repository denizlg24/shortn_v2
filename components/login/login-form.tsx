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
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Separator } from "../ui/separator";
import { Link } from "@/i18n/navigation";
import { toast } from "sonner";
import { useLocale } from "next-intl";
import { authClient } from "@/lib/authClient";
import { BASEURL } from "@/lib/utils";

const loginFormSchema = z.object({
  email: z.string().min(1, {
    message: "Please fill out your email or username",
  }),
  password: z.string().min(1, {
    message: "Please fill out your password.",
  }),
});

export const LoginForm = () => {
  const locale = useLocale();
  const [loading, setLoading] = useState(0);
  const form = useForm<z.infer<typeof loginFormSchema>>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const [showPassword, toggleShowPassword] = useState(false);
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
                message: "Unable to retrieve user session",
              });
              await authClient.signOut();
              return;
            }

            const user = session.data.user;

            if (!user.emailVerified) {
              setLoading(0);
              form.setError("root", {
                type: "manual",
                message: "Please verify your email address before logging in",
              });
              await authClient.signOut();
              return;
            }
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
                  Please verify your email address before logging in.{" "}
                  <Button
                    onClick={async () => {
                      await authClient.sendVerificationEmail(
                        {
                          email: identifier,
                          callbackURL: `${BASEURL}/${locale}/dashboard`,
                        },
                        {
                          onSuccess: () => {
                            toast.success(
                              "Verification email resent successfully.",
                            );
                          },
                        },
                      );
                      toast.dismiss("not-verified-toast");
                    }}
                    variant={"link"}
                    className="text-xs p-0! h-fit! w-fit!"
                  >
                    Resend verification email.
                  </Button>
                </p>,
                { id: "not-verified-toast" },
              );
              setLoading(0);
              return;
            }
            setLoading(0);
            form.setError("root", {
              type: "manual",
              message: ctx.error.message,
            });
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
                message: "Unable to retrieve user session",
              });
              await authClient.signOut();
              return;
            }

            const user = session.data.user;

            if (!user.emailVerified) {
              setLoading(0);
              form.setError("root", {
                type: "manual",
                message: "Please verify your email address before logging in",
              });
              await authClient.signOut();
              return;
            }
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
                  Your account isn't verified. Please login with your email to
                  get a verification email.
                </p>,
                { id: "not-verified-toast" },
              );
              setLoading(0);
              return;
            }
            setLoading(0);
            form.setError("root", {
              type: "manual",
              message: ctx.error.message,
            });
          },
        },
      );
    }
  }

  return (
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
              <FormLabel>Email or Username</FormLabel>
              <FormControl>
                <Input placeholder="Your email or username" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem className="relative">
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="*******"
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
          {loading == 1 ? "Signing you in..." : "Login"}
          {loading == 1 && <Loader2 className="animate-spin" />}
        </Button>
        <FormRootError />
        <Link
          className="text-primary underline text-sm -mt-3 w-fit ml-auto"
          href={"/recover"}
        >
          Forgot your password?
        </Link>
        <div className="w-full relative flex flex-row justify-center">
          <Separator className=""></Separator>
          <p className="text-xs text-center text-muted-foreground absolute mx-auto -top-2 bg-background px-2">
            OR
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
            {loading == 2 ? "Signing you in..." : "Continue with GitHub"}
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
            {loading == 3 ? "Signing you in..." : " Continue with Google"}
            {loading == 3 && <Loader2 className="animate-spin" />}
          </Button>
        </div>
        <div className="flex flex-row items-center gap-1 text-sm justify-center w-full">
          <p>Don&apos;t have an account? </p>
          <Link className="text-primary underline" href={"/register"}>
            Register now.
          </Link>
        </div>
      </form>
    </Form>
  );
};
