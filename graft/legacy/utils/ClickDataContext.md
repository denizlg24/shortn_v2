# legacy/utils/ClickDataContext.tsx

- ClickDataContextType · type · L12-L20 — type ClickDataContextType = { getClicks: ( startDate: string | undefined, endDate: string | undefined, setClicks: Dispatch<SetStateAction<TClickEntry[]>>, setLoading: Dispatch<SetStateAction<boolean>>, ) => Promise<void>; urlCode: string; };
- ClickDataProvider · function · L26-L66 — ClickDataProvider = ({ children, urlCode, }: { children: ReactNode; urlCode: string; })
- getClicks · function · L33-L55 — getClicks = async ( startDate: string | undefined, endDate: string | undefined, setClicks: Dispatch<SetStateAction<TClickEntry[]>>, setLoading: Dispatch<SetStateAction<boolean>>, )
- useClicks · function · L68-L74 — useClicks = ()
