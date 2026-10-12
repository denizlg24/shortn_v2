# legacy/components/ui/pagination.tsx

- Pagination · function · L11-L21 — function Pagination({ className, ...props }: React.ComponentProps<"nav">)
- PaginationContent · function · L23-L34 — function PaginationContent({ className, ...props }: React.ComponentProps<"ul">)
- PaginationItem · function · L36-L38 — function PaginationItem({ ...props }: React.ComponentProps<"li">)
- PaginationLinkProps · type · L40-L43 — type PaginationLinkProps = { isActive?: boolean } & Pick<React.ComponentProps<typeof Button>, "size"> & React.ComponentProps<"a">
- PaginationLink · function · L45-L66 — function PaginationLink({ className, isActive, size = "icon", ...props }: PaginationLinkProps)
- PaginationPrevious · function · L68-L83 — function PaginationPrevious({ className, ...props }: React.ComponentProps<typeof PaginationLink>)
- PaginationNext · function · L85-L100 — function PaginationNext({ className, ...props }: React.ComponentProps<typeof PaginationLink>)
- PaginationEllipsis · function · L102-L117 — function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">)
