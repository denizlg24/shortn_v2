"use client";

import { updatePassword } from "@/app/actions/userActions";
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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { TLoginRecord } from "@/models/auth/LoginActivity";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { EyeOff, Eye, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
const updatePasswordFormSchema = z
  .object({
    old_password: z.string().min(1, "Required"),
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

export const SecurityCard = ({
  loginRecords,
}: {
  loginRecords: TLoginRecord[];
}) => {
  const form = useForm<z.infer<typeof updatePasswordFormSchema>>({
    resolver: zodResolver(updatePasswordFormSchema),
    defaultValues: {
      old_password: "",
      password: "",
      confirmPassword: "",
    },
  });
  const [showPassword, toggleShowPassword] = useState(false);
  const [showCurrentPassword, toggleShowCurrentPassword] = useState(false);
  const [confirmShowPassword, toggleConfirmShowPassword] = useState(false);
  const [changesLoading, setChangesLoading] = useState(false);

  async function onSubmit(values: z.infer<typeof updatePasswordFormSchema>) {
    setChangesLoading(true);
    const { success, message } = await updatePassword({
      old: values.old_password,
      newPassword: values.password,
    });

    if (success) {
      toast.success("Your password has been updated!");
      form.reset();
      return;
    }

    // attach errors to the correct field
    if (message === "password-incorrect") {
      form.setError("old_password", {
        type: "manual",
        message: "Your current password is incorrect.",
      });
    } else if (message === "user-not-found") {
      toast.error("User not found. Please log in again.");
    } else if (message === "server-error") {
      toast.error(
        "There was a problem updating your password. Try again later.",
      );
    }
    setChangesLoading(false);
  }

  return (
    <div className="w-full flex flex-col">
      <h1 className="lg:text-xl md:text-lg sm:text-base text-sm font-semibold">
        Security Details
      </h1>
      <h2 className="lg:text-base sm:text-sm text-xs text-muted-foreground">
        Update your password here.
      </h2>
      <Separator className="my-4" />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid sm:grid-cols-2 grid-cols-1 max-w-xl gap-x-8 gap-y-4 w-full my-4 items-start"
        >
          <FormField
            control={form.control}
            name="old_password"
            render={({ field }) => (
              <FormItem className="relative">
                <FormLabel>Current Password</FormLabel>
                <FormControl>
                  <Input
                    className="bg-background"
                    type={showCurrentPassword ? "text" : "password"}
                    placeholder=""
                    {...field}
                  />
                </FormControl>
                <FormMessage />
                <Button
                  type="button"
                  onClick={() => {
                    toggleShowCurrentPassword((prev) => !prev);
                  }}
                  variant="link"
                  className="absolute right-0 top-6"
                >
                  {!showCurrentPassword ? <EyeOff /> : <Eye />}
                </Button>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="relative">
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <Input
                    className="bg-background"
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
                <FormLabel>Confirm New Password</FormLabel>
                <FormControl>
                  <Input
                    className="bg-background"
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
          <div className="grid xs:grid-cols-2 grid-cols-1 w-full col-span-full gap-6 gap-y-2">
            {form.formState.isDirty && (
              <>
                <Button type="submit" disabled={changesLoading}>
                  {changesLoading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>Save Changes</>
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    form.reset();
                  }}
                  variant={"outline"}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </form>
      </Form>
      <Separator className="my-4" />
      <h1 className="lg:text-xl md:text-lg sm:text-base text-sm font-semibold">
        Access History
      </h1>
      <h2 className="lg:text-base sm:text-sm text-xs text-muted-foreground">
        You&apos;re viewing recent activity on your account.
      </h2>
      <Separator className="my-4" />
      <div className="w-full max-w-xl flex flex-col gap-4 items-start">
        {loginRecords.length == 0 && (
          <p className="font-semibold text-left text-sm">
            No login records yet.
          </p>
        )}
        {loginRecords.map((record) => {
          return (
            <React.Fragment key={record.at.getTime()}>
              <div className="w-full flex flex-row items-start justify-between">
                <div className="flex flex-col gap-1 items-start text-left">
                  <p className="flex flex-row items-center justify-start gap-1 font-semibold text-sm">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        record.succeeded ? "bg-green-700" : "bg-red-700",
                      )}
                    ></span>
                    {record.type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {record.location == ", "
                      ? "Unknown location"
                      : record.location}
                  </p>
                </div>
                <div className="flex flex-col gap-1 items-end text-right w-fit">
                  <p className="text-sm text-muted-foreground">
                    {format(record.at, "MMM d, yyyy h:mm a 'GMT'xxx")}
                  </p>
                  <p className="text-xs text-muted-foreground">{record.ip}</p>
                </div>
              </div>
              <Separator />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
