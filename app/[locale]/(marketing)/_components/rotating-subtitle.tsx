"use client";

import RotatingText from "@/components/RotatingText";
import { LayoutGroup, motion } from "framer-motion";

export const RotatingSubtitle = ({ texts }: { texts: string[] }) => {
  return (
    <div className="inline-block transition-all overflow-hidden px-6">
      <LayoutGroup>
        <motion.p
          className={"flex items-center gap-2 sm:text-2xl text-lg"}
          layout
        >
          <motion.span
            className=""
            layout
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
          >
            Your{" "}
          </motion.span>
          <RotatingText
            texts={texts}
            mainClassName="rotating-text-main inline-block whitespace-nowrap font-semibold text-primary"
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
