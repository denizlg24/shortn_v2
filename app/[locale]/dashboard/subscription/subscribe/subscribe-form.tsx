"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useEffect, useState, useCallback } from "react";
import { loadStripe, StripeCheckoutTaxIdType } from "@stripe/stripe-js";
import {
  BillingAddressElement,
  CheckoutProvider,
  PaymentElement,
  StripeCheckoutValue,
  TaxIdElement,
  useCheckout,
} from "@stripe/react-stripe-js/checkout";
import { User } from "next-auth";
import Stripe from "stripe";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ok } from "assert";
import { Separator } from "@/components/ui/separator";
import { Check, Loader2, Tag, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { useUser } from "@/utils/UserContext";
import { PhoneInput } from "@/components/ui/phone-input";
import { isValidPhoneNumber } from "react-phone-number-input";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!, {
  betas: ["custom_checkout_tax_id_1"],
});

export const SubscribeForm = ({
  tier,
  user,
  address,
  className,
}: {
  user: User;
  address: Stripe.Address | undefined;
  tier: "pro" | "plus" | "basic";
  className?: string;
}) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const createSession = useCallback(async () => {
    const res = await fetch("/api/stripe/create-subscription-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    const data = await res.json();
    if (data.success) {
      setClientSecret((prev) =>
        prev === data.clientSecret ? prev : data.clientSecret,
      );
    }
  }, [tier]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (clientSecret) return;
      await createSession();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [createSession, clientSecret]);

  if (!clientSecret) {
    return (
      <div className="w-full max-w-7xl lg:grid grid-cols-5 flex flex-col-reverse items-start gap-x-8 gap-y-8">
        <Skeleton
          className={cn(
            "w-full col-span-3 p-2 bg-muted-foreground/35! min-h-[50vh]",
            className,
          )}
        />
        <Skeleton
          className={cn(
            "w-full col-span-2 p-2 bg-muted-foreground/35! min-h-[50vh]",
            className,
          )}
        />
      </div>
    );
  }

  return (
    <CheckoutProvider
      stripe={stripePromise}
      options={{
        clientSecret: clientSecret,
        elementsOptions: {
          savedPaymentMethod: {
            enableSave: "auto",
            enableRedisplay: "auto",
          },
          fonts: [
            {
              family: "Geist Sans",
              src: "url('/fonts/Geist[wght].ttf') format('truetype')",
              display: "swap",
              style: "normal",
              weight: "400",
            },
          ],
          appearance: {
            variables: {
              colorPrimary: "#0f172b",
            },
          },
        },
      }}
    >
      <div className="w-full max-w-7xl lg:grid grid-cols-5 flex flex-col-reverse items-start gap-x-8 gap-y-8">
        <CustomCheckoutForm
          tier={tier}
          className="col-span-3 min-h-[50vh]"
          user={user}
          address={address}
        />
        <PlanCard tier={tier} className="col-span-2 min-h-[50vh]" />
      </div>
    </CheckoutProvider>
  );
};

const validatePhoneNumber = async ({
  phoneNumber,
  checkout,
}: {
  phoneNumber: string;
  checkout: StripeCheckoutValue;
}) => {
  const valid = isValidPhoneNumber(phoneNumber);
  if (!valid) {
    return { isValid: false, message: "Please provide a valid phone number." };
  }
  const updateResult = await checkout.updatePhoneNumber(phoneNumber);
  if (updateResult.type == "success") {
    return { isValid: true, message: null };
  }
  return { isValid: false, message: "Phone number is invalid" };
};

const validateEmail = async ({
  email,
  checkout,
}: {
  email: string;
  checkout: StripeCheckoutValue;
}) => {
  const updateResult = await checkout.updateEmail(email);
  if (updateResult.type == "success") {
    return { isValid: true, message: null };
  }
  return { isValid: false, message: updateResult.error.message };
};

const CheckoutEmailInput = ({ initialEmail }: { initialEmail: string }) => {
  const checkoutState = useCheckout();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [error, setError] = useState<string | null>("");
  if (checkoutState.type === "loading") {
    return <Skeleton className="w-full h-8" />;
  } else if (checkoutState.type === "error") {
    return;
  }
  const { checkout } = checkoutState;

  const handleBlur = async () => {
    if (!email) {
      return;
    }
    const { isValid, message } = await validateEmail({ email, checkout });
    if (!isValid && message) {
      setError(message);
    }
  };
  const handleChange = (e: string) => {
    setError(null);
    setEmail(e);
  };

  return (
    <div className="w-full flex flex-col gap-1 items-start">
      <p className="font-semibold text-sm text-left">Email address</p>
      <Input
        className={cn(
          "w-full bg-background",
          error && "border-destructive ring-destructive",
        )}
        onBlur={handleBlur}
        onChange={(e) => {
          handleChange(e.target.value);
        }}
        value={email}
        type="email"
      />
      {error && (
        <p className="text-xs font-semibold text-destructive text-left">
          {error}
        </p>
      )}
    </div>
  );
};

const CheckoutPhoneInput = ({
  initialPhoneNumber,
}: {
  initialPhoneNumber: string | undefined;
}) => {
  const checkoutState = useCheckout();
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber ?? "");
  const [error, setError] = useState<string | null>("");
  if (checkoutState.type === "loading") {
    return <Skeleton className="w-full h-8" />;
  } else if (checkoutState.type === "error") {
    return;
  }
  const { checkout } = checkoutState;

  const handleBlur = async () => {
    if (!phoneNumber) {
      return;
    }

    const { isValid, message } = await validatePhoneNumber({
      phoneNumber,
      checkout,
    });
    if (!isValid && message) {
      setError(message);
    }
  };

  const handleChange = (e: string) => {
    setError(null);
    setPhoneNumber(e);
  };

  return (
    <div className="w-full flex flex-col gap-1 items-start">
      <p className="font-semibold text-sm text-left">Phone number</p>
      <PhoneInput
        className={cn("w-full", error && "border-destructive ring-destructive")}
        onBlur={handleBlur}
        onChange={handleChange}
        value={phoneNumber}
        defaultCountry="PT"
      />
      {error && (
        <p className="text-xs font-semibold text-destructive text-left">
          {error}
        </p>
      )}
    </div>
  );
};

const CustomCheckoutForm = ({
  tier,
  user,
  address,
  className,
}: {
  tier: string;
  user: User;
  className?: string;
  address: Stripe.Address | undefined;
}) => {
  const checkoutState = useCheckout();
  const router = useRouter();
  const [needTax, setNeedTax] = useState(false);
  const [elementsReady, setElementsReady] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const { refresh } = useUser();
  if (checkoutState.type === "loading") {
    return (
      <Skeleton
        className={cn("w-full p-2 bg-muted-foreground/35!", className)}
      />
    );
  }
  if (checkoutState.type === "error") {
    return <div>Error: {checkoutState.error.message}</div>;
  }

  const confirmCheckout = async () => {
    try {
      setError("");
      setConfirming(true);
      const response = await checkoutState.checkout.confirm({
        redirect: "if_required",
        returnUrl: `${BASEURL}/dashboard/subscription/redirect`,
        phoneNumber: user.phone_number,
        savePaymentMethod: true,
      });
      if (response.type == "success") {
        await refresh();
        const tokenRes = await fetch("/api/stripe/subscription-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: tier, type: "subscribe" }),
        });
        const { token } = await tokenRes.json();
        router.push(`/dashboard/subscription/upgraded?token=${token}`);
      } else {
        console.log(response.error.message);
        setError(response.error.message);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className={cn("w-full flex flex-col gap-4", className)}>
      <div className="w-full flex flex-col gap-2 items-start">
        <p className="text-lg font-semibold text-left">Your Information</p>
        <Skeleton className="w-full bg-muted-foreground! h-[1px]" />
      </div>
      <BillingAddressElement
        onReady={() => {
          setElementsReady(true);
        }}
        options={{
          contacts: address
            ? [
                {
                  name: user.displayName,
                  address: {
                    line1: address.line1 ?? "",
                    line2: address.line2 ?? undefined,
                    city: address.city ?? "",
                    state: address.state ?? "",
                    postal_code: address.postal_code ?? "",
                    country: address.country ?? "",
                  },
                },
              ]
            : [],
        }}
      />
      {elementsReady && <CheckoutEmailInput initialEmail={user.email} />}
      {elementsReady && (
        <CheckoutPhoneInput initialPhoneNumber={user.phone_number} />
      )}
      {elementsReady && (
        <div className="w-full flex flex-row items-center justify-start gap-2">
          <Switch checked={needTax} onCheckedChange={(c) => setNeedTax(c)} />
          <p className="font-semibold text-sm text-left">
            Include company information on invoice
          </p>
        </div>
      )}

      {needTax && (
        <TaxIdElement
          onChange={(e) => {
            if (e.complete) {
              checkoutState.checkout.updateTaxIdInfo({
                taxId: {
                  value: e.value.taxId,
                  type: e.value.taxIdType as StripeCheckoutTaxIdType,
                },
                businessName: e.value.businessName,
              });
            }
          }}
          options={{
            visibility: "auto",
          }}
          onLoadError={(e) => {
            console.log(e);
          }}
        />
      )}
      <div className="w-full flex flex-col gap-2 items-start">
        <p className="text-lg font-semibold text-left">Payment Details</p>
        <Skeleton className="w-full bg-muted-foreground! h-[1px]" />
      </div>
      <PaymentElement
        options={{
          layout: "tabs",
          terms: { applePay: "auto", googlePay: "auto", card: "auto" },
        }}
      />
      {elementsReady && (
        <Button
          onClick={() => {
            confirmCheckout();
          }}
          disabled={
            confirming ||
            checkoutState.checkout.tax.status != "ready" ||
            !checkoutState.checkout.canConfirm
          }
        >
          {confirming ? (
            <>
              <Loader2 className="animate-spin" /> Confirming...
            </>
          ) : checkoutState.checkout.tax.status == "ready" ? (
            <>
              <span className="capitalize font-bold">
                Upgrade to {tier} &mdash;
              </span>
              <span className="text-primary-foreground/50 text-xs">
                Cancel anytime. {checkoutState.checkout.total.total.amount}*
              </span>
            </>
          ) : (
            <>
              <Loader2 className="animate-spin" /> Loading...
            </>
          )}
        </Button>
      )}
      {error && (
        <p className="text-xs font-semibold text-destructive">{error}</p>
      )}
    </div>
  );
};

const PlanCard = ({
  tier,
  className,
}: {
  tier: string;
  className?: string;
}) => {
  const checkoutState = useCheckout();
  const [draftDiscount, setDraftDiscount] = useState("");
  const [discountError, setDiscountError] = useState("");
  const [applying, setApplying] = useState(false);
  const [hasPromo, setHasPromo] = useState(false);
  if (checkoutState.type === "loading") {
    return (
      <Skeleton
        className={cn("w-full p-2 bg-muted-foreground/35!", className)}
      />
    );
  }
  if (checkoutState.type === "error") {
    return <div>Error: {checkoutState.error.message}</div>;
  }
  const plans = [
    {
      id: "basic",
      name: "Basic",
      highlights: [
        "25 shortn.at links / month",
        "25 QR Codes / month",
        "Click and scan count",
      ],
    },
    {
      id: "plus",
      name: "Plus",
      highlights: [
        "50 shortn.at links / month",
        "50 QR Codes / month",
        "Click and scan count",
        "Time and date based analytics",
        "City level location data",
      ],
    },
    {
      id: "pro",
      name: "Pro",
      highlights: [
        "Unlimited shortn.at links and QR Codes",
        "Click and scan count",
        "Time and date based analytics",
        "City level location data",
        "Browser, Device and OS insights",
        "Referer information",
      ],
    },
  ];
  const plan = plans.find((p) => p.id == tier);
  ok(plan);
  const { applyPromotionCode, removePromotionCode } = checkoutState.checkout;
  const submitPromoCode = async () => {
    setApplying(true);
    const result = await applyPromotionCode(draftDiscount);
    if (result.type == "success") {
      setHasPromo(true);
    } else {
      setDiscountError(result.error.message);
      setDraftDiscount("");
    }
    setApplying(false);
  };

  const removePromoCode = async () => {
    await removePromotionCode();
    setHasPromo(false);
    setDraftDiscount("");
    setDiscountError("");
  };

  const discount =
    (checkoutState.checkout.discountAmounts?.length ?? 0) == 1
      ? checkoutState.checkout.discountAmounts![0]
      : undefined;
  return (
    <Card
      className={cn("w-full sm:py-6! py-4! gap-4! sm:px-6 px-4", className)}
    >
      <CardHeader className="flex flex-col sm:gap-4 gap-2 p-0!">
        <CardTitle className="w-full text-lg font-bold">
          Payment Summary
        </CardTitle>
      </CardHeader>
      <Separator className="w-full" />
      <CardContent className="flex flex-col gap-2 p-0!">
        <p className="text-base font-semibold capitalize">
          Monthly <span className="font-bold underline">{tier}</span> Plan
        </p>
        <ul className="space-y-2">
          {plan.highlights.map((h) => (
            <li key={h} className="flex items-start gap-3 sm:text-sm text-xs">
              <Check className="w-4 h-4 shrink-0 text-primary sm:mt-1.25" />
              <span className="text-primary">{h}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <Separator className="w-full" />
      {checkoutState.checkout.tax.status == "ready" ? (
        <CardFooter className="w-full flex flex-col gap-2 p-0! items-start">
          <p className="text-base font-semibold capitalize">
            Pricing Breakdown
          </p>
          <div className="w-full flex flex-row justify-between items-center">
            <p className="text-sm text-left">Subtotal</p>
            <p className="text-sm font-semibold text-right">
              {checkoutState.checkout.total.subtotal.amount}
            </p>
          </div>
          {checkoutState.checkout.discountAmounts &&
            checkoutState.checkout.discountAmounts.map((discount) => {
              return (
                <div
                  key={discount.displayName}
                  className="w-full flex flex-row justify-between items-center"
                >
                  <p className="px-2 py-1 bg-muted relative flex flex-row items-center rounded text-sm">
                    <Tag className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <span className="font-semibold ml-1 mr-3">
                      {discount.promotionCode}
                    </span>
                    <X
                      onClick={() => {
                        removePromoCode();
                      }}
                      className="w-3.5 h-3.5 shrink-0 text-muted-foreground hover:text-primary hover:cursor-pointer"
                    />
                  </p>
                  <p className="text-sm font-semibold text-right text-muted-foreground">
                    -{discount.amount}
                  </p>
                </div>
              );
            })}
          {checkoutState.checkout.taxAmounts?.map((tax) => (
            <div
              key={tax.displayName}
              className="w-full flex flex-row justify-between items-center"
            >
              <p className="text-sm text-left">{tax.displayName}</p>
              <p className="text-sm font-semibold text-right">{tax.amount}</p>
            </div>
          ))}
          {!hasPromo && (
            <>
              <div className="flex flex-col gap-1 items-start w-full">
                <p className="text-sm text-left">Have a promo code?</p>
                <div className="w-full flex flex-row items-center gap-1">
                  <Input
                    disabled={applying}
                    value={draftDiscount}
                    onChange={(e) => {
                      setDiscountError("");
                      setDraftDiscount(e.target.value);
                    }}
                    className="grow"
                  />
                  <Button
                    onClick={submitPromoCode}
                    disabled={applying}
                    className="w-fit!"
                  >
                    {applying ? (
                      <>
                        <Loader2 className="animate-spin" /> Applying
                      </>
                    ) : (
                      <>Apply</>
                    )}
                  </Button>
                </div>
                {discountError && (
                  <p className="text-xs font-semibold text-destructive">
                    {discountError}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="w-full flex flex-row justify-between items-center">
            <p className="text-sm text-left font-semibold">Total</p>
            <p className="text-sm font-bold text-right">
              {checkoutState.checkout.total.total.amount}
            </p>
          </div>
          <Separator />
          {!discount && (
            <p className="text-xs text-muted-foreground italic">
              *You&apos;ll be charged{" "}
              {checkoutState.checkout.total.total.amount} monthly until you
              cancel your subscription.
            </p>
          )}
          {discount && !discount.recurring && (
            <p className="text-xs text-muted-foreground italic">
              *You&apos;ll be charged{" "}
              {checkoutState.checkout.total.total.amount} now and then{" "}
              {checkoutState.checkout.total.subtotal.amount} + TAX monthly until
              you cancel your subscription
            </p>
          )}
          {discount?.recurring?.type == "repeating" && (
            <p className="text-xs text-muted-foreground italic">
              *You&apos;ll be charged{" "}
              {checkoutState.checkout.total.total.amount}{" "}
              {discount.recurring.durationInMonths == 1
                ? `now and then ${checkoutState.checkout.total.subtotal.amount} + TAX monthly until
            you cancel your subscription.`
                : `for the next ${discount.recurring.durationInMonths} months and then ${checkoutState.checkout.total.subtotal.amount} + TAX monthly until
            you cancel your subscription.`}
            </p>
          )}
          {discount?.recurring?.type == "forever" && (
            <p className="text-xs text-muted-foreground italic">
              *You&apos;ll be charged{" "}
              {checkoutState.checkout.total.total.amount} monthly until you
              cancel your subscription.
            </p>
          )}
        </CardFooter>
      ) : (
        <CardFooter className="w-full flex flex-col gap-2 p-0! items-start">
          <Skeleton className="w-full h-[150px]" />
        </CardFooter>
      )}
    </Card>
  );
};
