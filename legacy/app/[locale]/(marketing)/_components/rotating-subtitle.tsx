"use client";

import RotatingText from "@/components/RotatingText";
import { cn } from "@/lib/utils";
import { LayoutGroup, motion } from "framer-motion";
import { useTranslations } from "next-intl";

export const RotatingSubtitle = ({
  texts,
  className,
  accentClassName,
}: {
  texts: string[];
  className?: string;
  accentClassName?: string;
}) => {
  const t = useTranslations("rotating-subtitle");
  return (
    <div
      className={cn(
        "inline-block overflow-hidden px-6 transition-all",
        className,
      )}
    >
      <LayoutGroup>
        <motion.p
          className="flex items-center gap-2 text-lg sm:text-2xl"
          layout
        >
          <motion.span
            layout
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
          >
            {t("your")}{" "}
          </motion.span>
          <RotatingText
            texts={texts}
            mainClassName={cn(
              "rotating-text-main inline-block whitespace-nowrap font-semibold text-primary",
              accentClassName,
            )}
            staggerFrom={"last"}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-120%" }}
            staggerDuration={0.025}
            splitLevelClassName="rotating-text-split"
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
            rotationInterval={3000}
          />
        </motion.p>
      </LayoutGroup>
    </div>
  );
};
