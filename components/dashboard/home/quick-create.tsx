"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useUser } from "@/utils/UserContext";
import { LinkIcon, QrCode } from "lucide-react";

export const QuickCreate = ({ className }: { className?: string }) => {
  const { user } = useUser();
  const allowedLinks = {
    free: 3,
    basic: 25,
    plus: 50,
  };
  const linksLeft =
    user?.plan.subscription && user.plan.subscription != "pro"
      ? allowedLinks[user.plan.subscription as "free" | "basic" | "plus"] -
        (user.links_this_month ?? 0)
      : undefined;
  return (
    <Card
      className={cn("p-4 pb-6 w-full flex flex-col justify-between", className)}
    >
      <Tabs defaultValue="link" className="w-full col-span-full h-full">
        <div className="w-full flex sm:flex-row flex-col items-center justify-between gap-2">
          <h1 className="col-span-1 lg:text-2xl md:text-xl sm:text-lg text-base font-bold text-left sm:w-auto w-full">
            Quick Create
          </h1>
          <TabsList className="rounded-full! sm:w-auto w-full">
            <TabsTrigger
              className="font-semibold flex flex-row items-center gap-1 p-4! rounded-full"
              value="link"
            >
              <LinkIcon />
              Short Link
            </TabsTrigger>
            <TabsTrigger
              className="font-semibold flex flex-row items-center gap-1 p-4! rounded-full"
              value="qrcode"
            >
              <QrCode />
              QR Code
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="link" asChild>
          <div className="w-full flex flex-col gap-1 justify-between">
            {linksLeft && linksLeft > 0 && (
              <p className="text-sm font-semibold  gap-1 flex flex-row items-center">
                You can create <span className="font-bold">{linksLeft}</span>{" "}
                more short links this month.
              </p>
            )}
            {!linksLeft && (
              <div className="text-sm font-semibold w-full flex flex-row items-center gap-1">
                <p>You can create </p>
                <Skeleton className="w-3 h-3" />
                <p> more short links this month.</p>
              </div>
            )}

            <div className="w-full flex flex-col gap-1 ">
              <p>Enter your destination URL</p>
              <div className="w-full sm:grid flex flex-col grid-cols-6 gap-4">
                <Input
                  className="col-span-4"
                  type="text"
                  placeholder="https://myexample.com/longurl"
                />
                <Button className="col-span-2">Create your Shortn</Button>
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="qrcode" asChild>
          <div
            className={cn(
              "w-full flex flex-col gap-1",
              user?.plan.subscription != "pro"
                ? "justify-between"
                : "justify-end"
            )}
          >
            {user?.plan.subscription != "pro" && (
              <div className="flex flex-row flex-wrap gap-2 w-full">
                <p>This is a PRO only feature.</p>
                <Button asChild className="h-fit px-4 py-1 rounded w-fit">
                  <Link
                    href={`/dashboard/${user?.sub.split("|")[1]}/subscription`}
                  >
                    Upgrade
                  </Link>
                </Button>
              </div>
            )}
            <div className="w-full flex flex-col gap-1 ">
              <p>Enter your destination URL</p>
              <div className="w-full sm:grid flex flex-col grid-cols-6 gap-4">
                <Input
                  disabled={user?.plan.subscription != "pro"}
                  className="col-span-4"
                  type="text"
                  placeholder="https://myexample.com/longurl"
                />
                <Button
                  disabled={user?.plan.subscription != "pro"}
                  className="col-span-2"
                >
                  Create your QR Code
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};
