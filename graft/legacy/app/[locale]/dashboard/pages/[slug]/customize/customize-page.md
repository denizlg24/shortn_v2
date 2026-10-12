# legacy/app/[locale]/dashboard/pages/[slug]/customize/customize-page.tsx

- GetSocialIcon · function · L53-L94 — GetSocialIcon = ({ platform, color, }: { platform?: string; color?: string; }): ReactNode
- SocialButton · function · L96-L117 — SocialButton = ({ platform, title, onClick, toggled, }: { platform?: string; title?: string; onClick?: () => void; toggled?: boolean; }): ReactNode
- CustomizeBioPage · function · L119-L1649 — CustomizeBioPage = ({ initialBio, }: { initialBio: { userId: string; slug: string; title: string; description?: string; avatarUrl?: string; avatarShape?: "circle" | "square" | "rounded"; theme?: { primaryColor?: string; buttonTextColor?: string; background?: string; textColor?: string; buttonStyle?: "rounded" | "square" | "pill"; font?: string; titleFontSize?: string; titleFontWeight?: string; descriptionFontSize?: string; descriptionFontWeight?: string; buttonFontSize?: string; buttonFontWeight?: string; header?: { headerStyle: "centered" | "left-aligned" | "right-aligned"; headerBackgroundImage?: string; headerBackgroundColor?: string; }; }; links: { link: { shortUrl: string; title: string }; image?: string; title?: string; }[]; socials?: { url: string; platform: string }[]; socialColor: string | "original"; createdAt: Date; updatedAt: Date; }; })
- uploadFile · function · L266-L297 — uploadFile = async ( e: React.ChangeEvent<HTMLInputElement>, callback: (_arg0: string) => void, )
- removeFile · function · L299-L304 — removeFile = async (url: string, callback: () => void)
- handleSave · function · L306-L338 — handleSave = async ()
- getFieldError · function · L340-L340 — getFieldError = (field: string)
- hasFieldError · function · L341-L341 — hasFieldError = (field: string)
