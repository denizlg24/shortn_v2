"use client";
import { fetchApi } from "@/lib/utils";
import { ClickEntry } from "@/models/url/Click";
import { Dispatch, ReactNode, SetStateAction, createContext, useContext } from "react";

type ScanDataContextType = {
    getScans:(startDate:string|undefined,endDate:string|undefined,setScans:Dispatch<SetStateAction<ClickEntry[]>>,setLoading:Dispatch<SetStateAction<boolean>>) => Promise<void>,
}

const ScanDataContext = createContext<ScanDataContextType | undefined>(undefined);

export const ScanDataProvider = ({children,urlCode}:{children:ReactNode,urlCode:string}) =>{
    const getScans = async (startDate:string|undefined,endDate:string|undefined,setScans:Dispatch<SetStateAction<ClickEntry[]>>,setLoading:Dispatch<SetStateAction<boolean>>) => {
        try {
            setLoading(true);
            const response = await fetchApi<{scans:ClickEntry[]}>(`/scans/${urlCode}?start=${startDate}&end=${endDate}`);
            if(response.success){
                setScans(response.scans);
            } else {
                setScans([]);
            }
        } catch (error) {
            console.log(error);
            setScans([]);
        } finally {
            setLoading(false);
        }
    }
    return (
        <ScanDataContext.Provider
          value={{
            getScans,
          }}
        >
          {children}
        </ScanDataContext.Provider>
      );
}

export const useScans = () => {
    const ctx = useContext(ScanDataContext);
    if (!ctx) {
      throw new Error("useScans must be used within a ScanDataProvider");
    }
    return ctx;
  };