# legacy/components/ui/phone-input.tsx

- PhoneInputProps · type · L21-L27 — type PhoneInputProps = Omit< React.ComponentProps<"input">, "onChange" | "value" | "ref" > & Omit<RPNInput.Props<typeof RPNInput.default>, "onChange"> & { onChange?: (value: RPNInput.Value) => void; };
- CountryEntry · type · L70-L70 — type CountryEntry = { label: string; value: RPNInput.Country | undefined };
- CountrySelectProps · type · L72-L77 — type CountrySelectProps = { disabled?: boolean; value: RPNInput.Country; options: CountryEntry[]; onChange: (country: RPNInput.Country) => void; };
- CountrySelect · function · L79-L151 — CountrySelect = ({ disabled, value: selectedCountry, options: countryList, onChange, }: CountrySelectProps)
- CountrySelectOptionProps · interface · L153-L157 — interface CountrySelectOptionProps extends RPNInput.FlagProps
- CountrySelectOption · function · L159-L185 — CountrySelectOption = ({ country, countryName, selectedCountry, onChange, onSelectComplete, }: CountrySelectOptionProps)
- handleSelect · function · L166-L169 — handleSelect = ()
- FlagComponent · function · L187-L195 — FlagComponent = ({ country, countryName }: RPNInput.FlagProps)
