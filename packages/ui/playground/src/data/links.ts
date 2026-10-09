import type { LinkRow } from "@shortn/ui";
import { createRandom } from "./random";

/*
  Synthetic demo workspace for a fictional Portuguese business publisher ("Gazeta Exemplo").
  Headlines, people and figures are invented for the playground; none describe a real customer.
*/

export const DEMO_DOMAIN = "shortn.at";
export const PUBLISHER_HOST = "gazetaexemplo.pt";
const PUBLISHER_FAVICON = "/demo/gazeta-exemplo.svg";
const DAY = 86_400_000;

export const TEAM = [
  "Inês Marques",
  "Rui Carvalho",
  "Marta Sousa",
  "Tiago Almeida",
  "Ana Ferreira",
] as const;

const ARTICLES: ReadonlyArray<readonly [section: string, slug: string]> = [
  ["economia", "bce-mantem-taxas-de-juro-pela-terceira-reuniao-consecutiva"],
  ["economia", "inflacao-recua-para-2-1-por-cento-em-setembro"],
  ["economia", "pib-cresce-0-6-por-cento-no-terceiro-trimestre"],
  ["economia", "orcamento-do-estado-2027-o-que-muda-para-as-familias"],
  ["economia", "exportacoes-portuguesas-batem-recorde-em-agosto"],
  ["economia", "divida-publica-desce-abaixo-dos-95-por-cento-do-pib"],
  ["empresas", "pme-portuguesas-aceleram-investimento-em-automacao"],
  ["empresas", "startups-de-lisboa-captam-400-milhoes-no-semestre"],
  ["empresas", "grupo-textil-do-norte-abre-nova-fabrica-em-barcelos"],
  ["empresas", "como-as-empresas-familiares-preparam-a-sucessao"],
  ["empresas", "cinco-licoes-de-gestao-da-industria-do-calcado"],
  ["mercados", "psi-fecha-semana-em-alta-com-energia-a-liderar"],
  ["mercados", "procura-por-obrigacoes-do-tesouro-supera-oferta-em-tres-vezes"],
  ["mercados", "euro-recupera-face-ao-dolar-apos-dados-do-emprego"],
  ["mercados", "ouro-atinge-novo-maximo-historico"],
  ["imobiliario", "precos-das-casas-sobem-7-por-cento-em-lisboa-e-porto"],
  ["imobiliario", "credito-a-habitacao-taxa-fixa-ou-variavel-em-2027"],
  ["imobiliario", "arrendamento-acessivel-novas-regras-explicadas"],
  ["energia", "leilao-solar-atribui-1-2-gigawatts-no-alentejo"],
  ["energia", "tarifas-de-eletricidade-descem-em-janeiro"],
  ["energia", "hidrogenio-verde-em-sines-avanca-para-segunda-fase"],
  ["fiscalidade", "irs-jovem-quem-beneficia-e-como-pedir"],
  ["fiscalidade", "guia-do-iva-para-trabalhadores-independentes"],
  ["fiscalidade", "prazos-fiscais-de-novembro-que-nao-pode-esquecer"],
  ["fiscalidade", "beneficios-fiscais-a-inovacao-o-que-muda"],
  ["emprego", "desemprego-cai-para-6-1-por-cento"],
  ["emprego", "teletrabalho-tres-anos-depois-o-que-ficou"],
  ["emprego", "competencias-digitais-mais-procuradas-pelos-recrutadores"],
  ["tecnologia", "inteligencia-artificial-nas-pme-casos-praticos"],
  ["tecnologia", "ciberseguranca-o-que-a-diretiva-nis2-exige-as-empresas"],
  ["tecnologia", "5g-industrial-chega-aos-parques-empresariais"],
  ["agro", "vindima-2026-producao-de-vinho-do-douro-recua"],
  ["agro", "exportacoes-de-azeite-crescem-com-precos-mais-altos"],
  ["turismo", "algarve-fecha-verao-com-ocupacao-hoteleira-de-88-por-cento"],
  ["turismo", "turismo-de-negocios-regressa-ao-porto"],
  ["opiniao", "a-produtividade-e-o-elefante-na-sala"],
  ["opiniao", "porque-e-que-as-pme-precisam-de-ganhar-escala"],
];

const CHANNELS = [
  { tag: "newsletter", source: "newsletter", medium: "email", weight: 0.3 },
  { tag: "linkedin", source: "linkedin", medium: "social", weight: 0.2 },
  { tag: "facebook", source: "facebook", medium: "social", weight: 0.1 },
  { tag: "x-twitter", source: "x", medium: "social", weight: 0.06 },
  { tag: "instagram", source: "instagram", medium: "social", weight: 0.06 },
  { tag: "print", source: "revista", medium: "qr", weight: 0.16 },
  { tag: "podcast", source: "podcast", medium: "audio", weight: 0.06 },
  { tag: "parceiros", source: "parceiro", medium: "referral", weight: 0.06 },
] as const;

const STOPWORDS = new Set(
  "a o as os de da do das dos e em no na nos nas para por pelo pela pelos pelas com que quem como ao aos um uma se sem sobre entre apos ate cento nao mais the of and to in for on with how".split(
    " ",
  ),
);

export function suggestKey(source: string): string {
  let slug: string;
  try {
    const url = new URL(source);
    slug =
      url.pathname.split("/").filter(Boolean).at(-1) ??
      url.hostname.split(".")[0] ??
      "";
  } catch {
    slug = source;
  }
  const words = slug
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.[a-z0-9]+$/, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word && !STOPWORDS.has(word));
  return words.slice(0, 3).join("-").slice(0, 32) || "link";
}

function longToken(
  random: ReturnType<typeof createRandom>,
  length: number,
): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  return Array.from(
    { length },
    () => alphabet[random.int(0, alphabet.length - 1)],
  ).join("");
}

function clicksFor(random: ReturnType<typeof createRandom>): number {
  if (random.chance(0.07)) return 0;
  if (random.chance(0.05)) return random.int(18_000, 96_000);
  return Math.round(
    Math.exp(random.next() * Math.log(6_000)) + random.int(0, 30),
  );
}

function trendFor(
  random: ReturnType<typeof createRandom>,
  clicks: number,
  ageDays: number,
  weekdayHeavy: boolean,
): number[] {
  const recentShare =
    ageDays < 30 ? 1 : Math.max(0.02, 0.6 / Math.sqrt(ageDays / 30));
  const budget = clicks * recentShare;
  const weights = Array.from({ length: 30 }, (_, index) => {
    const daysAgo = 29 - index;
    if (daysAgo > ageDays) return 0;
    const sinceLaunch = ageDays - daysAgo;
    const launchDecay =
      ageDays < 45
        ? Math.exp(-sinceLaunch / 6) + 0.08
        : 0.5 + random.next() * 0.5;
    const weekday = new Date(Date.now() - daysAgo * DAY).getDay();
    const weekly = weekdayHeavy && (weekday === 0 || weekday === 6) ? 0.35 : 1;
    return launchDecay * weekly * (0.75 + random.next() * 0.5);
  });
  const total = weights.reduce((sum, value) => sum + value, 0) || 1;
  return weights.map((weight) => Math.round((weight / total) * budget));
}

export function generateLinks(count = 200): LinkRow[] {
  const random = createRandom(20261009);
  const now = Date.now();
  const used = new Set<string>();
  const links: LinkRow[] = [];

  const uniqueKey = (base: string) => {
    let key = base.slice(0, 64);
    let suffix = 2;
    while (used.has(key)) key = `${base.slice(0, 60)}-${suffix++}`;
    used.add(key);
    return key;
  };

  for (let index = 0; index < count; index++) {
    const ageDays = Math.pow((index + random.next()) / count, 1.6) * 540;
    const createdAt = new Date(now - ageDays * DAY);
    const kind = random.next();
    const channelRoll = random.next();
    let cumulative = 0;
    const channel =
      CHANNELS.find(
        (candidate) => (cumulative += candidate.weight) >= channelRoll,
      ) ?? CHANNELS[0];
    const [section, slug] = random.pick(ARTICLES);
    const campaignDate = createdAt.toISOString().slice(0, 10);
    const utm = `utm_source=${channel.source}&utm_medium=${channel.medium}&utm_campaign=${channel.tag === "newsletter" ? `matinal-${campaignDate}` : `${section}-${campaignDate.slice(0, 7)}`}`;

    let url: string;
    let keyBase: string;
    let tags: string[] = [channel.tag];

    if (kind < 0.62) {
      url = `https://${PUBLISHER_HOST}/${section}/${slug}?${utm}`;
      keyBase = random.chance(0.28)
        ? longToken(random, 7).replace(/[-_]/g, "x")
        : suggestKey(slug);
      if (random.chance(0.35)) tags.push(section);
    } else if (kind < 0.72) {
      url = `https://${PUBLISHER_HOST}/newsletters/${random.pick(["matinal", "mercados-a-fecho", "fiscal-semanal"])}?${utm}`;
      keyBase = random.pick([
        "nl-matinal",
        "nl-mercados",
        "nl-fiscal",
        "subscrever",
      ]);
      tags = ["newsletter", "assinaturas"];
    } else if (kind < 0.8) {
      url = `https://assinaturas.${PUBLISHER_HOST}/${random.pick(["digital-anual", "digital-mensal", "papel-e-digital"])}?promo=${random.pick(["OUT26", "PME26", "ESTUDANTE"])}&${utm}`;
      keyBase = random.pick([
        "assinar",
        "assinatura-digital",
        "oferta-pme",
        "promo-outubro",
      ]);
      tags = [channel.tag, "assinaturas"];
    } else if (kind < 0.86) {
      url = `https://eventos.${PUBLISHER_HOST}/${random.pick(["conferencia-pme-2026", "forum-fiscal-2026", "premios-exportacao-2026"])}/inscricao?${utm}`;
      keyBase = random.pick([
        "conferencia-pme",
        "forum-fiscal",
        "premios-exportacao",
        "inscricao",
      ]);
      tags = [channel.tag, "eventos"];
    } else if (kind < 0.91) {
      url = `https://www.youtube.com/watch?v=${longToken(random, 11)}`;
      keyBase = `video-${suggestKey(slug)}`;
      tags = [channel.tag, "video"];
    } else if (kind < 0.95) {
      url = `https://open.spotify.com/episode/${longToken(random, 22).replace(/[-_]/g, "q")}`;
      keyBase = `podcast-ep${random.int(80, 164)}`;
      tags = ["podcast", channel.tag === "podcast" ? "spotify" : channel.tag];
    } else {
      url = `https://${PUBLISHER_HOST}/media/${random.pick(["guia-fiscal-2027", "barometro-pme-outono", "relatorio-exportacao-2026"])}.pdf`;
      keyBase = random.pick([
        "guia-fiscal",
        "barometro-pme",
        "relatorio-exportacao",
      ]);
      tags = [channel.tag, "ebook"];
    }

    if (channel.tag === "print") keyBase = `print-${keyBase}`.slice(0, 40);
    const clicks = clicksFor(random);
    const host = new URL(url).hostname;

    links.push({
      id: `lnk_${(index + 1).toString(36).padStart(4, "0")}`,
      domain: DEMO_DOMAIN,
      key: uniqueKey(keyBase),
      url,
      tags: [...new Set(tags)],
      clicks,
      trend: trendFor(
        random,
        clicks,
        ageDays,
        channel.tag === "newsletter" || channel.tag === "linkedin",
      ),
      createdAt: createdAt.toISOString(),
      createdBy: random.pick(TEAM),
      ...(host.endsWith(PUBLISHER_HOST)
        ? { faviconSrc: PUBLISHER_FAVICON }
        : {}),
    });
  }

  addLongContent(links, random, uniqueKey);
  return links;
}

function addLongContent(
  links: LinkRow[],
  random: ReturnType<typeof createRandom>,
  uniqueKey: (base: string) => string,
) {
  const longKeys = [
    "conferencia-pme-2026-inscricao-antecipada-desconto-socios-lisboa",
    "relatorio-anual-de-exportacao-2026-versao-integral-assinantes-pt",
    "guia-pratico-orcamento-do-estado-2027-pequenas-e-medias-empresas",
  ];
  const targets = [3, 17, 41];
  targets.forEach((position, index) => {
    const link = links[position];
    const key = longKeys[index];
    if (link && key) link.key = uniqueKey(key);
  });

  const trackingLink = links[9];
  if (trackingLink) {
    const state = longToken(random, 1_760);
    trackingLink.url = `https://assinaturas.${PUBLISHER_HOST}/checkout?plan=digital-anual&promo=OUT26&utm_source=newsletter&utm_medium=email&utm_campaign=matinal-renovacao&utm_content=bloco-3&state=${state}`;
    trackingLink.faviconSrc = PUBLISHER_FAVICON;
  }
  const secondTracking = links[58];
  if (secondTracking) {
    secondTracking.url = `https://eventos.${PUBLISHER_HOST}/conferencia-pme-2026/inscricao?ref=${longToken(random, 1_900)}`;
    secondTracking.faviconSrc = PUBLISHER_FAVICON;
  }

  const taggy = links[12];
  if (taggy) {
    taggy.tags = [
      "newsletter",
      "print",
      "linkedin",
      "assinaturas",
      "eventos",
      ...Array.from({ length: 45 }, (_, index) => `edicao-${1001 + index}`),
    ];
  }
}

export function isLongContent(link: LinkRow): boolean {
  return link.key.length > 48 || link.url.length > 500 || link.tags.length > 8;
}
