"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  EyeOff,
  Eye,
  Loader2,
  SquareArrowOutUpRight,
  Monitor,
} from "lucide-react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FullLoginRecordsCard } from "./full-login-records-card";
import { authClient } from "@/lib/authClient";
import { Card } from "@/components/ui/card";
import { parseUserAgent } from "@/lib/user-agent-parser";
import { useRouter } from "@/i18n/navigation";
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
  fullLoginRecords,
  loggedInDevices,
}: {
  loginRecords: TLoginRecord[];
  fullLoginRecords: TLoginRecord[];
  loggedInDevices: {
    ipAddress: string | undefined;
    createdAt: Date;
    id: string;
    userAgent: string | undefined;
    geo?: {
      city?: string;
      country?: string;
      countryRegion?: string;
      region?: string;
      latitude?: string;
      longitude?: string;
    };
  }[];
}) => {
  const form = useForm<z.infer<typeof updatePasswordFormSchema>>({
    resolver: zodResolver(updatePasswordFormSchema),
    defaultValues: {
      old_password: "",
      password: "",
      confirmPassword: "",
    },
  });
  const { isDirty } = form.formState;
  const [showPassword, toggleShowPassword] = useState(false);
  const [showCurrentPassword, toggleShowCurrentPassword] = useState(false);
  const [confirmShowPassword, toggleConfirmShowPassword] = useState(false);
  const [changesLoading, setChangesLoading] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(
    null,
  );
  const { data } = authClient.useSession();
  const user = data?.user;
  const currentSessionId = data?.session?.id;
  const router = useRouter();
  async function onSubmit(values: z.infer<typeof updatePasswordFormSchema>) {
    if (!user) {
      return;
    }
    setChangesLoading(true);
    const { error } = await authClient.changePassword({
      newPassword: values.password,
      currentPassword: values.old_password,
      revokeOtherSessions: true,
    });

    if (!error) {
      const accountActivity = {
        sub: user.sub,
        type: "password-changed",
        success: true,
      };
      fetch("/api/auth/track-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountActivity),
      });
      toast.success("Your password has been updated!");
      form.reset();
      setChangesLoading(false);
      return;
    } else if (error) {
      toast.error(
        error.message || "There was an error updating your password.",
      );
      const accountActivity = {
        sub: user.sub,
        type: "password-change-attempt",
        success: false,
      };
      fetch("/api/auth/track-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountActivity),
      });
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
            {isDirty && (
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
      <Card className="p-4 w-full max-w-xl flex flex-col gap-4">
        <h1 className="lg:text-lg sm:text-base text-sm font-semibold">
          Active Sessions
        </h1>
        {loggedInDevices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {loggedInDevices.map((device) => {
              const isCurrentSession = device.id === currentSessionId;
              const userAgentInfo = parseUserAgent(device.userAgent);
              return (
                <div
                  key={`${device.id}`}
                  className={cn(
                    "flex flex-row items-start justify-between gap-3 p-3 rounded-lg border",
                    isCurrentSession
                      ? "bg-primary/5 border-primary/30"
                      : "bg-card",
                  )}
                >
                  <div className="flex flex-col gap-1 items-start text-left flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 w-full">
                      <div className="flex flex-row items-center gap-2 min-w-0 flex-1">
                        <Monitor className="w-4 h-4 text-muted-foreground shrink-0" />
                        <p className="text-sm font-semibold truncate">
                          {userAgentInfo.browser} on {userAgentInfo.os}
                        </p>
                      </div>
                      {isCurrentSession && (
                        <span className="sm:block hidden text-xs font-medium px-2 py-0.5 rounded-full bg-primary/20 text-primary whitespace-nowrap shrink-0">
                          Current Session
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate w-full">
                      {device.ipAddress || "Unknown IP"} •{" "}
                      {userAgentInfo.device}
                    </p>
                    <p className="text-xs text-muted-foreground truncate w-full">
                      {device.geo
                        ? `${device.geo.city || ""}${device.geo.city && device.geo.region ? ", " : ""}${device.geo.region || ""}${(device.geo.city || device.geo.region) && device.geo.country ? ", " : ""}${device.geo.country || ""}`
                            .trim()
                            .replace(/^,\s*|,\s*$/g, "") || "Unknown location"
                        : "Unknown location"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Active since{" "}
                      {format(device.createdAt, "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                  <div className="flex flex-col h-full gap-1 items-center justify-between">
                    {isCurrentSession && (
                      <span className="sm:hidden block text-xs font-medium px-2 py-0.5 rounded-full bg-primary/20 text-primary whitespace-nowrap shrink-0">
                        Current Session
                      </span>
                    )}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="ml-2 shrink-0"
                        >
                          Revoke
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="w-[calc(100vw-16px)] mx-auto max-w-md">
                        <DialogHeader>
                          <DialogTitle>
                            {isCurrentSession
                              ? "Revoke current session?"
                              : "Revoke session?"}
                          </DialogTitle>
                          <DialogDescription>
                            {isCurrentSession ? (
                              <>
                                <span className="font-semibold text-destructive">
                                  Warning:
                                </span>{" "}
                                You are about to revoke your current session.
                                You will be logged out immediately and
                                redirected to the login page.
                              </>
                            ) : (
                              <>
                                Are you sure you want to revoke this session?
                                The device will be logged out immediately.
                              </>
                            )}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-2 mt-4">
                          <p className="text-sm">
                            <span className="font-semibold">Device:</span>{" "}
                            {userAgentInfo.browser} on {userAgentInfo.os}
                          </p>
                          <p className="text-sm">
                            <span className="font-semibold">Device Type:</span>{" "}
                            {userAgentInfo.device}
                          </p>
                          <p className="text-sm">
                            <span className="font-semibold">IP:</span>{" "}
                            {device.ipAddress || "Unknown"}
                          </p>
                          <p className="text-sm">
                            <span className="font-semibold">Location:</span>{" "}
                            {device.geo
                              ? `${device.geo.city || ""}${device.geo.city && device.geo.region ? ", " : ""}${device.geo.region || ""}${(device.geo.city || device.geo.region) && device.geo.country ? ", " : ""}${device.geo.country || ""}`
                                  .trim()
                                  .replace(/^,\s*|,\s*$/g, "") ||
                                "Unknown location"
                              : "Unknown location"}
                          </p>
                          <p className="text-sm">
                            <span className="font-semibold">Active since:</span>{" "}
                            {format(device.createdAt, "MMM d, yyyy h:mm a")}
                          </p>
                        </div>
                        <div className="flex flex-row gap-2 mt-4">
                          <DialogTrigger asChild>
                            <Button variant="outline" className="flex-1">
                              Cancel
                            </Button>
                          </DialogTrigger>
                          <Button
                            variant="destructive"
                            className="flex-1"
                            disabled={revokingSessionId === device.id}
                            onClick={async () => {
                              setRevokingSessionId(device.id);
                              try {
                                const response = await fetch(
                                  "/api/auth/revoke-session",
                                  {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      sessionId: device.id,
                                    }),
                                  },
                                );

                                if (response.ok) {
                                  toast.success("Session revoked successfully");
                                  if (isCurrentSession) {
                                    await authClient.signOut({
                                      fetchOptions: {
                                        onSuccess: () => {
                                          router.push("/login");
                                        },
                                        onError: () => {
                                          router.push("/login");
                                        },
                                      },
                                    });
                                  } else {
                                    router.refresh();
                                  }
                                } else {
                                  const error = await response.json();
                                  toast.error(
                                    error.error || "Failed to revoke session",
                                  );
                                  setRevokingSessionId(null);
                                }
                              } catch (error) {
                                console.error("Error revoking session:", error);
                                toast.error(
                                  "An error occurred. Please try again.",
                                );
                                setRevokingSessionId(null);
                              }
                            }}
                          >
                            {revokingSessionId === device.id ? (
                              <>
                                <Loader2 className="animate-spin" />
                                {isCurrentSession
                                  ? "Logging out..."
                                  : "Revoking..."}
                              </>
                            ) : (
                              <>
                                {isCurrentSession
                                  ? "Revoke & Log Out"
                                  : "Revoke Session"}
                              </>
                            )}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <Separator className="my-4" />
      <h1 className="lg:text-xl md:text-lg sm:text-base text-sm font-semibold">
        Account Activity History
      </h1>
      <h2 className="lg:text-base sm:text-sm text-xs text-muted-foreground">
        You&apos;re viewing recent activity on your account.
      </h2>
      <Separator className="my-4" />
      <div className="w-full max-w-xl flex flex-col gap-4 items-start">
        {loginRecords.length == 0 && (
          <p className="font-semibold text-left text-sm">
            No account activity records yet.
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
        {loginRecords.length < fullLoginRecords.length && (
          <Dialog>
            <DialogTrigger asChild>
              <p className="text-sm font-semibold text-left hover:cursor-pointer hover:underline flex flex-row items-baseline gap-1 justify-start">
                See all {fullLoginRecords.length} activity logs.
                <SquareArrowOutUpRight className="w-3 h-3 shrink-0 translate-y-0.5" />
              </p>
            </DialogTrigger>
            <DialogContent className="w-[calc(100vw-16px)] mx-auto max-w-[800px] z-95">
              <DialogHeader>
                <DialogTitle>Account activity logs</DialogTitle>
                <DialogDescription>
                  Check detailed account activity logs, with filters.
                </DialogDescription>
              </DialogHeader>
              <FullLoginRecordsCard records={fullLoginRecords} />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
};
