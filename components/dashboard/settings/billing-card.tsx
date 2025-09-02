"use client";

import {
  postcodeValidatorExistsForCountry,
  postcodeValidator,
} from "postcode-validator";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, ClockFading, Loader2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import z from "zod";
import { useUser } from "@/utils/UserContext";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getTaxVerification,
  updateTaxId,
  updateUserAddress,
} from "@/app/actions/stripeActions";
import { TaxIdInput } from "@/components/ui/tax-id-input";
import { toast } from "sonner";
import { checkVAT, countries } from "jsvat";
import Stripe from "stripe";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { CountryDropdown } from "@/components/ui/country-dropdown";

const updateBillingSchema = z
  .object({
    country: z
      .string()
      .length(2, { message: "Country must be a valid 2-letter ISO code." }),
    line1: z.string().min(1, { message: "Address line 1 is required." }),
    line2: z.string().optional(),
    city: z.string().min(1, { message: "City is required." }),
    postal_code: z.string().min(1, { message: "Postal code is required." }),
    "tax-id": z.string().refine(
      (val) => {
        if (val) {
          return checkVAT(val, countries).isValid;
        }
        return true;
      },
      {
        message: "Must be a valid tax number",
      }
    ),
  })
  .refine(
    (data) => {
      if (!postcodeValidatorExistsForCountry(data.country)) return false;
      return postcodeValidator(data.postal_code, data.country);
    },
    {
      message: "Invalid postal code for the selected country.",
      path: ["postal_code"],
    }
  );

export const BillingCard = ({
  user,
  address,
  verification,
}: {
  user: {
    tax_id: string | undefined;
    phone_number: string | undefined;
    stripeId: string;
  };
  address: Stripe.Address | undefined;
  verification: Stripe.TaxId.Verification | undefined;
}) => {
  const { refresh, loading } = useUser();
  const [changesLoading, setChangesLoading] = useState(false);
  const updateBillingForm = useForm<z.infer<typeof updateBillingSchema>>({
    resolver: zodResolver(updateBillingSchema),
    defaultValues: {
      "tax-id": user.tax_id || "",
      line1: address?.line1 || "",
      line2: address?.line2 || "",
      city: address?.city || "",
      postal_code: address?.postal_code || "",
      country: address?.country || "",
    },
  });

  async function onSubmit(values: z.infer<typeof updateBillingSchema>) {
    if (!user) {
      return;
    }
    setChangesLoading(true);

    const updateField = async (
      field: "tax-id",
      updater: (
        stripeId: string,
        value: string
      ) => Promise<{ success: boolean; message: string | null }>,
      errorMessages: { invalid: string; server: string }
    ): Promise<boolean> => {
      if (!updateBillingForm.getFieldState(field).isDirty) return false;

      const { success, message } = await updater(user.stripeId, values[field]);

      if (success) return true;

      updateBillingForm.setError(field, {
        type: "manual",
        message:
          message === "server-error"
            ? errorMessages.server
            : errorMessages.invalid,
      });

      return false;
    };

    const updated: Record<string, boolean> = {};

    // --- Tax ID
    if (
      await updateField("tax-id", updateTaxId, {
        invalid: "Your tax ID is not valid.",
        server: "There was a problem updating your tax ID.",
      })
    ) {
      updated["tax-id"] = true;
      user.tax_id = values["tax-id"];
      verification = await getTaxVerification(user.stripeId);
    }

    // --- Address
    const { success: addrSuccess, message: addrMessage } =
      await updateUserAddress(user.stripeId, {
        line1: values.line1,
        line2: values.line2,
        country: values.country,
        postal_code: values.postal_code,
        city: values.city,
      });

    if (addrSuccess) {
      address = {
        line1: values.line1,
        line2: values.line2 || null,
        country: values.country,
        postal_code: values.postal_code,
        city: values.city,
        state: null,
      };
      updated["address"] = true;
    } else {
      // Attach error to postal_code (main culprit), but you could spread to all
      updateBillingForm.setError("line1", {
        type: "manual",
        message:
          addrMessage === "server-error"
            ? "There was a problem updating your address."
            : "Please provide a valid address for your country.",
      });
    }

    // --- Handle success/failure
    if (Object.keys(updated).length > 0) {
      toast.success("Your profile has been updated!");

      // Build reset values: keep failed fields as-is
      const resetValues = {
        "tax-id": updated["tax-id"] ? values["tax-id"] : values["tax-id"],
        line1: values.line1,
        line2: values.line2,
        country: values.country,
        postal_code: values.postal_code,
        city: values.city,
      };

      updateBillingForm.reset(resetValues, {
        keepErrors: true,
        keepDirty: false,
        keepTouched: true,
      });

      await refresh();
    }
    setChangesLoading(false);
  }

  if (loading) {
    return (
      <div className="w-full flex flex-col">
        <h1 className="lg:text-xl md:text-lg sm:text-base text-sm font-semibold">
          Billing Details
        </h1>
        <h2 className="lg:text-base sm:text-sm text-xs text-muted-foreground">
          Update your billing details here.
        </h2>
        <Separator className="my-4" />
        <div className="grid sm:grid-cols-2 grid-cols-1 max-w-xl gap-x-8 gap-y-4 w-full my-4 items-start">
          <div className="flex flex-col gap-1 w-full col-span-1">
            <Skeleton className="w-[25%] col-span-1 h-4 rounded bg-muted-foreground!" />
            <Skeleton className="w-full col-span-1 h-8 rounded bg-muted-foreground!" />
          </div>
          <div className="flex flex-col gap-1 w-full col-span-1">
            <Skeleton className="w-[25%] col-span-1 h-4 rounded bg-muted-foreground!" />
            <Skeleton className="w-full col-span-1 h-8 rounded bg-muted-foreground!" />
          </div>
          <div className="flex flex-col gap-1 w-full col-span-1">
            <Skeleton className="w-[25%] col-span-1 h-4 rounded bg-muted-foreground!" />
            <Skeleton className="w-full col-span-1 h-8 rounded bg-muted-foreground!" />
          </div>
          <div className="flex flex-col gap-1 w-full col-span-1">
            <Skeleton className="w-[25%] col-span-1 h-4 rounded bg-muted-foreground!" />
            <Skeleton className="w-full col-span-1 h-8 rounded bg-muted-foreground!" />
          </div>
          <div className="flex flex-col gap-1 w-full col-span-1">
            <Skeleton className="w-[25%] col-span-1 h-4 rounded bg-muted-foreground!" />
            <Skeleton className="w-full col-span-1 h-8 rounded bg-muted-foreground!" />
          </div>
          <div className="flex flex-col gap-1 w-full col-span-1">
            <Skeleton className="w-[25%] col-span-1 h-4 rounded bg-muted-foreground!" />
            <Skeleton className="w-full col-span-1 h-8 rounded bg-muted-foreground!" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col">
      <h1 className="lg:text-xl md:text-lg sm:text-base text-sm font-semibold">
        Billing Details
      </h1>
      <h2 className="lg:text-base sm:text-sm text-xs text-muted-foreground">
        Update your billing details here.
      </h2>
      <Separator className="my-4" />
      <Form {...updateBillingForm}>
        <form
          onSubmit={updateBillingForm.handleSubmit(onSubmit)}
          className="grid sm:grid-cols-2 grid-cols-1 max-w-xl gap-x-8 gap-y-4 w-full my-4 items-start"
        >
          <FormField
            control={updateBillingForm.control}
            name="line1"
            render={({ field }) => (
              <FormItem className="relative">
                <FormLabel className="gap-1">Address Line</FormLabel>
                <FormControl>
                  <Input className="bg-background" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={updateBillingForm.control}
            name="line2"
            render={({ field }) => (
              <FormItem className="relative">
                <FormLabel className="gap-1">Address Line 2</FormLabel>
                <FormControl>
                  <Input className="bg-background" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={updateBillingForm.control}
            name="city"
            render={({ field }) => (
              <FormItem className="relative">
                <FormLabel className="gap-1">City</FormLabel>
                <FormControl>
                  <Input className="bg-background" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={updateBillingForm.control}
            name="country"
            render={({ field }) => (
              <FormItem className="relative">
                <FormLabel className="gap-1">Country</FormLabel>
                <FormControl>
                  <CountryDropdown
                    {...field}
                    defaultValue={field.value}
                    onChange={(country) => {
                      field.onChange(country.alpha2);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={updateBillingForm.control}
            name="postal_code"
            render={({ field }) => (
              <FormItem className="relative">
                <FormLabel className="gap-1">Postal Code</FormLabel>
                <FormControl>
                  <Input className="bg-background" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={updateBillingForm.control}
            name="tax-id"
            render={({ field }) => (
              <FormItem className="relative">
                <FormLabel className="gap-1">Tax Number</FormLabel>
                <FormControl>
                  <TaxIdInput {...field} />
                </FormControl>
                {verification && (
                  <div className="absolute top-8 right-2 z-10">
                    {verification.status == "verified" && (
                      <HoverCard>
                        <HoverCardTrigger>
                          <CheckCircle className="text-green-600 w-4 h-4" />
                        </HoverCardTrigger>
                        <HoverCardContent className="p-2 text-sm w-fit">
                          <p>Tax number verified.</p>
                        </HoverCardContent>
                      </HoverCard>
                    )}
                    {verification.status == "pending" && (
                      <HoverCard>
                        <HoverCardTrigger>
                          <ClockFading className="text-amber-600 w-4 h-4" />
                        </HoverCardTrigger>
                        <HoverCardContent className="p-2 text-sm w-fit">
                          <p>Tax number pending.</p>
                        </HoverCardContent>
                      </HoverCard>
                    )}
                    {verification.status == "unverified" && (
                      <HoverCard>
                        <HoverCardTrigger>
                          <AlertCircle className="text-red-600 w-4 h-4" />
                        </HoverCardTrigger>
                        <HoverCardContent className="p-2 text-sm w-fit">
                          <p>Tax number not verified.</p>
                        </HoverCardContent>
                      </HoverCard>
                    )}
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid xs:grid-cols-2 grid-cols-1 w-full col-span-full gap-6 gap-y-2">
            {updateBillingForm.formState.isDirty && (
              <>
                <Button disabled={changesLoading}>
                  {changesLoading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>Save Changes</>
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    updateBillingForm.reset();
                  }}
                  variant={"outline"}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
};
