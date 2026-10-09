import * as React from "react";
import { CheckIcon, ChevronsUpDown } from "lucide-react";
import flags from "react-phone-number-input/flags";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { countries } from "jsvat";

const COUNTRY_LIST = countries.map((country) => ({
  label: country.name,
  value: country.codes[0],
}));

interface TaxIdInputProps {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  defaultValue?: string;
}

export const TaxIdInput: React.FC<TaxIdInputProps> = ({
  value,
  onChange,
  className,
}) => {
  const initialCountry = value?.slice(0, 2).toLowerCase() || "pt";
  const initialId = value?.slice(2) || "";
  const [loading, setLoading] = React.useState(true);

  const [countryCode, setCountryCode] = React.useState(initialCountry);
  const [input, setInput] = React.useState(initialId);
  React.useEffect(() => {
    if (loading && value) {
      setCountryCode(value?.slice(0, 2).toLowerCase() || "pt");
      setInput(value?.slice(2));
      setLoading(false);
    }
  }, [value, loading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    onChange?.(`${countryCode}${val}`);
  };

  const handleCountryChange = (code: string) => {
    setCountryCode(code);
    onChange?.(`${code}${input}`);
  };

  if (!value && value != "") {
    return;
  }

  return (
    <div className={cn("flex", className)}>
      <CountrySelect
        value={countryCode}
        options={COUNTRY_LIST}
        onChange={handleCountryChange}
      />
      <Input
        type="text"
        className="rounded-s-none bg-background"
        value={input}
        onChange={handleInputChange}
      />
    </div>
  );
};

type CountryEntry = { label: string; value: string };

type CountrySelectProps = {
  disabled?: boolean;
  value: string;
  options: CountryEntry[];
  onChange: (country: string) => void;
};

const CountrySelect = ({
  disabled,
  value: selectedCountry,
  options,
  onChange,
}: CountrySelectProps) => {
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const [searchValue, setSearchValue] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="flex gap-1 rounded-e-none rounded-s-lg border-r-0 px-3 focus:z-10"
          disabled={disabled}
        >
          <FlagComponent
            country={selectedCountry}
            countryName={selectedCountry}
          />
          <ChevronsUpDown
            className={cn("-mr-2 size-4 opacity-50", disabled && "hidden")}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput
            value={searchValue}
            onValueChange={(value) => {
              setSearchValue(value);
              setTimeout(() => {
                const viewport = scrollAreaRef.current?.querySelector(
                  "[data-radix-scroll-area-viewport]",
                );
                if (viewport) viewport.scrollTop = 0;
              }, 0);
            }}
            placeholder="Search country..."
          />
          <CommandList>
            <ScrollArea ref={scrollAreaRef} className="h-72">
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {options.map(({ value, label }) => (
                  <CommandItem
                    key={value}
                    className="gap-2"
                    onSelect={() => {
                      onChange(value);
                      setIsOpen(false);
                    }}
                  >
                    <FlagComponent country={value} countryName={label} />
                    <span className="flex-1 text-sm">{label}</span>
                    <span className="text-sm text-muted-foreground uppercase">
                      {value}
                    </span>
                    <CheckIcon
                      className={`ml-auto size-4 ${
                        value === selectedCountry ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

interface FlagProps {
  country: string;
  countryName: string;
}

const FlagComponent = ({ country, countryName }: FlagProps) => {
  const Flag = flags[country.toUpperCase() as keyof typeof flags];

  return (
    <span className="flex h-4 w-6 overflow-hidden rounded-sm bg-foreground/20 [&_svg:not([class*='size-'])]:size-full">
      {Flag && <Flag title={countryName} />}
    </span>
  );
};
