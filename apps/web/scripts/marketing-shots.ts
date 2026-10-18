/**
 * Loopback-only marketing screenshot sandbox. Seeds a fictional publisher
 * ("Atlântico Media") into a dedicated local database, captures dashboard
 * screenshots in light and dark mode, then stops its servers. No staging or
 * production data, and no provider writes.
 */
import { mkdir, rm } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { MongoClient, ObjectId, type AnyBulkWriteOperation } from "mongodb";
import { hashPassword } from "better-auth/crypto";
import { Redis } from "ioredis";
import sharp from "sharp";
import {
  chromium,
  type BrowserContext,
  type Locator,
  type Page,
} from "playwright-core";
import {
  collection,
  legacyCollectionKeys,
  physicalNames,
  syncIndexes,
  type Documents,
} from "@shortn/db";
import {
  createApiKey,
  createBioPage,
  createCampaign,
  createMany,
  createQr,
  createWebhook,
  createWorkspace,
  ensurePersonalWorkspace,
  moveLinksToCampaign,
  publishBioDraft,
  readBioDraft,
  recomputeRollups,
  saveBioDraft,
  setLinksArchived,
  type CreateLinkInput,
  type ServiceContext,
  type Workspace,
} from "@shortn/core";
import { bioPresets } from "@shortn/core/bio-content";
import type { ApiScope } from "@shortn/core/api-scopes";
import { devConfig } from "../../../scripts/dev-config";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const shotsDir = `${root}apps/web/src/components/marketing/shots/`;
const scratch = `${root}apps/web/.next/marketing-shots/`;
const secret = () => randomBytes(32).toString("hex");
const webhookKey = secret();
const pepper = secret();
const bioSecret = secret();
const origin = "http://localhost:3300";
const databaseName = "shortn_marketing_shots";
const { shared, ports } = devConfig({
  MONGODB_URL: "mongodb://127.0.0.1:27020/?directConnection=true",
  MONGODB_DB: databaseName,
  REDIS_CACHE_URL: "redis://127.0.0.1:16380/7",
  REDIS_DURABLE_URL: "redis://127.0.0.1:16379/7",
  BETTER_AUTH_SECRET: secret(),
  LINK_ACCESS_SECRET: secret(),
  CONFIRMATION_TOKEN_SECRET: secret(),
  IP_HASH_SECRET: secret(),
  AUTH_SECRET: secret(),
  POLAR_ACCESS_TOKEN: secret(),
  POLAR_WEBHOOK_SECRET: secret(),
  POLAR_ENVIRONMENT: "sandbox",
  RESEND_API_KEY: "re_local_disabled",
  MAIL_ALLOWLIST: "nobody@shortn.invalid",
  API_KEY_PEPPER: pepper,
  PLATFORM_API_ENABLED: "1",
  PLATFORM_MCP_ENABLED: "1",
  QR_EXPORTS_ENABLED: "1",
  IMPORTS_ENABLED: "1",
  EXPORTS_ENABLED: "1",
  S3_ENDPOINT: "http://127.0.0.1:3305",
  S3_REGION: "local",
  S3_BUCKET: "synthetic-marketing",
  S3_ACCESS_KEY_ID: "synthetic",
  S3_SECRET_ACCESS_KEY: "synthetic-local-secret",
  MCP_OAUTH_ENABLED: "1",
  MCP_PUBLIC_ORIGIN: "http://localhost:3303",
  MCP_OAUTH_ISSUER: `${origin}/api/auth`,
  PLATFORM_WEBHOOKS_ENABLED: "1",
  WEBHOOK_SECRET_KEY: webhookKey,
  PLATFORM_API_ROLLOUT: "0",
  BILLING_WRITES: "0",
  DOMAIN_WRITES: "0",
  BIO_DELIVERY_ENABLED: "1",
  BIO_SUBDOMAINS: "0",
  BIO_LEGACY_REDIRECTS: "0",
  BIO_API_ORIGIN: "http://localhost:3303",
  BIO_WEB_ORIGIN: origin,
  BIO_INTERNAL_SECRET: bioSecret,
  RUN_CONTINUOUS_MIGRATIONS: "0",
  LINK_DOMAIN: "shortn.at",
  DEV_WEB_PORT: "3300",
  DEV_API_PORT: "3303",
  DEV_REDIRECT_PORT: "3302",
  DEV_WORKER_PORT: "3304",
});
const mongoUrl = new URL(shared.MONGODB_URL!);
if (
  !["127.0.0.1", "localhost"].includes(mongoUrl.hostname) ||
  shared.MONGODB_DB !== databaseName
)
  throw new Error(
    "The marketing sandbox only runs against its loopback database.",
  );

// Deterministic data: the same seed produces the same library on every run.
let state = 0x5eed2026;
function random() {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(items: readonly T[]): T =>
  items[Math.floor(random() * items.length)]!;
function weighted<T>(entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1]![0];
}
const gaussian = () =>
  Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
const slug = (value: string, words = 5) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .slice(0, words)
    .join("-");

const DAY = 86_400_000;
const now = new Date();
const windowStart = new Date(now.getTime() - 90 * DAY);
const ptMonths = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

const ptTopics = [
  "Habitação em Lisboa",
  "O novo terminal do porto de Sines",
  "Vinhos do Douro à conquista da Ásia",
  "Turismo no Algarve fora de época",
  "Eólicas offshore em Viana do Castelo",
  "Startups do Porto",
  "Mercado de arrendamento jovem",
  "Ciclovias em Braga",
  "Seca no Alentejo",
  "Alta velocidade Lisboa–Porto",
  "Nómadas digitais na Madeira",
  "Azulejos recuperados em Alfama",
  "Exportações de cortiça",
  "Autárquicas 2025: o balanço",
  "A pesca da sardinha",
  "Hospitais do interior",
  "Ensino superior e propinas",
  "Hidrogénio verde em Sines",
  "O metro do Mondego",
  "Comércio tradicional na Baixa",
  "Incêndios e floresta",
  "Fado na nova geração",
  "Salários na função pública",
  "Ourém e o turismo religioso",
  "Lítio em Trás-os-Montes",
  "A ferrovia do Tua",
  "Praias com bandeira azul",
  "Inflação no cabaz alimentar",
  "Aeroporto de Alcochete",
  "Cinema português em Cannes",
  "Pequenas livrarias independentes",
  "Água potável nos Açores",
  "Feira de Barcelos",
  "Bairros históricos de Coimbra",
  "O mercado do Bolhão",
  "Aquacultura na ria de Aveiro",
  "Agricultura de precisão no Ribatejo",
  "Teatro nas aldeias do xisto",
  "Bolsas de investigação",
  "Mobilidade elétrica nas cidades",
  "Leitura entre adolescentes",
  "Emigração qualificada",
  "Arquitetura de Siza Vieira",
  "Cozinha de mercado",
  "Envelhecimento no interior",
  "Surf na Nazaré",
  "Data centers em Sines",
  "Rendas no centro histórico",
  "Fundos europeus do PRR",
  "Olival intensivo",
  "Saúde mental nas escolas",
  "Festas dos Santos Populares",
  "A crise da habitação estudantil",
  "Indústria do calçado",
  "Têxteis do Vale do Ave",
  "Transportes públicos gratuitos",
  "O futuro dos jornais regionais",
  "Turismo de natureza no Gerês",
  "Queijo da Serra da Estrela",
  "Ondas de calor e trabalho",
  "Literacia financeira",
  "Barragens e energia",
  "Cultura em rede nas bibliotecas",
  "O regresso dos elétricos",
];
const ptTemplates = [
  "{t}: o que muda em 2026",
  "Reportagem: {t}",
  "{t} — os números por trás",
  "Guia prático: {t}",
  "Opinião | {t}",
  "Entrevista: {p} fala sobre {t}",
  "{t}, explicado em cinco gráficos",
  "Análise: {t}",
  "{t}: perguntas e respostas",
  "Crónica | {t}",
  "Dossier especial — {t}",
  "{t}: o mapa completo",
  "Ao minuto: {t}",
  "{t} visto de perto",
  "Investigação: {t}",
  "Fotogaleria | {t}",
  "{t}: dez anos depois",
  "O que ninguém lhe diz sobre {t}",
  "Mapa interativo: {t}",
  "{t} — reportagem em vídeo",
  "Carta ao leitor: {t}",
  "Os protagonistas de {t}",
];
const people = [
  "Helena Brito",
  "Duarte Lemos",
  "Carla Fonseca",
  "Tomás Aragão",
  "Sofia Almeida",
  "Nuno Valente",
  "Beatriz Quintela",
  "Joana Seixas",
  "Henrique Pais",
  "Rita Cordeiro",
];
const esTopics = [
  "Vivienda en Madrid",
  "El puerto de Vigo",
  "Turismo en Andalucía",
  "Energía solar en Extremadura",
  "El tren Lisboa–Madrid",
  "Startups de Valencia",
  "La sequía en Murcia",
  "Comercio ibérico",
  "Cine español en San Sebastián",
  "Universidades gallegas",
  "Precio del aceite de oliva",
  "Pesca en Galicia",
  "Movilidad en Barcelona",
  "Teletrabajo en Canarias",
  "Libros más vendidos del año",
];
const esTemplates = [
  "{t}: claves para 2026",
  "Reportaje: {t}",
  "{t}, en cifras",
  "Entrevista: {p} habla de {t}",
  "Análisis | {t}",
  "Guía rápida: {t}",
  "{t}: lo que hay que saber",
];
const enTopics = [
  "Lisbon's housing squeeze",
  "Porto's startup scene",
  "Portugal's wine exports",
  "The Algarve off-season",
  "Offshore wind in the Atlantic",
  "Madeira's digital nomads",
  "Iberian high-speed rail",
  "Green hydrogen in Sines",
  "Portugal's lithium question",
  "Independent bookshops in Lisbon",
  "The Douro valley harvest",
  "Surfing the Nazaré giants",
];
const enTemplates = [
  "{t}: what changes in 2026",
  "Inside {t}",
  "The numbers behind {t}",
  "{t}, explained",
  "Weekend read: {t}",
  "Interview: {p} on {t}",
];
const ptSections = [
  "sociedade",
  "economia",
  "cultura",
  "politica",
  "local",
  "ciencia",
  "desporto",
];
const books: [string, string][] = [
  ["A Casa das Marés", "Inês Valadares"],
  ["O Último Farol", "Rui Calado"],
  ["Cidades de Sal", "Marta Lobo"],
  ["Mapas do Interior", "Gonçalo Teles"],
  ["Verão em Tavira", "Ana Pimentel"],
  ["Diário de Bordo", "Francisco Mota"],
  ["As Ilhas Invisíveis", "Clara Matias"],
  ["Pão e Cortiça", "Jorge Albuquerque"],
  ["O Jardim de Inverno", "Leonor Antunes"],
  ["Rio Abaixo", "Miguel Saraiva"],
  ["Cartas de Lisboa", "Teresa Gaspar"],
  ["A Hora do Lobo", "Pedro Quaresma"],
  ["Sul", "Mariana Belo"],
  ["Os Anos do Mar", "Vasco Rebelo"],
  ["Breve História do Atlântico", "Luísa Sardinha"],
  ["Mulheres da Ribeira", "Catarina Vidal"],
  ["O Silêncio das Serras", "André Fontes"],
  ["Cozinha das Avós", "Graça Morais Lima"],
  ["Poemas do Cais", "Hugo Barreiros"],
  ["A Biblioteca Flutuante", "Isabel Correia"],
];
const bookFormats = [
  "{b} — {a}",
  "Pré-venda: {b}, de {a}",
  "{b} ({a}) — edição autografada",
  "Clube de leitura: {b}",
  "Excerto: {b}, de {a}",
  "{b} — edição de bolso",
  "Lançamento: {b}",
  "Entrevista com {a} sobre «{b}»",
];
const events = [
  "Encontros Atlântico",
  "Festival Maré Cheia",
  "Conferência Media Futuro",
  "Noite dos Leitores",
  "Ciclo de Cinema Ibérico",
  "Mercado de Natal Atlântico",
  "Workshop de Jornalismo de Dados",
  "Debate: Cidades para Pessoas",
  "Concerto de Verão no Cais",
  "Maratona de Leitura",
  "Prémios Atlântico de Reportagem",
  "Feira do Livro Independente",
];
const cities = [
  "Lisboa",
  "Porto",
  "Coimbra",
  "Braga",
  "Faro",
  "Évora",
  "Aveiro",
  "Funchal",
  "Ponta Delgada",
  "Madrid",
  "Vigo",
  "Sevilha",
];
const eventFormats = [
  "{e} · {c}",
  "{e} — bilhetes ({c})",
  "{e} {c}: programa",
  "Inscrições: {e} em {c}",
  "{e} · {c} · transmissão em direto",
];
const podcastTopics = [
  "o preço das casas",
  "quem lê jornais em 2026",
  "a economia do mar",
  "a nova geração do fado",
  "como se faz uma investigação",
  "o interior que resiste",
  "eleições e redes sociais",
  "a revolução das bicicletas",
  "a ciência do clima",
  "o futuro do trabalho",
  "livros que mudaram Portugal",
  "o turismo e as cidades",
];
const newsletters: { name: string; path: string; weekday: number }[] = [
  { name: "Newsletter de Domingo", path: "domingo", weekday: 0 },
  { name: "Manhã Atlântico", path: "manha", weekday: -1 },
  { name: "Briefing Economia", path: "economia", weekday: 2 },
  { name: "Cultura à Sexta", path: "cultura", weekday: 5 },
  { name: "Atlântico Weekly", path: "weekly", weekday: 4 },
];

type Category =
  "article" | "newsletter" | "agenda" | "livraria" | "podcast" | "es" | "en";
interface Spec {
  category: Category;
  createdAt: Date;
  input: CreateLinkInput;
  weight: number;
  campaign?: string;
  id?: ObjectId;
}

const takenKeys = new Set<string>(["encontros26", "atlantico"]);
function uniqueKey(base: string) {
  let key = base.slice(0, 48).replace(/-+$/, "");
  for (let n = 2; takenKeys.has(key); n++) key = `${base.slice(0, 44)}-${n}`;
  takenKeys.add(key);
  return key;
}
const takenTitles = new Set<string>();
function uniqueTitle(make: () => string) {
  return compose(() => ({ title: make() })).title;
}
function compose<T extends { title: string }>(make: () => T): T {
  for (let attempt = 0; attempt < 400; attempt++) {
    const value = make();
    if (!takenTitles.has(value.title)) {
      takenTitles.add(value.title);
      return value;
    }
  }
  const value = make();
  const title = `${value.title} (II)`;
  takenTitles.add(title);
  return { ...value, title };
}
const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w)\}/g, (_, name: string) => values[name] ?? "");
const at = (daysAgo: number, hour = 9) => {
  const date = new Date(now.getTime() - daysAgo * DAY);
  date.setUTCHours(hour, Math.floor(random() * 60), Math.floor(random() * 60));
  return date.getTime() > now.getTime()
    ? new Date(now.getTime() - 3_600_000)
    : date;
};
const shortDate = (date: Date) =>
  `${date.getUTCDate()} ${ptMonths[date.getUTCMonth()]}`;

function buildSpecs(): Spec[] {
  const specs: Spec[] = [];
  const add = (
    category: Category,
    createdAt: Date,
    input: CreateLinkInput,
    weight: number,
    campaign?: string,
  ) =>
    specs.push({
      category,
      createdAt,
      input,
      weight,
      ...(campaign ? { campaign } : {}),
    });
  const multiplier: Record<Category, number> = {
    article: 1,
    newsletter: 1.5,
    agenda: 1.3,
    livraria: 0.6,
    podcast: 0.7,
    es: 0.55,
    en: 0.45,
  };
  const popularity = (category: Category) =>
    Math.exp(gaussian() * 1.15) * multiplier[category];

  for (let i = 0; i < 1100; i++) {
    const createdAt = at(Math.pow(random(), 1.35) * 420, 6 + (i % 14));
    const { title, topic } = compose(() => {
      const topic = pick(ptTopics);
      return {
        topic,
        title: fill(pick(ptTemplates), { t: topic, p: pick(people) }),
      };
    });
    const section = pick(ptSections);
    const path = `${section}/${createdAt.getUTCFullYear()}/${String(createdAt.getUTCMonth() + 1).padStart(2, "0")}/${slug(title, 7)}`;
    const tags = weighted<string[]>([
      [["social"], 54],
      [["print", "social"], 28],
      [["social", "assinaturas"], 8],
      [["print"], 6],
      [[], 4],
    ]);
    add(
      "article",
      createdAt,
      {
        url: `https://atlantico-media.example/${path}`,
        title,
        tags,
        ...(random() < 0.35 ? { key: uniqueKey(slug(topic, 3)) } : {}),
      },
      popularity("article"),
      tags.includes("assinaturas") ? "Assinaturas Primavera 2026" : undefined,
    );
  }

  for (const letter of newsletters) {
    const due = Array.from({ length: 600 }, (_, daysAgo) => daysAgo).filter(
      (daysAgo) => {
        const weekday = new Date(now.getTime() - daysAgo * DAY).getUTCDay();
        return letter.weekday === -1
          ? weekday >= 1 && weekday <= 5 && random() < 0.42
          : weekday === letter.weekday;
      },
    );
    let issue = 120 + Math.floor(random() * 160) + due.length;
    for (const daysAgo of due) {
      issue -= 1;
      const createdAt = at(daysAgo, 6);
      const topic = pick([
        ...ptTopics,
        ...podcastTopics.map((t) => t[0]!.toUpperCase() + t.slice(1)),
      ]);
      const title = uniqueTitle(() =>
        letter.path === "manha"
          ? `${letter.name} · ${shortDate(createdAt)}`
          : letter.path === "weekly"
            ? `Atlântico Weekly #${issue}: ${pick(enTopics)}`
            : `${letter.name} n.º ${issue}: ${topic}`,
      );
      add(
        "newsletter",
        createdAt,
        {
          url: `https://newsletters.atlantico-media.example/${letter.path}/${issue}?utm_source=newsletter&utm_medium=email&utm_campaign=${letter.path}`,
          title,
          tags: random() < 0.8 ? ["newsletter", "social"] : ["newsletter"],
          ...(random() < 0.55
            ? { key: uniqueKey(`${letter.path.slice(0, 3)}-${issue}`) }
            : {}),
        },
        popularity("newsletter"),
        letter.path === "domingo" ? "Newsletter de Domingo" : undefined,
      );
    }
  }

  for (let i = 0; i < 300; i++) {
    const { title, event, city } = compose(() => {
      const event = pick(events),
        city = pick(cities);
      return {
        event,
        city,
        title: fill(pick(eventFormats), { e: event, c: city }),
      };
    });
    const encontros = event === "Encontros Atlântico";
    const createdAt = encontros
      ? at(24 + random() * 12, 10)
      : at(Math.pow(random(), 1.2) * 300, 11);
    add(
      "agenda",
      createdAt,
      {
        url: `https://agenda2026.example/${slug(city, 2)}/${slug(title, 6)}`,
        title,
        tags:
          random() < 0.75
            ? ["agenda-2026", "eventos", "social"]
            : ["agenda-2026", "eventos"],
        ...(random() < 0.6
          ? { key: uniqueKey(`${slug(event, 2)}-${slug(city, 1)}`) }
          : {}),
      },
      popularity("agenda") * (encontros ? 2.2 : 1),
      encontros ? "Encontros Atlântico 2026" : undefined,
    );
  }

  for (let i = 0; i < 140; i++) {
    const { title, book } = compose(() => {
      const [book, author] = pick(books);
      return { book, title: fill(pick(bookFormats), { b: book, a: author }) };
    });
    const createdAt = at(Math.pow(random(), 1.3) * 380, 14);
    const tags = weighted<string[]>([
      [["livraria", "social"], 45],
      [["livraria", "print", "social"], 15],
      [["livraria", "print"], 15],
      [["livraria"], 25],
    ]);
    add(
      "livraria",
      createdAt,
      {
        url: `https://livraria-atlantico.example/livros/${slug(book, 4)}?ref=${slug(title, 3)}`,
        title,
        tags,
        ...(random() < 0.5 ? { key: uniqueKey(`livro-${slug(book, 3)}`) } : {}),
      },
      popularity("livraria"),
      createdAt.getTime() > now.getTime() - 60 * DAY
        ? "Feira do Livro — Livraria Atlântico"
        : undefined,
    );
  }

  for (let episode = 140; episode >= 1; episode--) {
    const createdAt = at((140 - episode) * 3 + random() * 2, 5);
    const title = uniqueTitle(
      () =>
        `Maré Alta, ep. ${episode}: ${pick(podcastTopics)}${random() < 0.3 ? `, com ${pick(people)}` : ""}`,
    );
    add(
      "podcast",
      createdAt,
      {
        url: `https://podcast.atlantico-media.example/mare-alta/episodio-${episode}`,
        title,
        tags: ["podcast", "social"],
        key: uniqueKey(`mare-alta-${episode}`),
      },
      popularity("podcast"),
      episode > 124 ? "Podcast Maré Alta — Temporada 3" : undefined,
    );
  }

  for (let i = 0; i < 90; i++) {
    const title = uniqueTitle(() =>
      fill(pick(esTemplates), { t: pick(esTopics), p: pick(people) }),
    );
    add(
      "es",
      at(Math.pow(random(), 1.4) * 360, 8),
      {
        url: `https://atlantico-media.example/es/${pick(["sociedad", "economia", "cultura"])}/${slug(title, 6)}`,
        title,
        tags: ["social", "espana"],
      },
      popularity("es"),
    );
  }
  for (let i = 0; i < 60; i++) {
    const title = uniqueTitle(() =>
      fill(pick(enTemplates), { t: pick(enTopics), p: pick(people) }),
    );
    add(
      "en",
      at(Math.pow(random(), 1.4) * 360, 12),
      {
        url: `https://atlantico-media.example/en/${pick(["society", "business", "culture"])}/${slug(title, 6)}`,
        title,
        tags: ["social", "english"],
      },
      popularity("en"),
    );
  }
  return specs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

const countries: {
  code: string;
  weight: number;
  continent: string;
  lang: string;
  tz: string;
  cities: [string, number][];
}[] = [
  {
    code: "PT",
    weight: 58,
    continent: "EU",
    lang: "pt-PT",
    tz: "Europe/Lisbon",
    cities: [
      ["Lisbon", 34],
      ["Porto", 21],
      ["Braga", 8],
      ["Coimbra", 7],
      ["Faro", 5],
      ["Aveiro", 5],
      ["Setúbal", 5],
      ["Funchal", 4],
      ["Évora", 3],
      ["Viseu", 3],
      ["Ponta Delgada", 3],
      ["Leiria", 2],
    ],
  },
  {
    code: "ES",
    weight: 12,
    continent: "EU",
    lang: "es-ES",
    tz: "Europe/Madrid",
    cities: [
      ["Madrid", 34],
      ["Vigo", 16],
      ["Barcelona", 16],
      ["Seville", 10],
      ["Salamanca", 6],
      ["Valencia", 10],
      ["Badajoz", 8],
    ],
  },
  {
    code: "BR",
    weight: 10,
    continent: "SA",
    lang: "pt-BR",
    tz: "America/Sao_Paulo",
    cities: [
      ["São Paulo", 40],
      ["Rio de Janeiro", 26],
      ["Belo Horizonte", 12],
      ["Curitiba", 10],
      ["Porto Alegre", 12],
    ],
  },
  {
    code: "GB",
    weight: 6,
    continent: "EU",
    lang: "en-GB",
    tz: "Europe/London",
    cities: [
      ["London", 62],
      ["Manchester", 14],
      ["Bristol", 10],
      ["Edinburgh", 14],
    ],
  },
  {
    code: "FR",
    weight: 5,
    continent: "EU",
    lang: "fr-FR",
    tz: "Europe/Paris",
    cities: [
      ["Paris", 60],
      ["Lyon", 20],
      ["Bordeaux", 20],
    ],
  },
  {
    code: "DE",
    weight: 4,
    continent: "EU",
    lang: "de-DE",
    tz: "Europe/Berlin",
    cities: [
      ["Berlin", 40],
      ["Munich", 25],
      ["Hamburg", 20],
      ["Stuttgart", 15],
    ],
  },
  {
    code: "US",
    weight: 3,
    continent: "NA",
    lang: "en-US",
    tz: "America/New_York",
    cities: [
      ["New York", 40],
      ["Newark", 30],
      ["Boston", 30],
    ],
  },
  {
    code: "CH",
    weight: 0.8,
    continent: "EU",
    lang: "fr-CH",
    tz: "Europe/Zurich",
    cities: [["Geneva", 1]],
  },
  {
    code: "LU",
    weight: 0.6,
    continent: "EU",
    lang: "fr-LU",
    tz: "Europe/Luxembourg",
    cities: [["Luxembourg", 1]],
  },
  {
    code: "AO",
    weight: 0.4,
    continent: "AF",
    lang: "pt-AO",
    tz: "Africa/Luanda",
    cities: [["Luanda", 1]],
  },
];
const hourWeights = [
  1, 0.6, 0.4, 0.3, 0.3, 0.5, 1.2, 2.4, 3.4, 3.2, 2.8, 2.6, 2.9, 3.1, 2.6, 2.4,
  2.5, 2.7, 3, 3.4, 3.8, 3.6, 2.8, 1.8,
];
const hourTable = hourWeights.map((weight, hour) => [hour, weight] as const);

function agent(scan: boolean) {
  const device = scan
    ? "mobile"
    : weighted([
        ["mobile", 63],
        ["desktop", 32],
        ["tablet", 5],
      ] as const);
  if (device === "desktop") {
    const os = weighted([
      ["Windows", 54],
      ["macOS", 38],
      ["Linux", 8],
    ] as const);
    const browser =
      os === "macOS"
        ? weighted([
            ["Safari", 45],
            ["Chrome", 45],
            ["Firefox", 6],
            ["Edge", 4],
          ] as const)
        : weighted([
            ["Chrome", 60],
            ["Edge", 24],
            ["Firefox", 14],
            ["Opera", 2],
          ] as const);
    return { device, os, browser };
  }
  const os =
    device === "tablet"
      ? weighted([
          ["iOS", 68],
          ["Android", 32],
        ] as const)
      : weighted([
          ["iOS", 49],
          ["Android", 51],
        ] as const);
  const browser =
    os === "iOS"
      ? weighted([
          ["Mobile Safari", 72],
          ["Chrome", 10],
          ["Instagram", 10],
          ["Facebook", 8],
        ] as const)
      : weighted([
          ["Mobile Chrome", 68],
          ["Samsung Internet", 14],
          ["Instagram", 10],
          ["Facebook", 8],
        ] as const);
  return { device, os, browser };
}

function referrer(category: Category, browser: string): string | undefined {
  if (browser === "Instagram") return "instagram.com";
  if (browser === "Facebook") return "l.facebook.com";
  if (category === "newsletter")
    return weighted([
      [undefined, 62],
      ["newsletters.atlantico-media.example", 18],
      ["mail.google.com", 12],
      ["outlook.live.com", 8],
    ] as const);
  return weighted([
    [undefined, 34],
    ["google.com", 13],
    ["atlantico-media.example", 12],
    ["l.facebook.com", 10],
    ["linkedin.com", 7],
    ["t.co", 6],
    ["instagram.com", 5],
    ["bsky.app", 3],
    ["reddit.com", 2],
    ["news.google.com", 4],
    ["flipboard.com", 2],
    ["duckduckgo.com", 2],
  ] as const);
}

const client = await new MongoClient(shared.MONGODB_URL!).connect();
const db = client.db(databaseName);
const cache = new Redis(shared.REDIS_CACHE_URL!);
const password = `Shortn-Marketing-${randomBytes(8).toString("hex")}!`;
const email = "marta.ribeiro@atlantico-media.example";
let slugOf = "";
let ids: {
  flagship: string;
  campaign: string;
  qr: string;
  bio: string;
  webhook: string;
  importJob: string;
  safetyKey: string;
  socialIds: string[];
};

async function upsertUser(input: {
  name: string;
  email: string;
  username: string;
}) {
  const userId = new ObjectId();
  await db.collection(physicalNames.user).insertOne({
    _id: userId,
    email: input.email,
    name: input.name,
    username: input.username,
    displayUsername: input.username,
    emailVerified: true,
    locale: "pt",
    image: null,
    createdAt: new Date(now.getTime() - 400 * DAY),
    updatedAt: now,
  });
  return userId;
}

try {
  await db.dropDatabase();
  await cache.flushdb();
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      (item) => item.name,
    ),
  );
  for (const key of legacyCollectionKeys)
    if (!existing.has(physicalNames[key]))
      await db.createCollection(physicalNames[key]);
  await syncIndexes(db);

  const userId = await upsertUser({
    name: "Marta Ribeiro",
    email,
    username: "martaribeiro",
  });
  await db.collection(physicalNames.account).insertOne({
    userId,
    providerId: "credential",
    accountId: String(userId),
    password: await hashPassword(password),
    createdAt: now,
    updatedAt: now,
  });
  const identity = {
    id: String(userId),
    name: "Marta Ribeiro",
    email,
    username: "martaribeiro",
  };
  const personal = await ensurePersonalWorkspace(db, identity);
  const subscription = (workspaceId: ObjectId, id: string) =>
    collection(db, "subscriptions").insertOne({
      _id: new ObjectId(),
      workspaceId,
      polarSubscriptionId: id,
      polarCustomerId: "local-fixture",
      productId: "local-fixture",
      status: "active",
      plan: "pro",
      currentPeriodStart: new Date(now.getTime() - 12 * DAY),
      currentPeriodEnd: new Date(now.getTime() + 18 * DAY),
      cancelAtPeriodEnd: false,
    });
  await subscription(personal._id, "marketing-personal");
  const created = await createWorkspace(db, identity, {
    name: "Atlântico Media",
    slug: "atlantico-media",
  });
  if (!created.ok) throw new Error(created.error);
  await subscription(created.value._id, "marketing-team");
  const features = {
    api: true,
    mcp: true,
    webhooks: true,
    bulk: true,
    linkRules: true,
    advancedAuth: true,
  };
  await collection(db, "workspaces").updateMany(
    { _id: { $in: [personal._id, created.value._id] } },
    {
      $set: {
        plan: "pro",
        platformFeatures: features,
        createdAt: new Date(now.getTime() - 400 * DAY),
      },
    },
  );
  const workspace: Workspace = {
    ...created.value,
    plan: "pro",
    platformFeatures: features,
  };
  slugOf = workspace.slug;
  const ctx: ServiceContext = {
    db,
    workspace,
    actor: { userId: String(userId), role: "owner" },
    cache,
    linkDomain: shared.LINK_DOMAIN!,
  };

  console.log("Seeding links…");
  const specs = buildSpecs();
  const flagship: Spec = {
    category: "agenda",
    createdAt: at(86, 9),
    weight: 0,
    campaign: "Encontros Atlântico 2026",
    input: {
      url: "https://agenda2026.example/encontros-atlantico/programa",
      title: "Encontros Atlântico 2026 — programa e bilhetes",
      key: "encontros26",
      tags: ["agenda-2026", "eventos", "print", "social"],
      description:
        "Três dias de conversas, concertos e oficinas em Lisboa, Porto e Funchal.",
      rules: {
        activeFrom: new Date(
          Math.floor((now.getTime() - 86 * DAY) / 3_600_000) * 3_600_000,
        ).toISOString(),
        expiresAt: new Date(
          Date.UTC(now.getUTCFullYear() + 1, 4, 18, 23, 0),
        ).toISOString(),
        expiredUrl: "https://agenda2026.example/encontros-atlantico/arquivo",
        geo: [
          {
            country: "ES",
            url: "https://agenda2026.example/es/encuentros-atlantico",
          },
          {
            country: "BR",
            url: "https://agenda2026.example/br/encontros-atlantico",
          },
        ],
        device: [
          {
            os: "ios",
            url: "https://atlantico-media.example/app/ios?evento=encontros26",
          },
          {
            os: "android",
            url: "https://atlantico-media.example/app/android?evento=encontros26",
          },
        ],
        rotation: [
          {
            url: "https://agenda2026.example/encontros-atlantico/programa",
            weight: 70,
          },
          {
            url: "https://agenda2026.example/encontros-atlantico/programa-b",
            weight: 30,
          },
        ],
        utm: {
          source: "shortn",
          medium: "qr",
          campaign: "encontros-atlantico-2026",
        },
      },
    },
  };
  specs.push(flagship);
  specs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const gated = [
    "Edição digital para assinantes — domingo",
    "Arquivo premium: reportagens de 2025",
    "Acesso antecipado: Encontros Atlântico (imprensa)",
  ];
  for (const [index, title] of gated.entries())
    specs.push({
      category: "article",
      createdAt: at(5 + index * 9, 7),
      weight: 0.8,
      input: {
        url: `https://atlantico-media.example/assinantes/${slug(title, 5)}`,
        title,
        tags: ["assinaturas"],
        key: uniqueKey(slug(title, 3)),
        password: "atlantico-2026",
        passwordHint: "Código enviado na newsletter de domingo",
      },
    });
  for (let start = 0; start < specs.length; start += 200) {
    const batch = specs.slice(start, start + 200);
    const result = await createMany(
      ctx,
      batch.map((spec) => spec.input),
    );
    if (!result.ok)
      throw new Error(
        `Link batch failed: ${result.error} ${JSON.stringify(result)}`,
      );
    result.value.forEach((view, index) => {
      batch[index]!.id = new ObjectId(view.id);
    });
  }
  await db.collection(physicalNames.links).bulkWrite(
    specs.map((spec) => ({
      updateOne: {
        filter: { _id: spec.id! },
        update: {
          $set: {
            createdAt: spec.createdAt,
            updatedAt: spec.createdAt,
            date: spec.createdAt,
            safetyStatus: "safe",
            requiresInterstitial: false,
            flagged: false,
            lastScannedAt: spec.createdAt,
            "safety.status": "safe",
            "safety.interstitial": false,
            "safety.flagged": false,
          },
          $unset: { safetyScan: "", health: "" },
        },
      },
    })),
    { ordered: false },
  );

  const archived = specs
    .filter(
      (spec) =>
        spec.category === "article" &&
        !spec.campaign &&
        spec.createdAt.getTime() < now.getTime() - 300 * DAY,
    )
    .slice(0, 90)
    .map((spec) => String(spec.id));
  const archive = await setLinksArchived(ctx, archived, true);
  if (!archive.ok) throw new Error(archive.error);

  const suspicious = specs.find(
    (spec) => spec.category === "article" && spec.input.key && !spec.campaign,
  )!;
  await db.collection(physicalNames.links).updateOne(
    { _id: suspicious.id! },
    {
      $set: {
        longUrl: "https://promo-atlantico-premios.example/ganhe-ja",
        destination: "https://promo-atlantico-premios.example/ganhe-ja",
        title: "Sorteio de assinaturas — página externa",
        safetyStatus: "suspicious",
        riskScore: 0.71,
        flagged: true,
        requiresInterstitial: true,
        "safety.status": "suspicious",
        "safety.riskScore": 0.71,
        "safety.flagged": true,
        "safety.interstitial": true,
      },
    },
  );

  console.log("Seeding campaigns…");
  const campaignDescriptions: Record<string, string> = {
    "Encontros Atlântico 2026":
      "Programa, bilhetes e transmissões dos Encontros Atlântico em Lisboa, Porto e Funchal.",
    "Newsletter de Domingo":
      "Todas as edições da newsletter de domingo, com links para reportagens e arquivo.",
    "Feira do Livro — Livraria Atlântico":
      "Lançamentos, pré-vendas e sessões de autógrafos da Livraria Atlântico.",
    "Podcast Maré Alta — Temporada 3":
      "Episódios da terceira temporada e cortes para redes sociais.",
    "Assinaturas Primavera 2026":
      "Campanha de assinaturas digitais e edições para assinantes.",
  };
  const campaignIds = new Map<string, string>();
  for (const [title, description] of Object.entries(campaignDescriptions)) {
    const result = await createCampaign(ctx, { title, description });
    if (!result.ok) throw new Error(result.error);
    campaignIds.set(title, result.value.id);
    const members = specs
      .filter((spec) => spec.campaign === title)
      .map((spec) => String(spec.id));
    for (let start = 0; start < members.length; start += 500) {
      const moved = await moveLinksToCampaign(
        ctx,
        members.slice(start, start + 500),
        result.value.id,
      );
      if (!moved.ok) throw new Error(moved.error);
    }
  }

  console.log("Seeding QR codes…");
  const qrTargets = specs
    .filter(
      (spec) =>
        spec !== flagship &&
        spec.input.tags?.includes("print") &&
        !archived.includes(String(spec.id)),
    )
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 16);
  const navy = "#0b3954",
    coral = "#e4572e";
  const qrByLink = new Map<string, ObjectId>();
  const heroQr = await createQr(ctx, {
    url: flagship.input.url,
    title: "Cartaz Encontros Atlântico — metro de Lisboa",
    tags: ["print", "agenda-2026"],
    attachToLinkId: String(flagship.id),
    design: {
      width: 300,
      height: 300,
      type: "svg",
      shape: "square",
      margin: 8,
      frameOptions: { style: "solid", caption: "Aponte e veja o programa" },
      dotsOptions: { color: navy, type: "rounded" },
      cornersSquareOptions: { color: navy, type: "extra-rounded" },
      cornersDotOptions: { color: coral, type: "dot" },
      backgroundOptions: { color: "#ffffff" },
      qrOptions: { errorCorrectionLevel: "Q" },
    },
  });
  if (!heroQr.ok) throw new Error(`QR: ${heroQr.error}`);
  qrByLink.set(String(flagship.id), new ObjectId(heroQr.value.id));
  for (const [index, spec] of qrTargets.entries()) {
    const result = await createQr(ctx, {
      url: spec.input.url,
      title:
        `${index % 2 ? "Edição impressa" : "Cartaz"} — ${spec.input.title}`.slice(
          0,
          110,
        ),
      tags: ["print"],
      attachToLinkId: String(spec.id),
      design: {
        width: 300,
        height: 300,
        type: "svg",
        shape: index % 5 === 0 ? "circle" : "square",
        frameOptions:
          index % 3 === 0
            ? { style: "outline", caption: "Leia no telemóvel" }
            : { style: "none" },
        dotsOptions: { color: index % 2 ? "#111827" : navy, type: "rounded" },
        backgroundOptions: { color: "#ffffff" },
      },
    });
    if (!result.ok) throw new Error(`QR: ${result.error}`);
    qrByLink.set(String(spec.id), new ObjectId(result.value.id));
  }
  await db.collection(physicalNames.links).updateMany(
    { workspaceId: workspace._id, isQrCode: true },
    {
      $set: { safetyStatus: "safe", "safety.status": "safe" },
      $unset: { safetyScan: "", health: "" },
    },
  );

  console.log("Seeding click history…");
  const linkKeys = new Map<string, string>();
  for (const doc of await db
    .collection(physicalNames.links)
    .find(
      { workspaceId: workspace._id },
      { projection: { urlCode: 1, key: 1 } },
    )
    .toArray())
    linkKeys.set(String(doc._id), String(doc.urlCode ?? doc.key));
  const totalEvents = 118_000;
  const live = specs.filter((spec) => spec !== flagship);
  const weightSum = live.reduce((sum, spec) => sum + spec.weight, 0);
  // A link's audience repeats (shared links, re-opened newsletters); a smaller
  // pool of regular readers spans the whole library.
  const visitorHash = (scope: string, size: number) =>
    createHash("sha256")
      .update(`marketing:${scope}:${Math.floor(random() * size)}`)
      .digest("hex");
  const countryTable = countries.map((c) => [c, c.weight] as const);
  const cityTables = new Map(
    countries.map((c) => [c.code, c.cities.map(([n, w]) => [n, w] as const)]),
  );
  const utmFor = (
    spec: Spec,
    scan: boolean,
    ref: string | undefined,
  ): Documents["click_events"]["utm"] => {
    if (!spec.campaign) return undefined;
    const campaign = spec.campaign;
    if (scan) return { source: "cartaz", medium: "qr", campaign };
    if (spec.category === "newsletter")
      return { source: "newsletter", medium: "email", campaign };
    if (ref === "instagram.com")
      return { source: "instagram", medium: "social", campaign };
    if (ref === "l.facebook.com")
      return { source: "facebook", medium: "social", campaign };
    if (ref === "linkedin.com")
      return { source: "linkedin", medium: "social", campaign };
    const [source, medium] = weighted([
      [["newsletter", "email"], 40],
      [["site", "referral"], 30],
      [["whatsapp", "social"], 18],
      [["spotify", "audio"], spec.category === "podcast" ? 30 : 0],
      [["parceiros", "referral"], 12],
    ] as const);
    return { source, medium, campaign };
  };
  const eventsBuffer: Omit<Documents["click_events"], "_id">[] = [];
  const flush = async () => {
    if (!eventsBuffer.length) return;
    await db
      .collection(physicalNames.click_events)
      .insertMany(eventsBuffer.splice(0), { ordered: false });
  };
  const legacyTotals: AnyBulkWriteOperation[] = [];
  async function emit(spec: Spec, count: number, decayDays: number) {
    const linkId = spec.id!;
    const start = Math.max(spec.createdAt.getTime(), windowStart.getTime());
    const span = now.getTime() - start;
    if (span <= 0) return;
    const recent = spec.createdAt.getTime() >= windowStart.getTime();
    const qrId = qrByLink.get(String(linkId));
    const audience = Math.max(3, Math.round(count * 1.4));
    for (let n = 0; n < count; n++) {
      let ts = 0;
      for (let attempt = 0; attempt < 40 && !ts; attempt++) {
        const offset =
          recent && random() < 0.72
            ? -Math.log(1 - random()) * decayDays * DAY
            : random() * span;
        if (offset > span) continue;
        const day = new Date(start + offset);
        const weekday = day.getUTCDay();
        const trend =
          0.62 + 0.38 * ((day.getTime() - windowStart.getTime()) / (90 * DAY));
        if (random() > (weekday === 0 || weekday === 6 ? 0.72 : 1) * trend)
          continue;
        day.setUTCHours(
          weighted(hourTable),
          Math.floor(random() * 60),
          Math.floor(random() * 60),
        );
        if (
          day.getTime() <= now.getTime() &&
          day.getTime() > spec.createdAt.getTime()
        )
          ts = day.getTime();
      }
      if (!ts) continue;
      const scan =
        Boolean(qrId) && random() < (spec === flagship ? 0.34 : 0.55);
      const country = weighted(countryTable);
      const ua = agent(scan);
      const ref = scan ? undefined : referrer(spec.category, ua.browser);
      const branch =
        spec === flagship
          ? country.code === "ES"
            ? "geo:0"
            : country.code === "BR"
              ? "geo:1"
              : ua.os === "iOS"
                ? "device:0"
                : ua.os === "Android"
                  ? "device:1"
                  : random() < 0.7
                    ? "rotation:0"
                    : "rotation:1"
          : "destination";
      const utm = utmFor(spec, scan, ref);
      eventsBuffer.push({
        ts: new Date(ts),
        m: {
          workspaceId: workspace._id,
          linkId,
          ...(scan && qrId ? { qrId } : {}),
          kind: scan ? "scan" : "click",
          branch,
          domain: shared.LINK_DOMAIN!,
          key: linkKeys.get(String(linkId)) ?? "",
        },
        country: country.code,
        city: weighted(cityTables.get(country.code)!),
        continent: country.continent,
        tz: country.tz,
        lang: country.lang,
        browser: ua.browser,
        os: ua.os,
        device: ua.device,
        bot: false,
        ...(ref ? { refDomain: ref, referrer: `https://${ref}/` } : {}),
        ...(utm ? { utm } : {}),
        ipHash:
          random() < 0.25
            ? visitorHash(`regular:${country.code}`, 2_500)
            : visitorHash(String(linkId), audience),
        ipPrefix: "",
        uaHash: createHash("sha256")
          .update(`${ua.os}:${ua.browser}:${Math.floor(random() * 40)}`)
          .digest("hex")
          .slice(0, 32),
      });
      if (eventsBuffer.length >= 10_000) await flush();
    }
    if (!recent) {
      const before = (windowStart.getTime() - spec.createdAt.getTime()) / DAY;
      legacyTotals.push({
        updateOne: {
          filter: { _id: linkId },
          update: {
            $set: {
              "stats.legacyTotal": Math.round(
                count *
                  (0.6 + Math.min(before, 300) / 90) *
                  (0.7 + random() * 0.6),
              ),
            },
          },
        },
      });
    }
  }
  const decayOf: Record<Category, number> = {
    article: 4,
    newsletter: 2.5,
    agenda: 14,
    livraria: 18,
    podcast: 9,
    es: 5,
    en: 5,
  };
  for (const spec of live) {
    const expected = (totalEvents * spec.weight) / weightSum;
    const ageFactor =
      spec.createdAt.getTime() >= windowStart.getTime() ? 1 : 0.55;
    await emit(
      spec,
      Math.max(1, Math.round(expected * ageFactor * (0.85 + random() * 0.3))),
      decayOf[spec.category],
    );
  }
  await emit(flagship, 9_400, 24);
  await flush();
  if (legacyTotals.length)
    await db
      .collection(physicalNames.links)
      .bulkWrite(legacyTotals, { ordered: false });
  await recomputeRollups(db, windowStart, now);
  await db
    .collection(physicalNames.links)
    .updateMany({ workspaceId: workspace._id }, [
      {
        $set: {
          "clicks.total": {
            $add: [
              { $ifNull: ["$stats.clicks", 0] },
              { $ifNull: ["$stats.scans", 0] },
              { $ifNull: ["$stats.legacyTotal", 0] },
            ],
          },
          "clicks.lastClick": { $ifNull: ["$stats.lastClickAt", null] },
        },
      },
    ]);
  const scans = await db
    .collection(physicalNames.click_events)
    .aggregate<{ _id: ObjectId; n: number; last: Date }>([
      { $match: { "m.workspaceId": workspace._id, "m.kind": "scan" } },
      { $group: { _id: "$m.qrId", n: { $sum: 1 }, last: { $max: "$ts" } } },
    ])
    .toArray();
  for (const row of scans)
    await db.collection(physicalNames.qr_codes).updateOne(
      { _id: row._id },
      {
        $set: {
          "stats.scans": row.n,
          "stats.lastScanAt": row.last,
          "clicks.total": row.n,
          "clicks.lastClick": row.last,
        },
      },
    );

  console.log("Seeding bio page…");
  const bio = await createBioPage(ctx, {
    slug: "atlantico",
    title: "Atlântico Media",
  });
  if (!bio.ok) throw new Error(bio.error);
  const draft = (await readBioDraft(ctx, bio.value.id))!;
  const bioLinks = [
    flagship,
    specs.find((spec) => spec.campaign === "Newsletter de Domingo")!,
    specs.find((spec) => spec.category === "podcast")!,
    specs.find((spec) => spec.category === "livraria")!,
    specs.find((spec) => spec.input.tags?.includes("assinaturas"))!,
  ];
  const bioTitles = [
    "Encontros Atlântico 2026 — bilhetes",
    "Assine a Newsletter de Domingo",
    "Podcast Maré Alta",
    "Livraria Atlântico",
    "Assinatura digital: 3 meses por 1 €",
  ];
  const saved = await saveBioDraft(ctx, bio.value.id, draft.revision, {
    ...draft.content,
    theme: bioPresets.ocean,
    seo: {
      title: "Atlântico Media",
      description: "Jornalismo independente a partir de Lisboa.",
      noindex: true,
    },
    blocks: [
      {
        id: "profile",
        visible: true,
        type: "profile",
        title: "Atlântico Media",
        description:
          "Jornalismo independente a partir de Lisboa.\nReportagem, livros, podcasts e encontros.",
        avatar: "https://media.atlantico-media.example/brand/avatar.png",
        align: "center",
        avatarShape: "circle",
        paidBadge: true,
      },
      {
        id: "cover",
        visible: true,
        type: "image",
        url: "https://media.atlantico-media.example/brand/encontros-2026.png",
        alt: "Encontros Atlântico 2026 — Lisboa, Porto e Funchal",
      },
      ...bioLinks.map((spec, index) => ({
        id: `link-${index}`,
        visible: true,
        type: "link" as const,
        linkId: String(spec.id),
        title: bioTitles[index]!,
        image: "",
        highlight: index === 0,
      })),
      {
        id: "about",
        visible: true,
        type: "text",
        text: "Uma redação de **24 jornalistas** em Lisboa e no Porto. Edição impressa ao domingo, newsletter diária e eventos em todo o país.",
      },
      {
        id: "listen",
        visible: true,
        type: "header",
        text: "Ouça o último episódio",
      },
      {
        id: "podcast",
        visible: true,
        type: "embed",
        provider: "youtube",
        url: "https://youtu.be/atlanticoMA3",
      },
      {
        id: "social",
        visible: true,
        type: "socials",
        items: [
          {
            platform: "instagram",
            url: "https://instagram.com/atlanticomedia",
          },
          {
            platform: "linkedin",
            url: "https://linkedin.com/company/atlantico-media",
          },
          { platform: "youtube", url: "https://youtube.com/@atlanticomedia" },
          {
            platform: "spotify",
            url: "https://open.spotify.com/show/atlantico",
          },
        ],
      },
    ],
  });
  if (!saved.ok) throw new Error(`Bio: ${saved.error}`);
  const published = await publishBioDraft(
    ctx,
    bio.value.id,
    saved.value.revision,
  );
  if (!published.ok) throw new Error(`Bio: ${published.error}`);

  console.log("Seeding members, keys, webhooks, imports…");
  const team: [string, string, "admin" | "member" | "viewer", number][] = [
    ["Tiago Moreira", "tiago.moreira", "admin", 380],
    ["Inês Carvalho", "ines.carvalho", "member", 290],
    ["Lucía Ferrer", "lucia.ferrer", "member", 140],
    ["Daniel Costa", "daniel.costa", "viewer", 35],
  ];
  for (const [name, handle, role, days] of team) {
    const memberId = await upsertUser({
      name,
      email: `${handle}@atlantico-media.example`,
      username: handle.replace(".", ""),
    });
    const joined = new Date(now.getTime() - days * DAY);
    await collection(db, "workspace_members").insertOne({
      _id: new ObjectId(),
      workspaceId: workspace._id,
      userId: String(memberId),
      role,
      invitedBy: String(userId),
      createdAt: joined,
      updatedAt: joined,
    });
  }
  await collection(db, "workspace_members").updateOne(
    { workspaceId: workspace._id, userId: String(userId) },
    { $set: { createdAt: new Date(now.getTime() - 400 * DAY) } },
  );

  const keys: [string, ApiScope[], number, number][] = [
    ["Newsletter CMS", ["links:read", "links:write", "tags:read"], 310, 0.02],
    ["Painel de dados (BI)", ["analytics:read", "links:read"], 205, 0.3],
    ["Gráfica — códigos QR", ["qr:*", "tags:read"], 160, 6],
    [
      "Agenda 2026 — sincronização",
      ["links:read", "links:write", "campaigns:read", "campaigns:write"],
      88,
      0.1,
    ],
    [
      "Assistente editorial (MCP)",
      ["links:read", "analytics:read", "workspace:read"],
      21,
      1.2,
    ],
  ];
  for (const [name, scopes, createdDaysAgo, usedDaysAgo] of keys) {
    const result = await createApiKey(ctx, { name, scopes }, pepper);
    if (!result.ok) throw new Error(result.error);
    await collection(db, "api_keys").updateOne(
      { _id: new ObjectId(result.value.key.id) },
      {
        $set: {
          createdAt: new Date(now.getTime() - createdDaysAgo * DAY),
          lastUsedAt: new Date(now.getTime() - usedDaysAgo * DAY),
        },
      },
    );
  }

  const webhook = await createWebhook(
    ctx,
    {
      name: "Redação — alertas no Slack",
      url: "https://hooks.atlantico-media.example/shortn/redacao",
      events: [
        "link.created",
        "link.clicked",
        "qr.scanned",
        "import.completed",
      ],
      enabled: true,
    },
    { enabled: true, secretKey: webhookKey },
  );
  if (!webhook.ok) throw new Error(webhook.error);
  const webhookId = new ObjectId(webhook.value.id);
  const deliveryTypes = [
    "link.clicked",
    "qr.scanned",
    "link.created",
    "link.clicked",
    "link.clicked",
    "import.completed",
    "qr.scanned",
    "link.clicked",
    "link.created",
    "link.clicked",
    "qr.scanned",
    "link.clicked",
  ] as const;
  await db.collection(physicalNames.webhook_deliveries).insertMany(
    deliveryTypes.map((type, index) => {
      const createdAt = new Date(
        now.getTime() -
          (index * 47 + 6) * 60_000 -
          Math.floor(random() * 30_000),
      );
      const failed = index === 4;
      return {
        _id: ObjectId.createFromTime(Math.floor(createdAt.getTime() / 1000)),
        workspaceId: workspace._id,
        webhookId,
        event: {
          id: crypto.randomUUID(),
          type,
          createdAt: createdAt.toISOString(),
          workspaceId: workspace._id.toHexString(),
          data: { linkId: String(flagship.id), key: "encontros26" },
        },
        status: failed ? "failed" : "delivered",
        attempts: failed ? 6 : 1,
        createdAt,
        nextAttemptAt: createdAt,
        retryUntil: new Date(createdAt.getTime() + DAY),
        expiresAt: new Date(createdAt.getTime() + 30 * DAY),
        lastStatus: failed ? 503 : 200,
        ...(failed
          ? { lastError: "HTTP 503 Service Unavailable" }
          : { deliveredAt: new Date(createdAt.getTime() + 180 + index * 11) }),
      };
    }),
  );

  const importColumns = [
    "destination",
    "slug",
    "title",
    "tags",
    "utm_source",
    "utm_medium",
    "utm_campaign",
  ];
  const importRows = Array.from({ length: 186 }, (_, index) => {
    const event = events[index % events.length]!,
      city = cities[(index * 5) % cities.length]!;
    const title = `${event} · ${city}${index >= events.length ? ` — sessão ${Math.floor(index / events.length) + 1}` : ""}`;
    const key = `ag26-${slug(city, 1)}-${index + 1}`;
    const error =
      index === 17 || index === 63
        ? "invalid_url"
        : index === 41 || index === 88 || index === 120 || index === 151
          ? "key_taken"
          : index === 99
            ? "missing_url"
            : undefined;
    const url =
      error === "missing_url"
        ? ""
        : error === "invalid_url"
          ? "agenda2026/sem-protocolo"
          : `https://agenda2026.example/${slug(city, 2)}/${slug(event, 4)}-${index + 1}`;
    return {
      cells: [
        url,
        key,
        title,
        "agenda-2026, eventos",
        "agenda",
        "print",
        "encontros-atlantico-2026",
      ],
      title,
      key,
      url,
      error,
    };
  });
  const importId = new ObjectId();
  const importCreated = new Date(now.getTime() - 14 * 60_000);
  await db.collection(physicalNames.import_jobs).insertOne({
    _id: importId,
    workspaceId: workspace._id,
    createdBy: String(userId),
    kind: "links",
    inputKey: `imports/${workspace._id.toHexString()}/${importId.toHexString()}.csv`,
    bytes: 41_872,
    state: "ready",
    generation: 1,
    inspected: importRows.length,
    validated: importRows.length,
    done: 0,
    total: importRows.length,
    valid: importRows.filter((row) => !row.error).length,
    invalid: importRows.filter((row) => row.error).length,
    counts: { invalid_url: 2, key_taken: 4, missing_url: 1 },
    columns: importColumns,
    preview: importRows
      .slice(0, 20)
      .map((row, index) => ({ row: index + 2, cells: row.cells })),
    mapping: {
      url: 0,
      key: 1,
      title: 2,
      tags: 3,
      utm_source: 4,
      utm_medium: 5,
      utm_campaign: 6,
    },
    quota: {
      used: 2_420,
      reserved: 0,
      requested: importRows.filter((row) => !row.error).length,
      available: null,
    },
    createdAt: importCreated,
    expiresAt: new Date(importCreated.getTime() + 7 * DAY),
    nextAttemptAt: importCreated,
    attempts: 0,
  });
  await db.collection(physicalNames.import_results).insertMany(
    importRows.map((row, index) => ({
      jobId: importId,
      generation: 1,
      position: index,
      row: index + 2,
      ...(row.url
        ? {
            input: {
              url: row.url,
              key: row.key,
              title: row.title,
              tags: ["agenda-2026", "eventos"],
            },
          }
        : {}),
      destination: row.url,
      ...(row.error ? { error: row.error } : {}),
      expiresAt: new Date(importCreated.getTime() + 7 * DAY),
    })),
  );

  ids = {
    flagship: String(flagship.id),
    campaign: campaignIds.get("Encontros Atlântico 2026")!,
    qr: heroQr.value.id,
    bio: bio.value.id,
    webhook: webhook.value.id,
    importJob: importId.toHexString(),
    safetyKey: String(suspicious.input.key),
    socialIds: specs
      .filter(
        (spec) =>
          spec.input.tags?.includes("social") &&
          !archived.includes(String(spec.id)),
      )
      .map((spec) => String(spec.id)),
  };
  console.log(
    `Seeded ${specs.length} links, ${await db.collection(physicalNames.click_events).countDocuments()} click events.`,
  );
} finally {
  cache.disconnect();
  await client.close();
}

const children: ChildProcess[] = [];
function stop(code = 0) {
  for (const child of children) {
    try {
      process.kill(-child.pid!, "SIGTERM");
    } catch {
      /* Child already stopped. */
    }
  }
  process.exit(code);
}
process.on("SIGINT", () => stop(130));
process.on("SIGTERM", () => stop(143));
children.push(
  spawn(
    "node",
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(ports.web),
    ],
    {
      cwd: `${root}apps/web`,
      env: {
        ...process.env,
        ...shared,
        SHORTN_NEXT_DIST_DIR: ".next/marketing-shots-dist",
        PORT: String(ports.web),
      },
      stdio: ["ignore", "ignore", "inherit"],
      detached: true,
    },
  ),
);

async function waitForServer() {
  for (let attempt = 0; attempt < 240; attempt++) {
    try {
      const response = await fetch(`${origin}/login`);
      if (response.status < 500) return;
    } catch {
      /* Not listening yet. */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Web server did not start.");
}

const avatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#176180"/><stop offset="1" stop-color="#0b3954"/></linearGradient></defs><rect width="256" height="256" fill="url(#g)"/><path d="M0 178 C 48 158, 88 198, 128 178 S 208 158, 256 178 V256 H0Z" fill="#e4572e" opacity=".9"/><path d="M0 200 C 48 180, 88 220, 128 200 S 208 180, 256 200 V256 H0Z" fill="#f4a259"/><text x="128" y="138" text-anchor="middle" font-family="Georgia, serif" font-size="96" font-weight="700" fill="#ffffff">A</text></svg>`;
const coverSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4a259"/><stop offset=".55" stop-color="#e4572e"/><stop offset="1" stop-color="#176180"/></linearGradient></defs><rect width="1200" height="630" fill="url(#s)"/><circle cx="880" cy="300" r="120" fill="#fde6c4" opacity=".9"/><path d="M0 420 C 200 380, 400 460, 600 420 S 1000 380, 1200 420 V630 H0Z" fill="#0b3954"/><path d="M0 480 C 200 440, 400 520, 600 480 S 1000 440, 1200 480 V630 H0Z" fill="#123c50"/><text x="72" y="170" font-family="Georgia, serif" font-size="76" font-weight="700" fill="#ffffff">Encontros</text><text x="72" y="252" font-family="Georgia, serif" font-size="76" font-weight="700" fill="#ffffff">Atlântico 2026</text><text x="76" y="320" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#fff7ec">Lisboa · Porto · Funchal — 14 a 16 de maio</text></svg>`;

async function prepare(context: BrowserContext) {
  await context.route("https://media.atlantico-media.example/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: route.request().url().includes("avatar") ? avatarSvg : coverSvg,
    }),
  );
  await context.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({ status: 204 }),
  );
  await context.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent =
      "nextjs-portal,[data-nextjs-toast],[data-nextjs-dev-tools-button],#__next-build-watcher{display:none!important}*{caret-color:transparent!important}";
    const attach = () => document.head?.appendChild(style);
    if (document.head) attach();
    else document.addEventListener("DOMContentLoaded", attach);
  });
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1600);
}

// Measures the scroll container that holds the page content (the dashboard
// shell scrolls an inner element, not the window) and, given an anchor,
// the scroll offset that puts it just below the sticky page header.
function measure({
  anchor,
  apply,
  margin,
}: {
  anchor: Element | null;
  apply: number | null;
  margin: number;
}): { bottom: number; scroll: number } {
  const scrollable = (element: Element | null): Element => {
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (
        /(auto|scroll)/.test(style.overflowY) &&
        node.scrollHeight > node.clientHeight
      )
        return node;
    }
    return document.scrollingElement ?? document.documentElement;
  };
  const root = document.querySelector("main") ?? document.body;
  const container = scrollable(anchor ?? root);
  if (apply !== null) {
    container.scrollTop = apply;
    return { bottom: 0, scroll: container.scrollTop };
  }
  const top =
    container === document.scrollingElement
      ? 0
      : container.getBoundingClientRect().top;
  let bottom = 0;
  for (const element of root.querySelectorAll("*")) {
    if (element.children.length) continue;
    const rect = element.getBoundingClientRect();
    if (rect.height > 0 && rect.width > 0)
      bottom = Math.max(bottom, rect.bottom + container.scrollTop);
  }
  let scroll = 0;
  if (anchor) {
    const sticky = [...container.querySelectorAll("*")].find(
      (element) => getComputedStyle(element).position === "sticky",
    );
    scroll = Math.max(
      0,
      anchor.getBoundingClientRect().top -
        top +
        container.scrollTop -
        (sticky?.getBoundingClientRect().height ?? 0) -
        margin,
    );
  }
  return { bottom: Math.ceil(bottom), scroll: Math.floor(scroll) };
}

async function capture(
  page: Page,
  name: string,
  theme: "light" | "dark",
  options: typeof desktop,
  anchor?: Locator,
  margin = 24,
) {
  await settle(page);
  const target = anchor ? await anchor.first().elementHandle() : null;
  const { bottom, scroll } = await page.evaluate(measure, {
    anchor: target,
    apply: null,
    margin,
  });
  if (theme === "light") {
    await page.setViewportSize({
      width: options.width,
      height: Math.min(4000, Math.max(options.height, bottom + 40)),
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${scratch}${name}-full.png` });
  }
  const height = Math.round(
    Math.min(
      options.maxHeight,
      Math.max(options.height * 0.7, bottom - scroll + 40),
    ),
  );
  await page.setViewportSize({ width: options.width, height });
  await page.evaluate(measure, { anchor: target, apply: scroll, margin });
  await page.waitForTimeout(600);
  const png = `${scratch}${name}-${theme}.png`;
  await page.screenshot({ path: png, animations: "disabled" });
  await sharp(png)
    .resize({ width: options.output })
    .webp({ quality: 82 })
    .toFile(`${shotsDir}${name}-${theme}.webp`);
  console.log(`  ${name}-${theme}.webp (${height} css px)`);
}

const desktop = {
  width: 1280,
  height: 800,
  scale: 2,
  output: 1600,
  maxHeight: 1000,
};
const card = {
  width: 800,
  height: 740,
  scale: 2,
  output: 1600,
  maxHeight: 740,
};
const phone = {
  width: 390,
  height: 844,
  scale: 2,
  output: 780,
  maxHeight: 844,
};
let exitCode = 0;
try {
  await waitForServer();
  await mkdir(shotsDir, { recursive: true });
  await rm(scratch, { recursive: true, force: true });
  await mkdir(scratch, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
  });
  try {
    const login = await browser.newContext({ viewport: desktop });
    await login.addCookies([{ name: "NEXT_LOCALE", value: "en", url: origin }]);
    const loginPage = await login.newPage();
    loginPage.setDefaultTimeout(180_000);
    await loginPage.goto(`${origin}/login`, { timeout: 240_000 });
    await loginPage.locator('input[name="identifier"]').fill(email);
    await loginPage.locator('input[name="password"]').fill(password);
    await loginPage.locator('button[type="submit"]').click();
    await loginPage.waitForURL((url) => !url.pathname.startsWith("/login"));
    const storageState = await login.storageState();
    await login.close();

    const ws = `${origin}/${slugOf}`;
    const only = process.argv.slice(2);
    const openDetails = (page: Page, selector: string) =>
      page
        .locator(selector)
        .evaluateAll((elements) =>
          elements.forEach((element) =>
            element instanceof HTMLDetailsElement
              ? (element.open = true)
              : undefined,
          ),
        );
    const shots: {
      name: string;
      url: string;
      device?: "phone" | "card";
      before?: (page: Page) => Promise<void>;
      anchor?: (page: Page) => Locator;
      margin?: number;
    }[] = [
      {
        name: "links",
        url: `${ws}/links?tag=social`,
        before: async (page) => {
          const onPage = await page
            .locator('input[name="ids"]')
            .evaluateAll((inputs) =>
              inputs.map((input) => (input as HTMLInputElement).value),
            );
          const chosen = [
            ...onPage.filter((_, index) => [0, 1, 2, 4, 5, 8].includes(index)),
            ...ids.socialIds.filter((id) => !onPage.includes(id)).slice(0, 136),
          ];
          await page.evaluate(
            ({ key, value }) => {
              sessionStorage.setItem(key, value);
              window.dispatchEvent(
                new CustomEvent("shortn:bulk-selection", { detail: key }),
              );
            },
            {
              key: `shortn:bulk-selection:/${slugOf}/links/delete`,
              value: JSON.stringify(chosen),
            },
          );
          await page.mouse.move(0, 0);
        },
      },
      {
        name: "analytics",
        url: `${ws}/links/${ids.flagship}/analytics?range=90d`,
        anchor: (page) => page.getByText("Filtered by", { exact: true }),
        margin: 8,
      },
      {
        name: "linkRules",
        url: `${ws}/links/${ids.flagship}/edit`,
        before: (page) =>
          openDetails(
            page,
            'fieldset:has(input[name="advancedVersion"]) > details:nth-of-type(4)',
          ),
        anchor: (page) => page.getByText("Advanced options", { exact: true }),
      },
      { name: "qrDesign", url: `${ws}/qr/${ids.qr}/design` },
      { name: "bioEditor", url: `${ws}/bio/${ids.bio}/editor` },
      { name: "bioPhone", url: `${origin}/_bio/atlantico`, device: "phone" },
      {
        name: "campaign",
        url: `${ws}/campaigns/${ids.campaign}/analytics?range=90d`,
        anchor: (page) => page.getByText("Filtered by", { exact: true }),
        margin: 8,
      },
      { name: "members", url: `${ws}/settings/members` },
      { name: "webhooks", url: `${ws}/settings/webhooks/${ids.webhook}` },
      {
        name: "apiKeys",
        url: `${ws}/settings/api-keys`,
        before: (page) => openDetails(page, "main details"),
        anchor: (page) =>
          page.getByRole("heading", { name: "Workspace keys", exact: true }),
      },
      {
        name: "imports",
        url: `${ws}/imports/${ids.importJob}`,
        before: (page) => openDetails(page, "main details"),
      },
      {
        name: "safety",
        url: `${origin}/en/safety/${ids.safetyKey}`,
        device: "card",
      },
    ];
    for (const shot of shots.filter(
      (item) => !only.length || only.includes(item.name),
    ))
      for (const theme of ["light", "dark"] as const) {
        const size =
          shot.device === "phone"
            ? phone
            : shot.device === "card"
              ? card
              : desktop;
        const context = await browser.newContext({
          storageState,
          viewport: { width: size.width, height: size.height },
          deviceScaleFactor: size.scale,
          colorScheme: theme,
          locale: "en-GB",
          timezoneId: "Europe/Lisbon",
          ...(shot.device === "phone"
            ? { isMobile: true, hasTouch: true }
            : {}),
        });
        await prepare(context);
        await context.addInitScript((value) => {
          try {
            localStorage.setItem("theme", value);
          } catch {
            /* Storage unavailable. */
          }
        }, theme);
        const page = await context.newPage();
        page.setDefaultTimeout(180_000);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const response = await page.goto(shot.url, { timeout: 240_000 });
        if (!response || response.status() >= 400)
          throw new Error(`${shot.name}: HTTP ${response?.status()}`);
        await settle(page);
        if (shot.before) await shot.before(page);
        await capture(
          page,
          shot.name,
          theme,
          size,
          shot.anchor?.(page),
          shot.margin,
        );
        if (errors.length) console.warn(`  ${shot.name}: ${errors.join("; ")}`);
        await context.close();
      }
  } finally {
    await browser.close();
  }
} catch (error) {
  console.error(error);
  exitCode = 1;
}
stop(exitCode);
