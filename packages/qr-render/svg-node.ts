const escape = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

/** Small attribute tree, not a DOM: no scripts, parsing, network or events. */
export class SvgElement {
  private attributes = new Map<string, string>();
  private children: SvgElement[] = [];
  constructor(private tag: string) {}
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  appendChild(child: SvgElement) {
    this.children.push(child);
  }
  toString(): string {
    return `<${this.tag}${[...this.attributes].map(([key, value]) => ` ${key}="${escape(value)}"`).join("")}>${this.children.join("")}</${this.tag}>`;
  }
}
export const svgWindow = {
  document: {
    createElementNS: (_namespace: string, tag: string) => new SvgElement(tag),
  },
};
export type Window = typeof svgWindow;
export type DotType = string;
export type CornerSquareType = string;
export type CornerDotType = string;
export type GetNeighbor = (x: number, y: number) => boolean;
export interface BasicFigureDrawArgs {
  x: number;
  y: number;
  size: number;
  rotation?: number | undefined;
}
export interface DrawArgs extends BasicFigureDrawArgs {
  getNeighbor?: GetNeighbor;
}
export interface RotateFigureArgs extends BasicFigureDrawArgs {
  draw: () => void;
}
