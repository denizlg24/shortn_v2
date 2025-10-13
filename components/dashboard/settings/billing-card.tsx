"use client";

import {
  postcodeValidatorExistsForCountry,
  postcodeValidator,
} from "postcode-validator";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
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
import { Card } from "@/components/ui/card";
import { addMonths, format } from "date-fns";

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
  initialUser,
  initialAddress,
  initialVerification,
  initialPaymentMethods,
  charges,
  hasMoreCharges
}: {
  initialUser: {
    tax_id: string | undefined;
    phone_number: string | undefined;
    stripeId: string;
    plan:{
      subscription:string,
      lastPaid:Date
    }
  };
  initialAddress: Stripe.Address | undefined;
  initialVerification: Stripe.TaxId.Verification | undefined;
  initialPaymentMethods:Stripe.PaymentMethod[],
  charges:Stripe.Charge[],
  hasMoreCharges:boolean
}) => {
  console.log(hasMoreCharges);
  const { refresh, loading } = useUser();
  const [changesLoading, setChangesLoading] = useState(false);
  const [user, setUser] = useState(initialUser);
  const [address, setAddress] = useState(initialAddress);
  const [verification, setVerification] = useState(initialVerification);
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
      await refresh();
      if (updated["tax-id"]) {
        setUser((prev) => ({
          ...prev,
          tax_id: values["tax-id"],
        }));
        const newVerification = await getTaxVerification(user.stripeId);
        setVerification(newVerification);
      }
      if (updated["address"]) {
        setAddress((prev) => ({
          ...prev,
          line1: values.line1,
          line2: values.line2 || null,
          country: values.country,
          postal_code: values.postal_code,
          city: values.city,
          state: null,
        }));
      }
    }
    setChangesLoading(false);
  }

  ///PAYMENT METHODS

  const[paymentMethods] = useState<Stripe.PaymentMethod[]>(initialPaymentMethods);

  useEffect(() => {
    updateBillingForm.reset(
      {
        "tax-id": user.tax_id,
        line1: address?.line1 || "",
        line2: address?.line2 || "",
        city: address?.city || "",
        postal_code: address?.postal_code || "",
        country: address?.country || "",
      },
      {
        keepErrors: true,
        keepDirty: false,
        keepTouched: false,
        keepDirtyValues: false,
      }
    );
  }, [user, address, updateBillingForm]);

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
        <Separator className="my-4" />
        <div className="w-full grid grid-col-2 max-w-xl gap-x-4 gap-y-6">
          <Skeleton className="h-[131px]"/>
          <Skeleton className="h-[131px]"/>
          <Skeleton className="col-span-full h-[131px]"/>
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
      <Separator className="my-4" />
      <div className="grid grid-cols-2 w-full max-w-xl gap-x-4 gap-y-6">
        <Card className="p-0! gap-0!">
          <div className="p-3! rounded-t-xl border bg-muted">
            <h1 className="sm:text-lg text-base font-bold">Payment Methods</h1>
          </div>
          <div className="p-3 bg-background flex flex-col gap-2 w-full rounded-b-xl min-h-[75px]">
            {paymentMethods.length > 0 ? <></>: <p className="text-center w-full font-semibold text-xs my-auto">No payment methods yet.</p>}
          </div>
        </Card>
        <Card className="p-0! gap-0!">
          <div className="p-3! rounded-t-xl border bg-muted">
            <h1 className="sm:text-lg text-base font-bold">Next renewal date</h1>
          </div>
          <div className="p-3 bg-background flex flex-col gap-2 w-full rounded-b-xl min-h-[75px]">
            <p className="text-xs font-normal my-auto text-center">Your <span className="capitalize font-semibold">{user.plan.subscription}</span> plan is set to renew on <span className="font-semibold">{format(addMonths(user.plan.lastPaid,1),"dd/MM/yyyy")}</span>.</p>
          </div>
        </Card>
        <Card className="p-0! gap-0! col-span-full">
          <div className="p-3! rounded-t-xl border bg-muted">
            <h1 className="sm:text-lg text-base font-bold">Payment History</h1>
          </div>
          <div className="p-3 bg-background flex flex-col gap-2 w-full rounded-b-xl min-h-[75px]">
            {charges.length > 0 ? <></>: <p className="text-center w-full font-semibold text-xs my-auto">You haven&apos;t made any payments yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
};
