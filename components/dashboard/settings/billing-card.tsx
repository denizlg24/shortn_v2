"use client";

import {
  postcodeValidatorExistsForCountry,
  postcodeValidator,
} from "postcode-validator";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useState } from "react"; // Removed useEffect
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
import { z } from "zod";
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
import { authClient } from "@/lib/authClient";

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
      },
    ),
  })
  .refine(
    (data) => {
      if (!data.country || !postcodeValidatorExistsForCountry(data.country))
        return true;
      return postcodeValidator(data.postal_code, data.country);
    },
    {
      message: "Invalid postal code for the selected country.",
      path: ["postal_code"],
    },
  );

export const BillingCard = ({
  initialUser,
  initialAddress,
  initialVerification,
  initialPaymentMethods,
  charges,
  hasMoreCharges: _hasMoreCharges,
}: {
  initialUser: {
    tax_id: string | undefined;
    phone_number: string | undefined;
    stripeId: string;
    sub?: string; // Added optional sub if available on initialUser for tracking
    plan: {
      subscription: string;
      lastPaid: Date;
    };
  };
  initialAddress: Stripe.Address | undefined;
  initialVerification: Stripe.TaxId.Verification | undefined;
  initialPaymentMethods: Stripe.PaymentMethod[];
  charges: Stripe.Charge[];
  hasMoreCharges: boolean;
}) => {
  const {
    data: session,
    isPending,
    refetch: refresh,
    isRefetching,
  } = authClient.useSession();

  const sessionUser = session?.user;
  const [changesLoading, setChangesLoading] = useState(false);

  const [user, setUser] = useState(initialUser);
  const [address, setAddress] = useState(initialAddress);
  const [verification, setVerification] = useState(initialVerification);

  const updateBillingForm = useForm<z.infer<typeof updateBillingSchema>>({
    resolver: zodResolver(updateBillingSchema),
    defaultValues: {
      "tax-id": initialUser.tax_id || "",
      line1: initialAddress?.line1 || "",
      line2: initialAddress?.line2 || "",
      city: initialAddress?.city || "",
      postal_code: initialAddress?.postal_code || "",
      country: initialAddress?.country || "",
    },
  });

  const { isDirty } = updateBillingForm.formState;

  async function onSubmit(values: z.infer<typeof updateBillingSchema>) {
    if (!user) return;
    setChangesLoading(true);

    const updateField = async (
      field: "tax-id",
      updater: (
        stripeId: string,
        value: string,
      ) => Promise<{ success: boolean; message: string | null }>,
      errorMessages: { invalid: string; server: string },
    ): Promise<boolean> => {
      if (!updateBillingForm.getFieldState(field).isDirty) return false;

      const { success, message } = await updater(user.stripeId, values[field]);

      if (success) {
        if (sessionUser?.sub) {
          fetch("/api/auth/track-activity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sub: sessionUser.sub,
              type: "tax-id-changed",
              success: true,
            }),
          });
        }
        return true;
      }

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

    if (
      await updateField("tax-id", updateTaxId, {
        invalid: "Your tax ID is not valid.",
        server: "There was a problem updating your tax ID.",
      })
    ) {
      updated["tax-id"] = true;
    }

    const addressFields = [
      "line1",
      "line2",
      "city",
      "country",
      "postal_code",
    ] as const;
    const isAddressDirty = addressFields.some(
      (f) => updateBillingForm.getFieldState(f).isDirty,
    );

    if (isAddressDirty) {
      const { success: addrSuccess, message: addrMessage } =
        await updateUserAddress(user.stripeId, {
          line1: values.line1,
          line2: values.line2,
          country: values.country,
          postal_code: values.postal_code,
          city: values.city,
        });

      if (addrSuccess) {
        if (sessionUser?.sub) {
          fetch("/api/auth/track-activity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sub: sessionUser.sub,
              type: "address-changed",
              success: true,
            }),
          });
        }
        updated["address"] = true;
      } else {
        updateBillingForm.setError("line1", {
          type: "manual",
          message:
            addrMessage === "server-error"
              ? "There was a problem updating your address."
              : "Please provide a valid address for your country.",
        });
      }
    }

    if (Object.keys(updated).length > 0) {
      toast.success("Your profile has been updated!");
      await refresh();

      let newVerification = verification;
      const newUser = { ...user };
      const newAddress = { ...address };

      if (updated["tax-id"]) {
        newUser.tax_id = values["tax-id"];
        newVerification = await getTaxVerification(user.stripeId);
      }

      if (updated["address"] || isAddressDirty) {
        newAddress!.line1 = values.line1;
        newAddress!.line2 = values.line2 || null;
        newAddress!.country = values.country;
        newAddress!.postal_code = values.postal_code;
        newAddress!.city = values.city;
      }

      setUser(newUser);
      setVerification(newVerification);
      setAddress(newAddress as Stripe.Address);

      updateBillingForm.reset({
        "tax-id": newUser.tax_id || "",
        line1: newAddress?.line1 || "",
        line2: newAddress?.line2 || "",
        city: newAddress?.city || "",
        postal_code: newAddress?.postal_code || "",
        country: newAddress?.country || "",
      });
    }
    setChangesLoading(false);
  }

  const [paymentMethods] = useState<Stripe.PaymentMethod[]>(
    initialPaymentMethods,
  );

  if ((isPending || isRefetching) && !user) {
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
          {/* Skeleton Items */}
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex flex-col gap-1 w-full col-span-1">
              <Skeleton className="w-[25%] col-span-1 h-4 rounded bg-muted-foreground!" />
              <Skeleton className="w-full col-span-1 h-8 rounded bg-muted-foreground!" />
            </div>
          ))}
        </div>
        <Separator className="my-4" />
        <div className="w-full grid grid-col-2 max-w-xl gap-x-4 gap-y-6">
          <Skeleton className="h-[131px]" />
          <Skeleton className="h-[131px]" />
          <Skeleton className="col-span-full h-[131px]" />
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
            {isDirty && (
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
                    updateBillingForm.reset({
                      "tax-id": user.tax_id || "",
                      line1: address?.line1 || "",
                      line2: address?.line2 || "",
                      city: address?.city || "",
                      postal_code: address?.postal_code || "",
                      country: address?.country || "",
                    });
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
      <div className="grid w-full max-w-xl gap-x-4 gap-y-6">
        <Card className="p-0! gap-0!">
          <div className="p-3! rounded-t-xl border bg-muted">
            <h1 className="sm:text-lg text-base font-bold">
              Next renewal date
            </h1>
          </div>
          <div className="p-3 bg-background flex flex-col gap-2 w-full rounded-b-xl min-h-[75px]">
            <p className="text-xs font-normal my-auto text-center">
              Your{" "}
              <span className="capitalize font-semibold">
                {user.plan.subscription}
              </span>{" "}
              plan is set to renew on{" "}
              <span className="font-semibold">
                {format(addMonths(user.plan.lastPaid, 1), "dd/MM/yyyy")}
              </span>
              .
            </p>
          </div>
        </Card>
        <Card className="p-0! gap-0!">
          <div className="p-3! rounded-t-xl border bg-muted">
            <h1 className="sm:text-lg text-base font-bold">Payment Methods</h1>
          </div>
          <div className="p-3 bg-background flex flex-col gap-2 w-full rounded-b-xl min-h-[75px]">
            {paymentMethods.length > 0 ? (
              <div className="flex flex-col gap-2">
                {paymentMethods.map((pm) => (
                  <PaymentMethodItem key={pm.id} pm={pm} />
                ))}
              </div>
            ) : (
              <p className="text-center w-full font-semibold text-xs my-auto">
                No payment methods yet.
              </p>
            )}
          </div>
        </Card>
        <Card className="p-0! gap-0! col-span-full">
          <div className="p-3! rounded-t-xl border bg-muted">
            <h1 className="sm:text-lg text-base font-bold">Payment History</h1>
          </div>
          <div className="p-3 bg-background flex flex-col gap-2 w-full rounded-b-xl min-h-[75px]">
            {charges.length > 0 ? (
              <div className="flex flex-col gap-2">
                {charges.map((ch) => (
                  <ChargeItem key={ch.id} ch={ch} />
                ))}
              </div>
            ) : (
              <p className="text-center w-full font-semibold text-xs my-auto">
                You haven&apos;t made any payments yet.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

const ChargeItem = ({ ch }: { ch: Stripe.Charge }) => {
  const created = new Date((ch.created ?? 0) * 1000);
  const amount = (ch.amount / 100).toFixed(2);
  const currency = (ch.currency || "usd").toUpperCase();
  const status = ch.status ?? "unknown";
  //const receiptUrl = ch.receipt_url ?? undefined;

  const pmType = ch.payment_method_details?.type;
  const brand = ch.payment_method_details?.card?.brand;
  const last4 = ch.payment_method_details?.card?.last4;
  const sourceLabel =
    pmType === "card"
      ? `${brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : "Card"}${last4 ? " •••• " + last4 : ""}`
      : pmType
        ? pmType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : (ch.payment_method ?? "Payment");

  const statusColor =
    status === "succeeded"
      ? "text-green-600"
      : status === "pending"
        ? "text-amber-600"
        : status === "failed"
          ? "text-red-600"
          : "text-muted-foreground";

  return (
    <div className="w-full border rounded-lg p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">
            {amount} {currency}
          </span>
          <span className="text-xs text-muted-foreground">
            {format(created, "dd/MM/yyyy HH:mm")}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className={`text-xs ${statusColor}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {ch.paid === false ? " (Unpaid)" : ""}
          </span>
          {sourceLabel && (
            <span className="text-xs text-muted-foreground">{sourceLabel}</span>
          )}
        </div>
      </div>
    </div>
  );
};

const PaymentMethodItem = ({ pm }: { pm: Stripe.PaymentMethod }) => {
  const type = pm.type;

  const getBrandLabel = () => {
    if (type === "card") {
      const brand = pm.card?.brand ?? "card";
      return brand.charAt(0).toUpperCase() + brand.slice(1);
    }
    if (type === "us_bank_account") return "US Bank";
    if (type === "sepa_debit") return "SEPA Debit";
    if (type === "bacs_debit") return "BACS Debit";
    if (type === "acss_debit") return "ACSS Debit";
    if (type === "au_becs_debit") return "AU BECS";
    if (type === "bancontact") return "Bancontact";
    if (type === "ideal") return "iDEAL";
    if (type === "sofort") return "Sofort";
    if (type === "giropay") return "Giropay";
    if (type === "p24") return "Przelewy24";
    if (type === "affirm") return "Affirm";
    if (type === "afterpay_clearpay") return "Afterpay";
    if (type === "klarna") return "Klarna";
    if (type === "paypal") return "PayPal";
    if (type === "cashapp") return "Cash App";
    if (type === "link") return "Link";
    return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getLast4 = () => {
    if (type === "card")
      return pm.card?.last4 ? `•••• ${pm.card.last4}` : undefined;
    if (type === "us_bank_account")
      return pm.us_bank_account?.last4
        ? `•••• ${pm.us_bank_account.last4}`
        : undefined;
    if (type === "sepa_debit")
      return pm.sepa_debit?.last4 ? `•••• ${pm.sepa_debit.last4}` : undefined;
    return undefined;
  };

  const getExp = () => {
    if (type === "card" && pm.card?.exp_month && pm.card?.exp_year) {
      return `${pm.card.exp_month.toString().padStart(2, "0")}/${(pm.card.exp_year % 100).toString().padStart(2, "0")}`;
    }
    return undefined;
  };

  const badge = getBrandLabel();
  const last4 = getLast4();
  const exp = getExp();

  return (
    <div className="w-full border rounded-lg p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-6 rounded bg-muted flex items-center justify-center text-xs font-semibold uppercase">
          {type === "card"
            ? (pm.card?.brand ?? "Card").slice(0, 4)
            : type.slice(0, 4)}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{badge}</span>
          <span className="text-xs text-muted-foreground">
            {last4 ?? pm.id}
          </span>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {exp && <span>Exp {exp}</span>}
      </div>
    </div>
  );
};
