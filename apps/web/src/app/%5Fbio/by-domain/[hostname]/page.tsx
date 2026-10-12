import { loadDomainBio } from "@/server/public-bio";
import PublicBioPage, {
  generateMetadata as handleMetadata,
} from "../../[handle]/page";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ hostname: string }>;
}) {
  const bio = await loadDomainBio((await params).hostname);
  return handleMetadata({ params: Promise.resolve({ handle: bio.handle }) });
}
export default async function DomainBioPage({
  params,
}: {
  params: Promise<{ hostname: string }>;
}) {
  const bio = await loadDomainBio((await params).hostname);
  return <PublicBioPage params={Promise.resolve({ handle: bio.handle })} />;
}
