# legacy/components/ui/carousel.tsx

- CarouselApi · type · L12-L12 — type CarouselApi = UseEmblaCarouselType[1]
- UseCarouselParameters · type · L13-L13 — type UseCarouselParameters = Parameters<typeof useEmblaCarousel>
- CarouselOptions · type · L14-L14 — type CarouselOptions = UseCarouselParameters[0]
- CarouselPlugin · type · L15-L15 — type CarouselPlugin = UseCarouselParameters[1]
- CarouselProps · type · L17-L22 — type CarouselProps = { opts?: CarouselOptions plugins?: CarouselPlugin orientation?: "horizontal" | "vertical" setApi?: (api: CarouselApi) => void }
- CarouselContextProps · type · L24-L31 — type CarouselContextProps = { carouselRef: ReturnType<typeof useEmblaCarousel>[0] api: ReturnType<typeof useEmblaCarousel>[1] scrollPrev: () => void scrollNext: () => void canScrollPrev: boolean canScrollNext: boolean } & CarouselProps
- useCarousel · function · L35-L43 — function useCarousel()
- Carousel · function · L45-L133 — function Carousel({ orientation = "horizontal", opts, setApi, plugins, className, children, ...props }: React.ComponentProps<"div"> & CarouselProps)
- CarouselContent · function · L135-L154 — function CarouselContent({ className, ...props }: React.ComponentProps<"div">)
- CarouselItem · function · L156-L172 — function CarouselItem({ className, ...props }: React.ComponentProps<"div">)
- CarouselPrevious · function · L174-L202 — function CarouselPrevious({ className, variant = "outline", size = "icon", ...props }: React.ComponentProps<typeof Button>)
- CarouselNext · function · L204-L232 — function CarouselNext({ className, variant = "outline", size = "icon", ...props }: React.ComponentProps<typeof Button>)
