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
import {
  authenticate,
  githubAuthenticate,
  googleAuthenticate,
} from "@/app/actions/authenticate";
import { useState } from "react";
import { Eye, EyeOff, Loader2, XCircle } from "lucide-react";
import { Separator } from "../ui/separator";
import { Link, useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { sendVerificationEmail } from "@/app/actions/userActions";
import { useLocale } from "next-intl";
import { AuthError } from "next-auth";

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
  const router = useRouter();
  async function onSubmit(values: z.infer<typeof loginFormSchema>) {
    setLoading(1);
    const response = await authenticate(values);
    if (response == true) {
      router.push("/dashboard");
      return;
    } else {
      const error = response;
      if (error?.name == "CredentialsSignin") {
        const message = error?.message?.split(".")[0];
        if (!message) {
          form.setError("root", {
            type: "manual",
            message: "Unknown authentication error.",
          });
          setLoading(0);
        }
        switch (message) {
          case "email-password-missing":
            form.setError("email", {
              type: "manual",
              message: "Email or password is missing.",
            });
            break;
          case "no-account":
            form.setError("email", {
              type: "manual",
              message: "No account found with that email or username.",
            });
            break;
          case "wrong-password":
            form.setError("password", {
              type: "manual",
              message: "Incorrect password.",
            });
            break;
          case "not-verified":
            const notVerifiedToast = toast(
              <div className="w-full flex flex-col gap-2">
                <div className="flex flex-row items-center justify-start gap-2">
                  <XCircle className="text-destructive" />
                  <p className="text-lg font-bold">Account not verified.</p>
                </div>
                <div className="w-full">
                  <p className="text-sm">
                    You still haven't verified your email. Please check your
                    inbox and{" "}
                    <Link
                      onClick={async () => {
                        await sendVerificationEmail(values.email, locale);
                        toast.dismiss(notVerifiedToast);
                      }}
                      href={`/verification-sent/${values.email}`}
                      className="underline text-primary font-semibold"
                    >
                      verify your account.
                    </Link>
                  </p>
                </div>
              </div>
            );
            break;
          default:
            form.setError("root", {
              type: "manual",
              message: "Invalid credentials.",
            });
        }
        setLoading(0);
      } else {
        form.setError("root", {
          type: "manual",
          message: "Unknown authentication error.",
        });
        setLoading(0);
      }
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
              setLoading(2);
              const response = await githubAuthenticate();
              if (response.success && response.url) {
                router.push(response.url);
                return;
              } else {
                const error = response;
                if (error?.name == "CredentialsSignin") {
                  form.setError("email", {
                    type: "manual",
                    message:
                      "Github account doesn't have a shortn account linked.",
                  });
                  setLoading(0);
                } else {
                  form.setError("root", {
                    type: "manual",
                    message: "Unknown authentication error.",
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
                return;
              } else {
                const error = response;
                if (error?.name == "CredentialsSignin") {
                  form.setError("email", {
                    type: "manual",
                    message:
                      "Google account doesn't have a shortn account linked.",
                  });
                  setLoading(0);
                } else {
                  form.setError("root", {
                    type: "manual",
                    message: "Unknown authentication error.",
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
          <p>Don't have an account? </p>
          <Link className="text-primary underline" href={"/register"}>
            Register now.
          </Link>
        </div>
      </form>
    </Form>
  );
};
