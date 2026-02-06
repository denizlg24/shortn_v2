import { Link } from "@/i18n/navigation";
import { Separator } from "@radix-ui/react-separator";
import { TodaysDate } from "./todays-date";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

export const Footer = async () => {
  const t = await getTranslations("footer");
  return (
    <footer className="bg-accent p-4 sm:py-12 py-6 w-full flex flex-col items-center mt-auto">
      <div className="w-full sm:grid sm:gap-4 flex flex-col grid-cols-3 max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 text-sm ">
          <h3 className="font-semibold">{t("shortn")}</h3>
          <Link href={"/"}>{t("home")}</Link>
          <Link href={"/pricing"}>{t("plans-pricing")}</Link>
          <Link href={"/login"}>{t("login")}</Link>
          <Link href={"/register"}>{t("register")}</Link>
        </div>
        <Separator className="sm:hidden block my-6 w-full h-[1px] bg-accent-foreground/25" />
        <div className="flex flex-col gap-4 text-sm">
          <h3 className="font-semibold">{t("platform-products")}</h3>
          <Link href={"/products/url-shortener"}>{t("url-shortener")}</Link>
          <Link href={"/products/qr-code"}>{t("qr-code-generator")}</Link>
          <Link href={"/products/pages"}>{t("pages")}</Link>
          <Link href={"/products/analytics"}>{t("analytics")}</Link>
        </div>
        <Separator className="sm:hidden block my-6 w-full h-[1px] bg-accent-foreground/25" />
        <div className="flex flex-col gap-4 text-sm">
          <h3 className="font-semibold">{t("help-resources")}</h3>
          <Link href={"/help"}>{t("help-center")}</Link>
          <Link href={"/contact"}>{t("contact-us")}</Link>
          <Link href={"/about"}>{t("about-us")}</Link>
        </div>
      </div>
      <Separator className="mt-6 mb-6 w-full h-[1px] bg-accent-foreground/25 max-w-7xl" />
      <div className="w-full max-w-7xl text-sm flex sm:flex-row flex-col gap-2 sm:items-center">
        <p>
          &copy;{" "}
          <Suspense fallback={<>2025</>}>
            <TodaysDate />
          </Suspense>{" "}
          Shortn.at
        </p>
        <div className="w-[2px] h-[2px] bg-accent-foreground rounded-full sm:block hidden"></div>
        <Link href={"/terms"}>{t("terms-conditions")}</Link>
        <div className="w-[2px] h-[2px] bg-accent-foreground rounded-full sm:block hidden"></div>
        <Link href={"/privacy"}>{t("privacy")}</Link>
      </div>
    </footer>
  );
};
