import pendulumGif from "@/public/pendulum.gif";
import Image from "next/image";

export default function Loading() {
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-6 gap-6">
        <div className="w-full col-span-full flex flex-col gap-4 pb-6">
          <div className="flex flex-col items-center justify-center min-h-[350px]">
            <Image
              src={pendulumGif}
              alt="Loading gif"
              className="w-full max-w-[300px] object-contain h-auto"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
