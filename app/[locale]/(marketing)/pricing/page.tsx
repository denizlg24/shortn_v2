import { Check, MoveRight, X } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import {
  features,
  plans,
  SectionKey,
  TitleKey,
} from "../../dashboard/subscription/page";
import SpotlightCard from "@/components/SpotlightCard";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import DotGrid from "@/components/DotGrid";
import React from "react";

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

export default function Home({
  params,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
}) {
  const { locale } = use<{ locale: string }>(params);
  setRequestLocale(locale);
  return (
    <main className="flex flex-col items-center w-full mx-auto relative">
      <div className="absolute w-full h-full sm:-mt-16 -mt-12 -mx-4 -z-10">
        <div className="relative w-full h-full">
          <DotGrid
            dotSize={4}
            gap={25}
            baseColor="#f1f5f9"
            activeColor="#0f172b"
            proximity={120}
            shockRadius={250}
            shockStrength={5}
            resistance={750}
            returnDuration={1.5}
          />
        </div>
      </div>
      <div className="hover:backdrop-blur-3xl transition-all sm:mt-24 mt-16 mx-auto max-w-4xl text-center w-full px-4 flex flex-col items-center gap-6 z-10">
        <h1 className="md:text-7xl sm:text-6xl xs:text-5xl text-4xl font-black">
          Transparent pricing for businesses of all sizes
        </h1>
        <h2 className="text-lg text-muted-foreground max-w-xl">
          Focus your marketing budget on what matters most — growing your
          business. Handle all marketing essentials with our affordable plans.
        </h2>
      </div>
      <div className="w-full px-2 mx-auto max-w-7xl grid lg:grid-cols-4 sm:grid-cols-2 grid-cols-1 gap-4 gap-y-6 my-12">
        {plans.map((plan) => {
          return (
            <SpotlightCard
              className={`col-span-1 w-full shadow-xl ${
                plan.featured
                  ? "bg-linear-to-br from-[#e6f0ff] to-[#dfeaff] border-primary/30 overflow-visible"
                  : "bg-white"
              } border-border! rounded-lg p-0!`}
              key={plan.id}
              spotlightColor="rgba(171, 255, 252, 0.15)"
            >
              <article key={plan.id} className={`relative h-full p-4`}>
                {plan.featured && (
                  <div className="absolute -top-4 right-4 bg-primary text-white rounded-full px-3 py-1 text-sm font-semibold shadow-sm">
                    Recommended
                  </div>
                )}

                <div className="flex items-baseline justify-between">
                  <div>
                    <h4 className="text-2xl font-bold text-primary">
                      {plan.name}
                    </h4>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-3xl font-extrabold text-primary">
                        {plan.price}
                      </span>
                      <span className="text-muted-foreground">
                        {plan.cadence}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-muted-foreground text-sm">
                    <div>Monthly billing</div>
                    <div className="mt-2">Cancel anytime</div>
                  </div>
                </div>
                <div className="mt-6 flex flex-col items-start gap-1">
                  <Button
                    className="w-full"
                    asChild
                    variant={plan.featured ? "default" : "outline"}
                  >
                    <Link href={"/register"}>
                      Get Started <MoveRight />
                    </Link>
                  </Button>
                  <div className="text-xs text-[#3b4d6b]">
                    Billed monthly. Taxes may apply.
                  </div>
                </div>

                <ul className="mt-6 space-y-3">
                  {plan.highlights.map((h) => (
                    <li
                      key={h}
                      className="flex items-start gap-3 sm:text-sm text-xs"
                    >
                      <Check className="w-4 h-4 shrink-0 text-primary sm:mt-1.25" />
                      <span className="text-primary">{h}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </SpotlightCard>
          );
        })}
      </div>
      <div className="w-full max-w-7xl px-2 mx-auto mt-16 mb-12">
        <div className="hidden sm:grid grid-cols-5 gap-0">
          <div className="col-span-1 top-0 h-full"></div>
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="col-span-1 border shadow p-2 flex flex-col items-center sm:gap-2 gap-0.5 sm:top-14 top-12 bg-background"
            >
              <h1 className="font-semibold text-base text-primary">
                {plan.name}
              </h1>
              <h2 className="text-sm text-muted-foreground text-center min-[375px]:block flex flex-col">
                <span className="text-lg font-bold text-primary">
                  {plan.price}
                </span>
                {plan.cadence}
              </h2>
              <Button
                className="w-full lg:flex hidden"
                asChild
                variant={"outline"}
              >
                <Link href={"/register"}>
                  Get Started <MoveRight />
                </Link>
              </Button>
            </div>
          ))}
          {Object.keys(features).map((sectionKey, i) => {
            const section = sectionKey as SectionKey;
            const sectionData = features[section];
            return (
              <React.Fragment key={section}>
                <div
                  id={i == 0 ? "compare" : ""}
                  className="col-span-full bg-muted p-3 border"
                >
                  <h3 className="text-base font-bold text-primary text-left">
                    {section}
                  </h3>
                </div>
                {Object.keys(sectionData).map((titleKey) => {
                  const title = titleKey as TitleKey<typeof section>;
                  const values = sectionData[title] as string[] | number[];
                  return (
                    <React.Fragment key={title}>
                      <h2 className="bg-background p-3 text-left text-sm font-semibold col-span-1 border">
                        {title}
                      </h2>
                      {values.map((value, i) => {
                        if (typeof value === "number") {
                          return (
                            <div
                              key={i}
                              className="col-span-1 bg-background w-full p-3 text-center flex items-center justify-center border"
                            >
                              {value === 1 ? (
                                <Check className="w-3.5 h-3.5 shrink-0 text-primary" />
                              ) : (
                                <X className="w-3.5 h-3.5 shrink-0 text-primary" />
                              )}
                            </div>
                          );
                        }
                        if (typeof value === "string") {
                          return (
                            <div
                              key={i}
                              className="col-span-1 w-full bg-background p-3 text-center flex items-center justify-center text-sm border"
                            >
                              {value}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>

        <div className="sm:hidden flex flex-col gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="border rounded-lg shadow bg-background"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <h2 className="font-semibold text-lg text-primary">
                    {plan.name}
                  </h2>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-primary">
                      {plan.price}
                    </span>
                    <span className="text-muted-foreground">
                      {plan.cadence}
                    </span>
                  </div>
                </div>
                <Button
                  asChild
                  variant={plan.featured ? "default" : "outline"}
                  size="sm"
                >
                  <Link href="#">
                    Get Started <MoveRight />
                  </Link>
                </Button>
              </div>

              <div className="border-t">
                <Accordion type="single" collapsible>
                  {Object.keys(features).map((sectionKey) => {
                    const section = sectionKey as SectionKey;
                    const sectionData = features[section];
                    return (
                      <AccordionItem
                        className="px-4"
                        key={section}
                        value={section}
                      >
                        <AccordionTrigger>{section}</AccordionTrigger>
                        <AccordionContent>
                          <ul className="flex flex-col gap-2">
                            {Object.keys(sectionData).map((titleKey) => {
                              const title = titleKey as TitleKey<
                                typeof section
                              >;
                              const values = sectionData[title] as
                                | string[]
                                | number[];
                              const planIdx = plans.findIndex(
                                (p) => p.id === plan.id,
                              );
                              const value = values[planIdx];
                              return (
                                <li
                                  key={title}
                                  className="flex items-center justify-between text-sm py-1 border-b last:border-b-0"
                                >
                                  <span>{title}</span>
                                  <span>
                                    {typeof value === "number" ? (
                                      value === 1 ? (
                                        <Check className="w-4 h-4 text-primary inline" />
                                      ) : (
                                        <X className="w-4 h-4 text-primary inline" />
                                      )
                                    ) : (
                                      value
                                    )}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
