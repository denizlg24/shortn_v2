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
import { Link, useRouter } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { authClient } from "@/lib/authClient";
import { BASEURL } from "@/lib/utils";
import Cookies from "js-cookie";
const registerFormSchema = z
  .object({
    fullName: z
      .string()
      .min(1, "Please provide a display name")
      .max(64, "Can't be longer than 64 characters"),
    email: z.string().email("Must be a valid email address").min(1, {
      message: "Please fill out your email or username",
    }),
    nickname: z
      .string()
      .min(1, "Please provide a username")
      .max(32, "Username must be at most 32 characters")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Only letters, numbers, and underscores are allowed",
      ),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .regex(/[A-Z]/, "Must include one uppercase letter")
      .regex(/[0-9]/, "Must include one number")
      .regex(/[^a-zA-Z0-9]/, "Must include one special character"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const RegisterForm = () => {
  const locale = useLocale();
  const [loading, setLoading] = useState(0);
  const [showPassword, toggleShowPassword] = useState(false);
  const [confirmShowPassword, toggleConfirmShowPassword] = useState(false);
  const router = useRouter();

  const form = useForm<z.infer<typeof registerFormSchema>>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      fullName: "",
      nickname: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: z.infer<typeof registerFormSchema>) {
    setLoading(1);
    await authClient.signUp.email(
      {
        email: values.email,
        password: values.password,
        username: values.nickname,
        name: values.fullName,
        phone_number: "",
        callbackURL: `${BASEURL}/${locale}/login`,
      },
      {
        onSuccess() {
          Cookies.set("flow_signup_success", "true", { expires: 30 / 288 }); // 30 day / 288 = 30 mins
          Cookies.set("flow_signup_email", values.email, { expires: 30 / 288 });
          router.push("/verify/sent");
        },
        onError(context) {
          form.setError("root", {
            type: "manual",
            message:
              context.error.message ||
              "There was a problem creating your account.",
          });
        },
      },
    );
    setLoading(0);
  }

  return (
    <>
      <div className="flex flex-col gap-0 w-full items-center text-center">
        <h1 className="lg:text-3xl md:text-2xl sm:text-xl text-lg font-bold">
          Create your account!
        </h1>
        <h2 className="lg:text-lg md:text-base text-sm">
          Start shortening your links now.
        </h2>
      </div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4 w-full"
        >
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Full name<span className="text-destructive text-xs">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Email<span className="text-destructive text-xs">*</span>
                </FormLabel>
                <FormControl>
                  <Input autoComplete="username" placeholder="" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nickname"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Username
                  <span className="text-muted-foreground text-xs -ml-1">
                    (alternative log in)
                  </span>
                  <span className="text-destructive text-xs">*</span>
                </FormLabel>
                <FormControl>
                  <Input autoComplete="nickname" placeholder="" {...field} />
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
                <FormLabel>
                  Password<span className="text-destructive text-xs">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder=""
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
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem className="relative">
                <FormLabel>
                  Repeat Password
                  <span className="text-destructive text-xs">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type={confirmShowPassword ? "text" : "password"}
                    placeholder=""
                    {...field}
                  />
                </FormControl>
                <FormMessage />
                <Button
                  type="button"
                  onClick={() => {
                    toggleConfirmShowPassword((prev) => !prev);
                  }}
                  variant="link"
                  className="absolute right-0 top-6"
                >
                  {!confirmShowPassword ? <EyeOff /> : <Eye />}
                </Button>
              </FormItem>
            )}
          />
          <Button disabled={loading > 0} className="w-full" type="submit">
            {loading == 1 ? "Creating account..." : "Create account"}
            {loading == 1 && <Loader2 className="animate-spin" />}
          </Button>
          <FormRootError />
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
                          message:
                            "Please verify your email address before logging in",
                        });
                        await authClient.signOut();
                        return;
                      }
                      setLoading(0);
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
                          message:
                            "Please verify your email address before logging in",
                        });
                        await authClient.signOut();
                        return;
                      }
                      setLoading(0);
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
            <p>Already have an account? </p>
            <Link className="text-primary underline" href={"/login"}>
              Login now.
            </Link>
          </div>
        </form>
      </Form>
    </>
  );
};
