"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { GithubOriginal, GoogleOriginal } from "devicons-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
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
import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeClosed, Loader2, Loader2Icon } from "lucide-react";
import { Separator } from "../ui/separator";
import { Link, useRouter } from "@/i18n/navigation";
import { createAccount } from "@/app/actions/createAccount";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../ui/input-otp";
import { verifyEmail } from "@/app/actions/verifyEmail";
import { sendVerificationEmail } from "@/app/actions/sendVerificationEmail";
import { useSearchParams } from "next/navigation";
import { VerificationSuccess } from "./verification-success";
import { VerificationAlready } from "./verification-already";
import { VerificationError } from "./verication-error";

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

const OTPFormSchema = z.object({
  pin: z.string().min(6, {
    message: "The token should be 6 characters.",
  }),
});

export const RegisterForm = () => {
  const [loading, setLoading] = useState(0);
  const [verificationEmail, setVerificationEmail] = useState<
    string | undefined
  >(undefined);
  const [verified, setVerified] = useState(0);
  const [showPassword, toggleShowPassword] = useState(false);
  const [confirmShowPassword, toggleConfirmShowPassword] = useState(false);
  const [paramsLoading, setParamsLoading] = useState(true);

  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const verifiedParam = params.get("verified");
    const emailParam = params.get("email");

    if (verifiedParam === "true") {
      setVerified(1);
    } else if (verifiedParam === "expired") {
      setVerified(2);
    } else if (verifiedParam === "already") {
      setVerified(3);
    } else if (!verifiedParam) {
      setVerified(0);
    }
    if (emailParam) {
      setVerificationEmail(emailParam);
    }
    setParamsLoading(false);
  }, [params]);

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
    });
    if (success) {
      router.push(`?email=${values.email}`);
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

  const otpForm = useForm<z.infer<typeof OTPFormSchema>>({
    resolver: zodResolver(OTPFormSchema),
    defaultValues: {
      pin: "",
    },
  });

  async function otpOnSubmit(data: z.infer<typeof OTPFormSchema>) {
    if (!verificationEmail) {
      return;
    }
    setLoading(1);
    const { success, message } = await verifyEmail(verificationEmail, data.pin);
    if (!success) {
      switch (message) {
        case "token-expired":
          router.push(`?email=${verificationEmail}&verified=expired`);
          break;
        case "user-not-found":
          otpForm.setError("root", {
            type: "manual",
            message: "We couldn't find the user that token was used for.",
          });
          break;
        case "already-verified":
          router.push(`?email=${verificationEmail}&verified=already`);
          break;
        case "error-updating":
          otpForm.setError("root", {
            type: "manual",
            message: "There was an error verifying your account.",
          });
          break;
        case "server-error":
          otpForm.setError("root", {
            type: "manual",
            message: "There was an unexpected server error.",
          });
          break;
        default:
          break;
      }
    } else {
      router.push(`?email=${verificationEmail}verified=true`);
    }
    setLoading(0);
  }

  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown === 0) return;

    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldown]);

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  if (verified == 1) {
    return <VerificationSuccess email={verificationEmail || ""} />;
  }

  if (verified == 2) {
    return <VerificationError email={verificationEmail || ""} />;
  }

  if (verified == 3) {
    return <VerificationAlready email={verificationEmail || ""} />;
  }

  if (verificationEmail) {
    return (
      <div className="flex flex-col gap-4 w-full max-w-xs mx-auto">
        <div className="flex flex-col gap-1 w-full">
          <h1 className="lg:text-2xl md:text-xl sm:text-lg text-base font-bold">
            Enter verification code from email.
          </h1>
          <h2 className="md:text-base text-sm">
            Please enter the code we emailed you{" "}
            <span className="font-semibold">{verificationEmail}</span>
          </h2>
        </div>
        <Form {...otpForm}>
          <form
            onSubmit={otpForm.handleSubmit(otpOnSubmit)}
            className="flex flex-col w-full items-center gap-2"
          >
            <FormField
              control={otpForm.control}
              name="pin"
              render={({ field }) => (
                <FormItem className="w-full!">
                  <FormControl>
                    <InputOTP className="w-full!" maxLength={6} {...field}>
                      <InputOTPGroup className="w-full! text- font-bold">
                        <InputOTPSlot className="flex-1" index={0} />
                        <InputOTPSlot className="flex-1" index={1} />
                        <InputOTPSlot className="flex-1" index={2} />
                        <InputOTPSlot className="flex-1" index={3} />
                        <InputOTPSlot className="flex-1" index={4} />
                        <InputOTPSlot className="flex-1" index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              className="w-full flex flex-row justify-between items-center"
              type="submit"
              disabled={loading > 0}
            >
              {loading > 0 ? (
                <>
                  Verifying...
                  <Loader2Icon className="animate-spin" />
                </>
              ) : (
                <>
                  Verify Account
                  <ArrowRight />
                </>
              )}
            </Button>
            <div className="w-full flex flex-row items-end justify-start gap-1">
              <p className="text-sm align-text-bottom">
                Didn't receive an email?
              </p>
              <Button
                type="button"
                onClick={async () => {
                  await sendVerificationEmail(verificationEmail);
                  setCooldown(300);
                }}
                disabled={cooldown > 0 || loading > 0}
                variant="link"
                className="p-0 h-fit text-sm"
              >
                {cooldown > 0 ? `Resend in ${formatTime(cooldown)}` : "Resend."}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    );
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
