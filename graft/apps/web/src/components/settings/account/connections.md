# apps/web/src/components/settings/account/connections.tsx

- LinkedAccount · interface · L17-L21 — interface LinkedAccount
- Connections · function · L23-L173 — function Connections({ accounts, providers, returnPath, linkError, }: { accounts: LinkedAccount[]; providers: Record<SocialProvider, boolean>; returnPath: string; linkError: string | null; })
- connect · function · L56-L75 — connect = async (provider: SocialProvider)
- disconnect · function · L77-L102 — disconnect = async ( account: LinkedAccount, provider: SocialProvider, )
- ConnectionRow · function · L175-L196 — function ConnectionRow({ icon, name, status, action, }: { icon: ReactNode; name: string; status: string; action?: ReactNode; })
