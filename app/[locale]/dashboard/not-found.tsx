import Image from "next/image";
import illust from "@/public/404_illustration.svg";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  return (
    <main className="w-full flex flex-col items-center max-w-7xl px-4 mx-auto">
      <div className="w-full max-w-4xl md:grid flex flex-col grid-cols-3 my-12 md:gap-4 gap-6">
        <div className="col-span-2 w-full flex flex-col md:items-start items-center md:text-left text-center gap-4">
          <h1 className="font-bold text-4xl">Oops!</h1>
          <h2 className="text-xl">
            We can't seem to find the resource you're looking for.
          </h2>
          <p>Error code: 404</p>
          <div className="flex flex-col gap-1 text-sm">
            <p>Here are some helpful links instead:</p>
            <Link className="text-primary" href={"/dashboard"}>
              Dashboard
            </Link>
            <Link className="text-primary" href={"/links"}>
              Links
            </Link>
            <Link className="text-primary" href={"/qr-codes"}>
              QQ Codes
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
