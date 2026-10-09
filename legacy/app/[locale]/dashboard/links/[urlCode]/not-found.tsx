// Force dynamic rendering to avoid static-to-dynamic errors
export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <main className="w-full flex flex-col items-center max-w-7xl px-4 mx-auto">
      <div className="w-full max-w-4xl flex flex-col my-12 gap-6">
        <div className="col-span-2 w-full flex flex-col md:items-start items-center md:text-left text-center gap-4">
          <h1 className="font-bold text-4xl">Oops!</h1>
          <h2 className="text-xl">
            This link doesn&apos;t seem to exist. If you think this is a mistake
            contact us.
          </h2>
        </div>
      </div>
    </main>
  );
}
