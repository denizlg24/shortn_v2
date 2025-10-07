"use client";
import { fetchApi } from "@/lib/utils";
import { ClickEntry } from "@/models/url/Click"
import { Dispatch, ReactNode, SetStateAction, createContext, useContext, } from "react";

type ClickDataContextType = {
    getClicks:(startDate:string|undefined,endDate:string|undefined,setClicks:Dispatch<SetStateAction<ClickEntry[]>>,setLoading:Dispatch<SetStateAction<boolean>>) => Promise<void>,
}

const ClickDataContext = createContext<ClickDataContextType | undefined>(undefined);

export const ClickDataProvider = ({children,urlCode}:{children:ReactNode,urlCode:string}) =>{
    const getClicks = async (startDate:string|undefined,endDate:string|undefined,setClicks:Dispatch<SetStateAction<ClickEntry[]>>,setLoading:Dispatch<SetStateAction<boolean>>) => {
        try {
            setLoading(true);
            const response = await fetchApi<{clicks:ClickEntry[]}>(`/clicks/${urlCode}?start=${startDate}&end=${endDate}`);
            if(response.success){
                setClicks(response.clicks);
            } else {
                setClicks([]);
            }
        } catch (error) {
            console.log(error);
            setClicks([]);
        } finally {
            setLoading(false);
        }
    }
    return (
        <ClickDataContext.Provider
          value={{
            getClicks,
          }}
        >
          {children}
        </ClickDataContext.Provider>
      );
}

export const useClicks = () => {
    const ctx = useContext(ClickDataContext);
    if (!ctx) {
      throw new Error("useClicks must be used within a ClickDataProvider");
    }
    return ctx;
  };