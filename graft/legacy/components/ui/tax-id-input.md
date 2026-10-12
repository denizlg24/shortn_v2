# legacy/components/ui/tax-id-input.tsx

- TaxIdInputProps · interface · L29-L34 — interface TaxIdInputProps
- TaxIdInput · function · L36-L85 — TaxIdInput: React.FC<TaxIdInputProps> = ({ value, onChange, className, })
- handleInputChange · function · L55-L59 — handleInputChange = (e: React.ChangeEvent<HTMLInputElement>)
- handleCountryChange · function · L61-L64 — handleCountryChange = (code: string)
- CountryEntry · type · L87-L87 — type CountryEntry = { label: string; value: string };
- CountrySelectProps · type · L89-L94 — type CountrySelectProps = { disabled?: boolean; value: string; options: CountryEntry[]; onChange: (country: string) => void; };
- CountrySelect · function · L96-L171 — CountrySelect = ({ disabled, value: selectedCountry, options, onChange, }: CountrySelectProps)
- FlagProps · interface · L173-L176 — interface FlagProps
- FlagComponent · function · L178-L186 — FlagComponent = ({ country, countryName }: FlagProps)
