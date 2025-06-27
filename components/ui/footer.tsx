import { Link } from "@/i18n/navigation";
import { Separator } from "@radix-ui/react-separator";

export const Footer = () => {
  return (
    <footer className="bg-accent p-4 sm:py-12 py-6 w-full flex flex-col items-center mt-auto">
      <div className="w-full sm:grid sm:gap-4 flex flex-col grid-cols-3 max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 text-sm ">
          <h3 className="font-semibold">Section 1</h3>
          <Link href={"#"}>Link1</Link>
        </div>
        <Separator className="sm:hidden block my-6 w-full h-[1px] bg-accent-foreground/25" />
        <div className="flex flex-col gap-4 text-sm">
          <h3 className="font-semibold">Section 2</h3>
          <Link href={"#"}>Link2</Link>
        </div>
        <Separator className="sm:hidden block my-6 w-full h-[1px] bg-accent-foreground/25" />
        <div className="flex flex-col gap-4 text-sm">
          <h3 className="font-semibold">Section 3</h3>
          <Link href={"#"}>Link3</Link>
        </div>
      </div>
      <Separator className="mt-6 mb-6 w-full h-[1px] bg-accent-foreground/25 max-w-7xl" />
      <div className="w-full max-w-7xl text-sm flex sm:flex-row flex-col gap-2 sm:items-center">
        <p>&copy; {new Date().getFullYear()} Ocean Informatix</p>
        <div className="w-[2px] h-[2px] bg-accent-foreground rounded-full sm:block hidden"></div>
        <Link href={""}>Terms & conditions</Link>
        <div className="w-[2px] h-[2px] bg-accent-foreground rounded-full sm:block hidden"></div>
        <Link href={""}>Privacy</Link>
      </div>
    </footer>
  );
};
