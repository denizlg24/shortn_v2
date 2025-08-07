"use client";

import { getUser } from "@/app/actions/userActions";
import { User } from "next-auth";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

type UserContextType = {
  user: User | null;
  loading: boolean;
  getOrganization: string;
  refresh: () => Promise<boolean>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    setLoading(true);
    const { success, user: _user } = await getUser();
    setUser(_user);
    setOrganization(_user?.sub.split("|")[1] || "");
    setLoading(false);
    return success;
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        getOrganization: organization,
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
