# apps/web/src/server/actions/bio-publishing.ts

- saveBioContentAction · function · L18-L25 — async function saveBioContentAction( workspace: string, id: string, revision: number, content: unknown, )
- publishBioContentAction · function · L26-L41 — async function publishBioContentAction( workspace: string, id: string, revision: number, )
- restoreBioContentAction · function · L42-L64 — async function restoreBioContentAction( workspace: string, id: string, revision: number, version: number, )
- shortenBioContentAction · function · L65-L72 — async function shortenBioContentAction( workspace: string, id: string, url: string, title: string, )
- changeBioHandleAction · function · L73-L88 — async function changeBioHandleAction( workspace: string, id: string, handle: string, )
- bioVersionListAction · function · L89-L91 — async function bioVersionListAction(workspace: string, id: string)
- bioLinkFiltersAction · function · L93-L95 — async function bioLinkFiltersAction(workspace: string)
- searchBioLinksAction · function · L97-L122 — async function searchBioLinksAction( workspace: string, search: string, page = 1, tags: string[] = [], )
- selectBioLinksAction · function · L125-L161 — async function selectBioLinksAction( workspace: string, search: string, tags: string[], excluded: string[], capacity: number, )
