"use client";

import { User } from "next-auth";
import { createContext, useContext, useState, ReactNode } from "react";

type UserContextType = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<boolean>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser: User | null;
}) => {
  const [user, setUser] = useState<User | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser);

  const fetchUser = async () => {
    setLoading(true);
    const res = await fetch("/api/auth/user", { cache: "no-store" });
    if (!res.ok) {
      setUser(null);
      return false;
    }
    const data = await res.json();
    setUser(data.user ?? null);
    setLoading(false);
    return true;
  };

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        refresh: fetchUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return ctx;
};
