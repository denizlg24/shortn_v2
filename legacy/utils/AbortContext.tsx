// AbortControllerContext.tsx
"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type AbortControllerContextType = {
  controller: AbortController | null;
  startRequest: () => AbortSignal;
  cancelRequest: () => void;
};

const AbortControllerContext = createContext<
  AbortControllerContextType | undefined
>(undefined);

export const AbortControllerProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [controller, setController] = useState<AbortController | null>(null);

  const startRequest = () => {
    // Cancel any existing request
    controller?.abort();

    const newController = new AbortController();
    setController(newController);
    return newController.signal;
  };

  const cancelRequest = () => {
    controller?.abort();
    setController(null);
  };

  return (
    <AbortControllerContext.Provider
      value={{ controller, startRequest, cancelRequest }}
    >
      {children}
    </AbortControllerContext.Provider>
  );
};

export const useAbortController = () => {
  const context = useContext(AbortControllerContext);
  if (!context)
    throw new Error(
      "useAbortController must be used within an AbortControllerProvider"
    );
  return context;
};
