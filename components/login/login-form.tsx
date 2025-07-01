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
  authenticate,
  githubAuthenticate,
  googleAuthenticate,
} from "@/app/actions/authenticate";
import { useState } from "react";
import { Eye, EyeClosed, Loader2 } from "lucide-react";
import { Separator } from "../ui/separator";
import { Link } from "@/i18n/navigation";

const loginFormSchema = z.object({
  email: z.string().min(1, {
    message: "Please fill out your email or username",
  }),
  password: z.string().min(1, {
    message: "Please fill out your password.",
  }),
});

export const LoginForm = () => {
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
    setLoading(1);
    const response = await authenticate(values);
    if (response == true) {
    } else {
      const error = response;
      if (error?.name == "CredentialsSignin") {
        if (error.message.split(".")[0] === "Missing email or password") {
          form.setError("root", {
            type: "manual",
            message: "Email or password is missing.",
          });
        }
        if (
          error.message.split(".")[0] ===
          "No account found with those credentials"
        ) {
          form.setError("email", {
            type: "manual",
            message: "No account found with that email or username.",
          });
        }

        if (error.message.split(".")[0] === "Invalid password") {
          form.setError("password", {
            type: "manual",
            message: "Incorrect password.",
          });
        }
        setLoading(0);
      } else {
        console.error("Unexpected error:", error);
        form.setError("root", {
          type: "manual",
          message: "Something went wrong. Please try again later.",
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
                {!showPassword ? <EyeClosed /> : <Eye />}
              </Button>
            </FormItem>
          )}
        />
        <Button disabled={loading > 0} className="w-full" type="submit">
          {loading == 1 ? "Signing you in..." : "Login"}
          {loading == 1 && <Loader2 className="animate-spin" />}
        </Button>
        <Link
          className="text-primary underline text-sm -mt-3 w-fit ml-auto"
          href={"/register"}
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
              if (response == true) {
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
              if (response == true) {
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
          <p>Don't have an account? </p>
          <Link className="text-primary underline" href={"/register"}>
            Register now.
          </Link>
        </div>
      </form>
    </Form>
  );
};
