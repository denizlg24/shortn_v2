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
import { useTranslations } from "next-intl";

const usePasswordFormSchema = () => {
  const t = useTranslations("security.validation");
  return z
    .object({
      old_password: z.string().min(1, t("required")),
      password: z
        .string()
        .min(6, t("password-min"))
        .regex(/[A-Z]/, t("uppercase"))
        .regex(/[0-9]/, t("number"))
        .regex(/[^a-zA-Z0-9]/, t("special")),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("mismatch"),
      path: ["confirmPassword"],
    });
};

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
    geo_city?: string;
    geo_country?: string;
    geo_country_region?: string;
    geo_region?: string;
    geo_latitude?: string;
    geo_longitude?: string;
  }[];
}) => {
  const t = useTranslations("security");
  const tToast = useTranslations("security.toast");
  const updatePasswordFormSchema = usePasswordFormSchema();
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
      toast.success(tToast("password-updated"));
      form.reset();
      setChangesLoading(false);
      return;
    } else if (error) {
      toast.error(error.message || tToast("password-error"));
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
        {t("title")}
      </h1>
      <h2 className="lg:text-base sm:text-sm text-xs text-muted-foreground">
        {t("subtitle")}
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
                <FormLabel>{t("current-password")}</FormLabel>
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
                <FormLabel>{t("new-password")}</FormLabel>
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
                <FormLabel>{t("confirm-password")}</FormLabel>
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
                      {t("saving")}
                    </>
                  ) : (
                    <>{t("save-changes")}</>
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    form.reset();
                  }}
                  variant={"outline"}
                >
                  {t("cancel")}
                </Button>
              </>
            )}
          </div>
        </form>
      </Form>
      <Separator className="my-4" />
      <Card className="p-4 w-full max-w-xl flex flex-col gap-4">
        <h1 className="lg:text-lg sm:text-base text-sm font-semibold">
          {t("active-sessions")}
        </h1>
        {loggedInDevices.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("no-sessions")}</p>
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
                          {t("current-session")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate w-full">
                      {device.ipAddress || "Unknown IP"} •{" "}
                      {userAgentInfo.device}
                    </p>
                    <p className="text-xs text-muted-foreground truncate w-full">
                      {device.geo_city ||
                      device.geo_region ||
                      device.geo_country
                        ? `${device.geo_city || ""}${device.geo_city && device.geo_region ? ", " : ""}${device.geo_region || ""}${(device.geo_city || device.geo_region) && device.geo_country ? ", " : ""}${device.geo_country || ""}`
                            .trim()
                            .replace(/^,\s*|,\s*$/g, "") || "Unknown location"
                        : t("unknown-location")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("active-since")}{" "}
                      {format(device.createdAt, "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                  <div className="flex flex-col h-full gap-1 items-center justify-between">
                    {isCurrentSession && (
                      <span className="sm:hidden block text-xs font-medium px-2 py-0.5 rounded-full bg-primary/20 text-primary whitespace-nowrap shrink-0">
                        {t("current-session")}
                      </span>
                    )}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="ml-2 shrink-0"
                        >
                          {t("revoke")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="w-[calc(100vw-16px)] mx-auto max-w-md">
                        <DialogHeader>
                          <DialogTitle>
                            {isCurrentSession
                              ? t("revoke-current-title")
                              : t("revoke-title")}
                          </DialogTitle>
                          <DialogDescription>
                            {isCurrentSession ? (
                              <>
                                <span className="font-semibold text-destructive">
                                  {t("warning")}
                                </span>{" "}
                                {t("revoke-current-warning")}
                              </>
                            ) : (
                              <>{t("revoke-warning")}</>
                            )}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-2 mt-4">
                          <p className="text-sm">
                            <span className="font-semibold">{t("device")}</span>{" "}
                            {userAgentInfo.browser} on {userAgentInfo.os}
                          </p>
                          <p className="text-sm">
                            <span className="font-semibold">
                              {t("device-type")}
                            </span>{" "}
                            {userAgentInfo.device}
                          </p>
                          <p className="text-sm">
                            <span className="font-semibold">{t("ip")}</span>{" "}
                            {device.ipAddress || "Unknown"}
                          </p>
                          <p className="text-sm">
                            <span className="font-semibold">
                              {t("location")}
                            </span>{" "}
                            {device.geo_city ||
                            device.geo_region ||
                            device.geo_country
                              ? `${device.geo_city || ""}${device.geo_city && device.geo_region ? ", " : ""}${device.geo_region || ""}${(device.geo_city || device.geo_region) && device.geo_country ? ", " : ""}${device.geo_country || ""}`
                                  .trim()
                                  .replace(/^,\s*|,\s*$/g, "") ||
                                t("unknown-location")
                              : t("unknown-location")}
                          </p>
                          <p className="text-sm">
                            <span className="font-semibold">
                              {t("active-since")}
                            </span>{" "}
                            {format(device.createdAt, "MMM d, yyyy h:mm a")}
                          </p>
                        </div>
                        <div className="flex flex-row gap-2 mt-4">
                          <DialogTrigger asChild>
                            <Button variant="outline" className="flex-1">
                              {t("cancel")}
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
                                  await fetch("/api/auth/track-activity", {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      sub: user?.sub,
                                      type: "session-revoked",
                                      success: true,
                                    }),
                                  });

                                  toast.success(t("session-revoked"));
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
                                    error.error || t("revoke-failed"),
                                  );
                                  setRevokingSessionId(null);
                                }
                              } catch (error) {
                                console.error("Error revoking session:", error);
                                toast.error(t("revoke-error"));
                                setRevokingSessionId(null);
                              }
                            }}
                          >
                            {revokingSessionId === device.id ? (
                              <>
                                <Loader2 className="animate-spin" />
                                {isCurrentSession
                                  ? t("logging-out")
                                  : t("revoking")}
                              </>
                            ) : (
                              <>
                                {isCurrentSession
                                  ? t("revoke-logout")
                                  : t("revoke-session")}
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
        {t("activity-history")}
      </h1>
      <h2 className="lg:text-base sm:text-sm text-xs text-muted-foreground">
        {t("activity-description")}
      </h2>
      <Separator className="my-4" />
      <div className="w-full max-w-xl flex flex-col gap-4 items-start">
        {loginRecords.length == 0 && (
          <p className="font-semibold text-left text-sm">{t("no-activity")}</p>
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
                      ? t("unknown-location")
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
                {t("see-all", { count: fullLoginRecords.length })}
                <SquareArrowOutUpRight className="w-3 h-3 shrink-0 translate-y-0.5" />
              </p>
            </DialogTrigger>
            <DialogContent className="w-[calc(100vw-16px)] mx-auto max-w-[800px] z-95">
              <DialogHeader>
                <DialogTitle>{t("activity-logs")}</DialogTitle>
                <DialogDescription>
                  {t("activity-logs-description")}
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
