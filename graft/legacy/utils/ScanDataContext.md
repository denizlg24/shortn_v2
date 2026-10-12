# legacy/utils/ScanDataContext.tsx

- ScanDataContextType · type · L12-L20 — type ScanDataContextType = { getScans: ( startDate: string | undefined, endDate: string | undefined, setScans: Dispatch<SetStateAction<TClickEntry[]>>, setLoading: Dispatch<SetStateAction<boolean>>, ) => Promise<void>; urlCode: string; };
- ScanDataProvider · function · L26-L66 — ScanDataProvider = ({ children, urlCode, }: { children: ReactNode; urlCode: string; })
- getScans · function · L33-L55 — getScans = async ( startDate: string | undefined, endDate: string | undefined, setScans: Dispatch<SetStateAction<TClickEntry[]>>, setLoading: Dispatch<SetStateAction<boolean>>, )
- useScans · function · L68-L74 — useScans = ()
