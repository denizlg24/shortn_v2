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
import { Eye, EyeOff, Loader2, Check, X } from "lucide-react";
import { Separator } from "../ui/separator";
import { Link, useRouter } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { authClient } from "@/lib/authClient";
import { BASEURL } from "@/lib/utils";
import Cookies from "js-cookie";
import { cn } from "@/lib/utils";

const PasswordRequirement = ({
  met,
  label,
}: {
  met: boolean;
  label: string;
}) => (
  <div
    className={cn(
      "flex items-center gap-1.5 text-xs transition-colors",
      met ? "text-green-600 dark:text-green-500" : "text-muted-foreground",
    )}
  >
    {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
    <span>{label}</span>
  </div>
);

const registerFormSchema = z
  .object({
    fullName: z
      .string()
      .min(1, "Please provide a display name")
      .max(64, "Can't be longer than 64 characters"),
    email: z.string().email("Must be a valid email address").min(1, {
      message: "Please fill out your email",
    }),
    nickname: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(32, "Username must be at most 32 characters")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Only letters, numbers, and underscores are allowed",
      )
      .refine((val) => !/^\d+$/.test(val), "Username cannot be only numbers"),
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

const mapBetterAuthError = (
  error: { code?: string; message?: string; status?: number },
  form: ReturnType<typeof useForm<z.infer<typeof registerFormSchema>>>,
) => {
  const code = error.code?.toUpperCase() || "";
  const message = error.message?.toLowerCase() || "";

  switch (code) {
    case "USER_ALREADY_EXISTS":
    case "EMAIL_ALREADY_EXISTS":
    case "USER_EXISTS":
      form.setError("email", {
        type: "manual",
        message: "An account with this email already exists",
      });
      return;
    case "USERNAME_ALREADY_EXISTS":
    case "USERNAME_IS_ALREADY_TAKEN":
    case "USERNAME_TAKEN":
    case "USERNAME_EXISTS":
      form.setError("nickname", {
        type: "manual",
        message: "This username is already taken",
      });
      return;
    case "INVALID_EMAIL":
      form.setError("email", {
        type: "manual",
        message: "Please enter a valid email address",
      });
      return;
    case "PASSWORD_TOO_SHORT":
      form.setError("password", {
        type: "manual",
        message: "Password must be at least 6 characters",
      });
      return;
    case "PASSWORD_TOO_LONG":
      form.setError("password", {
        type: "manual",
        message: "Password is too long",
      });
      return;
    case "INVALID_PASSWORD":
      form.setError("password", {
        type: "manual",
        message: "Password doesn't meet requirements",
      });
      return;
    case "RATE_LIMIT_EXCEEDED":
    case "TOO_MANY_REQUESTS":
      form.setError("root", {
        type: "manual",
        message: "Too many attempts. Please wait a moment and try again.",
      });
      return;
  }

  if (
    message.includes("email") &&
    (message.includes("already") ||
      message.includes("exists") ||
      message.includes("taken") ||
      message.includes("use"))
  ) {
    form.setError("email", {
      type: "manual",
      message: "An account with this email already exists",
    });
    return;
  }

  if (
    message.includes("username") &&
    (message.includes("already") ||
      message.includes("exists") ||
      message.includes("taken") ||
      message.includes("use"))
  ) {
    form.setError("nickname", {
      type: "manual",
      message: "This username is already taken",
    });
    return;
  }

  if (message.includes("password")) {
    form.setError("password", {
      type: "manual",
      message: error.message || "Invalid password",
    });
    return;
  }

  if (message.includes("email") && message.includes("invalid")) {
    form.setError("email", {
      type: "manual",
      message: "Please enter a valid email address",
    });
    return;
  }

  form.setError("root", {
    type: "manual",
    message: error.message || "There was a problem creating your account.",
  });
};

export const RegisterForm = () => {
  const locale = useLocale();
  const [loading, setLoading] = useState(0);
  const [showPassword, toggleShowPassword] = useState(false);
  const [confirmShowPassword, toggleConfirmShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const router = useRouter();

  const form = useForm<z.infer<typeof registerFormSchema>>({
    resolver: zodResolver(registerFormSchema),
    mode: "onChange",
    defaultValues: {
      fullName: "",
      nickname: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const watchedPassword = form.watch("password");

  const passwordRequirements = {
    minLength: watchedPassword.length >= 6,
    hasUppercase: /[A-Z]/.test(watchedPassword),
    hasNumber: /[0-9]/.test(watchedPassword),
    hasSpecial: /[^a-zA-Z0-9]/.test(watchedPassword),
  };

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
          Cookies.set("flow_signup_success", "true", { expires: 30 / 288 });
          Cookies.set("flow_signup_email", values.email, { expires: 30 / 288 });
          router.push("/verify/sent");
        },
        onError(context) {
          mapBetterAuthError(context.error, form);
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
                <FormLabel className="flex items-center gap-1">
                  Username
                  <span className="text-destructive text-xs">*</span>
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      @
                    </span>
                    <Input
                      autoComplete="nickname"
                      placeholder="your_username"
                      className="pl-7"
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value
                          .toLowerCase()
                          .replace(/\s/g, "_");
                        field.onChange(value);
                      }}
                    />
                  </div>
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  You can use this instead of email to sign in
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
                <FormLabel>
                  Password<span className="text-destructive text-xs">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder=""
                    {...field}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                  />
                </FormControl>
                {/* Password requirements display */}
                {(passwordFocused || watchedPassword.length > 0) && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
                    <PasswordRequirement
                      met={passwordRequirements.minLength}
                      label="At least 6 characters"
                    />
                    <PasswordRequirement
                      met={passwordRequirements.hasUppercase}
                      label="One uppercase letter"
                    />
                    <PasswordRequirement
                      met={passwordRequirements.hasNumber}
                      label="One number"
                    />
                    <PasswordRequirement
                      met={passwordRequirements.hasSpecial}
                      label="One special character"
                    />
                  </div>
                )}
                {!passwordFocused &&
                  watchedPassword.length === 0 &&
                  form.formState.errors.password && <FormMessage />}
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
