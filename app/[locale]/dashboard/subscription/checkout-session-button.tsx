"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "@/i18n/navigation";
import { VariantProps } from "class-variance-authority";
import { MoveRight } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

export const CheckoutSessionButton = ({
  className,
  slug,
  text,
  variant,
}: {
  className?: string;
  slug: "pro" | "plus" | "basic";
  text: string;
  variant?: VariantProps<typeof Button>["variant"];
}) => {
  const t = useTranslations("checkout-button");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const handleClick = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/polar/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ slug }),
      });
      const data = await response.json();
      if (data.success && data.url) {
        router.push(data.url);
      }
    } catch (error) {
      console.error("Failed to create checkout session:", error);
    }
    setLoading(false);
  };

  return (
    <Button
      variant={variant || "default"}
      onClick={handleClick}
      disabled={loading}
      className={className}
    >
      {loading ? (
        <>
          {t("loading")} <Spinner />
        </>
      ) : (
        <>
          {text} <MoveRight />
        </>
      )}
    </Button>
  );
};
