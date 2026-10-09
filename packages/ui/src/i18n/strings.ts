export type Locale = "en" | "pt";

export const INTL_LOCALE: Record<Locale, string> = {
  en: "en-GB",
  pt: "pt-PT",
};

export interface UIStrings {
  copyShortLink: string;
  copied: string;
  copiedAnnouncement: (link: string) => string;
  copyFailed: string;
  close: string;
  retry: string;
  noResults: string;
  search: string;
  addFilter: string;
  removeFilter: (label: string) => string;
  clearFilters: string;
  filterIs: string;
  filterIsAnyOf: string;
  selectedCount: (count: number) => string;
  clearSelection: string;
  selectAll: string;
  selectRow: (label: string) => string;
  columns: string;
  columnLink: string;
  columnDestination: string;
  columnTags: string;
  columnTrend: string;
  columnClicks: string;
  columnCreated: string;
  sortAscending: string;
  sortDescending: string;
  moreTags: (count: number) => string;
  loadingLinks: string;
  trendLabel: (total: string, peak: string) => string;
  noClicksYet: string;
  usageOf: (used: string, limit: string) => string;
  usageRemaining: (remaining: string) => string;
  usageOver: (over: string) => string;
  nearLimit: string;
  overLimit: string;
  ageUnits: {
    minute: string;
    hour: string;
    day: string;
    week: string;
    month: string;
    year: string;
    now: string;
    separator: string;
  };
  deltaUp: (value: string) => string;
  deltaDown: (value: string) => string;
  deltaFlat: string;
  comparedToPrevious: string;
  keyboardShortcut: string;
}

const plural = (locale: string, count: number, one: string, other: string) =>
  new Intl.PluralRules(locale).select(count) === "one" ? one : other;

export const en: UIStrings = {
  copyShortLink: "Copy short link",
  copied: "Copied",
  copiedAnnouncement: (link) => `Copied ${link} to the clipboard`,
  copyFailed:
    "Couldn't reach the clipboard. Select the link and copy it manually.",
  close: "Close",
  retry: "Retry",
  noResults: "No results",
  search: "Search",
  addFilter: "Filter",
  removeFilter: (label) => `Remove filter: ${label}`,
  clearFilters: "Clear filters",
  filterIs: "is",
  filterIsAnyOf: "is any of",
  selectedCount: (count) => `${count} selected`,
  clearSelection: "Clear selection",
  selectAll: "Select all",
  selectRow: (label) => `Select ${label}`,
  columns: "Columns",
  columnLink: "Link",
  columnDestination: "Destination",
  columnTags: "Tags",
  columnTrend: "30 days",
  columnClicks: "Clicks",
  columnCreated: "Created",
  sortAscending: "Sort ascending",
  sortDescending: "Sort descending",
  moreTags: (count) => `+${count}`,
  loadingLinks: "Loading links",
  trendLabel: (total, peak) =>
    `${total} clicks in the last 30 days, peak ${peak} in a day`,
  noClicksYet: "No clicks in the last 30 days",
  usageOf: (used, limit) => `${used} of ${limit}`,
  usageRemaining: (remaining) => `${remaining} left`,
  usageOver: (over) => `${over} over`,
  nearLimit: "Near limit",
  overLimit: "Over limit",
  ageUnits: {
    minute: "m",
    hour: "h",
    day: "d",
    week: "w",
    month: "mo",
    year: "y",
    now: "now",
    separator: "",
  },
  deltaUp: (value) => `Up ${value}`,
  deltaDown: (value) => `Down ${value}`,
  deltaFlat: "No change",
  comparedToPrevious: "vs previous 30 days",
  keyboardShortcut: "Keyboard shortcut",
};

export const pt: UIStrings = {
  copyShortLink: "Copiar link curto",
  copied: "Copiado",
  copiedAnnouncement: (link) => `${link} copiado para a área de transferência`,
  copyFailed:
    "Não foi possível aceder à área de transferência. Selecione o link e copie-o manualmente.",
  close: "Fechar",
  retry: "Tentar novamente",
  noResults: "Sem resultados",
  search: "Pesquisar",
  addFilter: "Filtrar",
  removeFilter: (label) => `Remover filtro: ${label}`,
  clearFilters: "Limpar filtros",
  filterIs: "é",
  filterIsAnyOf: "é um de",
  selectedCount: (count) =>
    `${count} ${plural("pt-PT", count, "selecionado", "selecionados")}`,
  clearSelection: "Limpar seleção",
  selectAll: "Selecionar todos",
  selectRow: (label) => `Selecionar ${label}`,
  columns: "Colunas",
  columnLink: "Link",
  columnDestination: "Destino",
  columnTags: "Etiquetas",
  columnTrend: "30 dias",
  columnClicks: "Cliques",
  columnCreated: "Criado",
  sortAscending: "Ordenar por ordem crescente",
  sortDescending: "Ordenar por ordem decrescente",
  moreTags: (count) => `+${count}`,
  loadingLinks: "A carregar os links",
  trendLabel: (total, peak) =>
    `${total} cliques nos últimos 30 dias, máximo de ${peak} num dia`,
  noClicksYet: "Sem cliques nos últimos 30 dias",
  usageOf: (used, limit) => `${used} de ${limit}`,
  usageRemaining: (remaining) => `restam ${remaining}`,
  usageOver: (over) => `${over} acima do limite`,
  nearLimit: "Perto do limite",
  overLimit: "Acima do limite",
  ageUnits: {
    minute: "min",
    hour: "h",
    day: "d",
    week: "sem",
    month: "m",
    year: "a",
    now: "agora",
    separator: " ",
  },
  deltaUp: (value) => `Subiu ${value}`,
  deltaDown: (value) => `Desceu ${value}`,
  deltaFlat: "Sem alteração",
  comparedToPrevious: "face aos 30 dias anteriores",
  keyboardShortcut: "Atalho de teclado",
};

export const UI_STRINGS: Record<Locale, UIStrings> = { en, pt };
