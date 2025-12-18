"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LinkIcon, QrCode, FileText, Zap } from "lucide-react";
import { Link } from "@/i18n/navigation";

const ActionCard = ({
  title,
  description,
  icon,
  href,
  className,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  className?: string;
}) => {
  return (
    <Button
      variant="outline"
      className={cn(
        "h-auto p-4 flex flex-col items-start gap-3 hover:bg-accent/80 transition-all hover:border-primary group",
        className,
      )}
      asChild
    >
      <Link href={href}>
        <div className="flex items-center gap-2 w-full">
          <div className="text-primary group-hover:scale-110 transition-transform">
            {icon}
          </div>
          <h3 className="font-semibold text-base">{title}</h3>
        </div>
        <p className="text-xs text-muted-foreground text-left">{description}</p>
      </Link>
    </Button>
  );
};

export const QuickActions = ({ className }: { className?: string }) => {
  return (
    <Card className={cn("p-4 flex flex-col gap-4", className)}>
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-primary" />
        <h2 className="font-bold text-lg">Quick Actions</h2>
      </div>

      <div className="grid sm:grid-cols-3 grid-cols-1 gap-3">
        <ActionCard
          title="Create Link"
          description="Shorten a URL and track clicks"
          icon={<LinkIcon className="w-5 h-5" />}
          href="/dashboard/links/create"
        />
        <ActionCard
          title="Create QR Code"
          description="Generate a custom QR code"
          icon={<QrCode className="w-5 h-5" />}
          href="/dashboard/qr-codes/create"
        />
        <ActionCard
          title="Create Page"
          description="Build a landing page"
          icon={<FileText className="w-5 h-5" />}
          href="/dashboard/pages/create"
        />
      </div>
    </Card>
  );
};
