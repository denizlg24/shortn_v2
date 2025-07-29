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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  githubAuthenticate,
  googleAuthenticate,
} from "@/app/actions/authenticate";
import { useState } from "react";
import { Eye, EyeClosed, Loader2 } from "lucide-react";
import { Separator } from "../ui/separator";
import { Link, useRouter } from "@/i18n/navigation";
import { createAccount } from "@/app/actions/userActions";
import { useLocale } from "next-intl";

const registerFormSchema = z
  .object({
    fullName: z
      .string()
      .min(1, "Please provide a display name")
      .max(64, "Can't be longer than 64 characters"),
    email: z.string().email("Must be a valid email address").min(1, {
      message: "Please fill out your email or username",
    }),
    username: z
      .string()
      .min(1, "Please provide a username")
      .max(32, "Username must be at most 32 characters")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Only letters, numbers, and underscores are allowed"
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
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: z.infer<typeof registerFormSchema>) {
    setLoading(1);
    const { success, error } = await createAccount({
      displayName: values.fullName,
      username: values.username,
      email: values.email,
      password: values.password,
      locale,
    });
    if (success) {
      router.push(`/verification-sent/${values.email}`);
      setLoading(0);
    } else {
      if (error) {
        if (error == "email-taken") {
          form.setError("email", {
            type: "manual",
            message: "That email is already in use.",
          });
        }
        if (error == "username-taken") {
          form.setError("username", {
            type: "manual",
            message: "That username is already in use.",
          });
        }
        if (error == "verification-token") {
          form.setError("root", {
            type: "manual",
            message: "There was a problem sending the verification email.",
          });
        }
        if (error == "server-error") {
          form.setError("root", {
            type: "manual",
            message: "There was an unexpected problem creating your account.",
          });
        }
      }
      setLoading(0);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-0 w-full">
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
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Username<span className="text-destructive text-xs">*</span>
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
                  <Input placeholder="" {...field} />
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
                  {!showPassword ? <EyeClosed /> : <Eye />}
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
                  {!confirmShowPassword ? <EyeClosed /> : <Eye />}
                </Button>
              </FormItem>
            )}
          />
          <Button disabled={loading > 0} className="w-full" type="submit">
            {loading == 1 ? "Creating account..." : "Create account"}
            {loading == 1 && <Loader2 className="animate-spin" />}
          </Button>
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
                setLoading(2);
                const response = await githubAuthenticate();
                if (response.success && response.url) {
                  router.push(response.url);
                } else {
                  const error = response;
                  if (error?.name == "CredentialsSignin") {
                    form.setError("root", {
                      type: "manual",
                      message:
                        "Github account doesn't have a shortn account linked.",
                    });
                    setLoading(0);
                  }
                }
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
                setLoading(3);
                const response = await googleAuthenticate();
                if (response.success && response.url) {
                  router.push(response.url);
                } else {
                  const error = response;
                  if (error?.name == "CredentialsSignin") {
                    form.setError("root", {
                      type: "manual",
                      message:
                        "Google account doesn't have a shortn account linked.",
                    });
                    setLoading(0);
                  }
                }
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
