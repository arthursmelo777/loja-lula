/**
 * Previsão de entrega a partir do destino do pedido.
 *
 * Isto é ESTIMATIVA, nunca rastreamento. A diferença importa: um evento de
 * rastreio afirma onde o pacote esteve, e só a transportadora sabe disso.
 * Inventar esses eventos faria o cliente acreditar que a encomenda está a
 * caminho quando talvez nem tenha sido postada — ele deixaria de cobrar no
 * momento certo e descobriria tarde demais. Aqui só projetamos prazos, e a
 * tela deixa claro que são previsões até o código real de rastreio existir.
 */

export type Regiao = "capital-sp" | "sudeste" | "sul" | "centro-oeste" | "nordeste" | "norte";

interface PrazoRegiao {
  regiao: Regiao;
  rotulo: string;
  /** Dias ÚTEIS após a postagem. */
  minimo: number;
  maximo: number;
}

const UF_POR_REGIAO: Record<Regiao, string[]> = {
  "capital-sp": ["SP"],
  sudeste: ["RJ", "MG", "ES"],
  sul: ["PR", "SC", "RS"],
  "centro-oeste": ["GO", "MT", "MS", "DF"],
  nordeste: ["BA", "PE", "CE", "MA", "PB", "RN", "AL", "SE", "PI"],
  norte: ["AM", "PA", "AC", "RO", "RR", "AP", "TO"],
};

const PRAZOS: Record<Regiao, PrazoRegiao> = {
  "capital-sp": { regiao: "capital-sp", rotulo: "São Paulo", minimo: 3, maximo: 6 },
  sudeste: { regiao: "sudeste", rotulo: "Sudeste", minimo: 4, maximo: 8 },
  sul: { regiao: "sul", rotulo: "Sul", minimo: 5, maximo: 9 },
  "centro-oeste": { regiao: "centro-oeste", rotulo: "Centro-Oeste", minimo: 6, maximo: 10 },
  nordeste: { regiao: "nordeste", rotulo: "Nordeste", minimo: 8, maximo: 14 },
  norte: { regiao: "norte", rotulo: "Norte", minimo: 10, maximo: 18 },
};

/** Prazo mais conservador, usado quando a UF não é reconhecida. */
const PADRAO = PRAZOS.nordeste;

function regiaoDaUF(uf: string): PrazoRegiao {
  const sigla = uf.trim().toUpperCase();
  for (const [regiao, ufs] of Object.entries(UF_POR_REGIAO)) {
    if (ufs.includes(sigla)) return PRAZOS[regiao as Regiao];
  }
  return PADRAO;
}

/** Soma dias úteis, pulando sábado e domingo. Não considera feriados. */
function somarDiasUteis(inicio: Date, dias: number): Date {
  const d = new Date(inicio);
  let restantes = dias;
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    const diaDaSemana = d.getDay();
    if (diaDaSemana !== 0 && diaDaSemana !== 6) restantes--;
  }
  return d;
}

export interface PrevisaoEntrega {
  /** Nome da região, para a tela explicar de onde veio o prazo. */
  regiao: string;
  /** Data prevista de postagem (ou a real, quando já houve postagem). */
  postagemPrevista: string;
  /** Janela prevista de entrega. */
  entregaMinima: string;
  entregaMaxima: string;
  /** True quando as datas partem de uma postagem que realmente aconteceu. */
  baseadaEmPostagemReal: boolean;
}

/** Dias úteis que levamos para separar, embalar e postar depois do pagamento. */
const DIAS_ATE_POSTAR = 2;

/**
 * Projeta as datas de postagem e entrega.
 *
 * Enquanto não houve postagem real, tudo parte da data do pagamento mais o
 * tempo de preparo. Assim que `shippedAt` existe, ele vira a âncora e a janela
 * de entrega passa a ser contada a partir dele — a previsão fica mais firme,
 * sem nunca deixar de ser previsão.
 */
export function estimarEntrega(
  uf: string,
  pagoEm: string | Date,
  postadoEm?: string | Date | null
): PrevisaoEntrega {
  const prazo = regiaoDaUF(uf);

  const base = postadoEm ? new Date(postadoEm) : new Date(pagoEm);
  if (Number.isNaN(base.getTime())) {
    // Data inválida: não dá para prever nada com honestidade.
    const agora = new Date();
    return {
      regiao: prazo.rotulo,
      postagemPrevista: agora.toISOString(),
      entregaMinima: somarDiasUteis(agora, prazo.minimo).toISOString(),
      entregaMaxima: somarDiasUteis(agora, prazo.maximo).toISOString(),
      baseadaEmPostagemReal: false,
    };
  }

  const postagem = postadoEm ? base : somarDiasUteis(base, DIAS_ATE_POSTAR);

  return {
    regiao: prazo.rotulo,
    postagemPrevista: postagem.toISOString(),
    entregaMinima: somarDiasUteis(postagem, prazo.minimo).toISOString(),
    entregaMaxima: somarDiasUteis(postagem, prazo.maximo).toISOString(),
    baseadaEmPostagemReal: Boolean(postadoEm),
  };
}
