import Image from "next/image";
import illust from "@/public/404_illustration.svg";
import { Link } from "@/i18n/navigation";

export default async function Forbidden() {
  return (
    <main className="w-full flex flex-col items-center max-w-7xl px-4 mx-auto">
      <div className="w-full max-w-4xl md:grid flex flex-col grid-cols-3 my-12 md:gap-4 gap-6">
        <div className="col-span-2 w-full flex flex-col md:items-start items-center md:text-left text-center gap-4">
          <h1 className="font-bold text-4xl">Oops!</h1>
          <h2 className="text-xl">
            You do not have permission to access this page.
          </h2>
          <p>Error code: 403</p>
          <div className="flex flex-col gap-1 text-sm">
            <p>Here are some helpful links instead:</p>
            <Link className="text-primary" href={"/"}>
              Home
            </Link>
            <Link className="text-primary" href={"/pricing"}>
              Pricing
            </Link>
            <Link className="text-primary" href={"/help"}>
              Help
            </Link>
          </div>
        </div>
        <div className="col-span-1 w-full relative min-h-[250px]">
          <Image src={illust} alt="404 illustration" fill />
        </div>
      </div>
    </main>
  );
}
