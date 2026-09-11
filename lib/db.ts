import { Pool, type QueryResultRow } from "pg";
import type {
  OrderRecord,
  OrderItemRecord,
  OrderStatus,
  ReviewRecord,
  ProductRatingSummary,
  CouponRecord,
} from "@/types";
import { estimarEntrega, type PrevisaoEntrega } from "./entrega";

declare global {
  var __pgPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não configurada. Defina a variável de ambiente antes de usar o banco de dados."
    );
  }
  avisarSeSenhaMalEscapada(connectionString);

  return new Pool({
    connectionString,
    // Supabase/managed Postgres normalmente exigem SSL; em desenvolvimento local
    // sem SSL isso é ignorado pela maioria dos drivers.
    ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
    max: 5,
  });
}

/**
 * A DATABASE_URL é uma URI: o driver decodifica a senha com percent-decoding
 * antes de mandar para o Postgres. Uma senha que contenha "%" literal precisa
 * estar escrita como "%25" — senão "…%2f…" vira "…/…" e a autenticação falha
 * com "password authentication failed", um erro que parece senha errada e faz
 * a pessoa trocar a senha à toa. Caracteres como @ : / ? # também precisam ser
 * escapados. Só avisamos: nunca logamos a senha.
 */
function avisarSeSenhaMalEscapada(connectionString: string): void {
  const match = /^[^:]+:\/\/[^:@/]*:([^@]*)@/.exec(connectionString);
  const senha = match?.[1];
  if (!senha) return;

  // Um "%" que não inicia um par hexadecimal válido é percent-encoding quebrado.
  const percentSolto = /%(?![0-9A-Fa-f]{2})/.test(senha);
  // Um "%XX" válido é decodificado — se o resultado muda, a senha enviada ao
  // banco não é a que está escrita no .env.
  let decodificaDiferente = false;
  try {
    decodificaDiferente = decodeURIComponent(senha) !== senha;
  } catch {
    decodificaDiferente = true;
  }

  if (percentSolto || decodificaDiferente) {
    console.warn(
      "[db] Atenção: a senha dentro de DATABASE_URL contém '%' e será decodificada " +
        "pelo driver antes de chegar ao Postgres — a senha enviada NÃO é a que está " +
        "escrita no .env. Se a conexão falhar com 'password authentication failed', " +
        "escreva cada '%' literal da senha como '%25' (e escape também @ : / ? #)."
    );
  }
}

function getPool(): Pool {
  if (!global.__pgPool) {
    global.__pgPool = createPool();
  }
  return global.__pgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query<T>(text, params);
  return result.rows;
}

/**
 * Executa uma leitura *decorativa* (notas médias e avaliações) que enfeita a
 * vitrine, mas da qual nada na jornada de compra depende. Se o Postgres estiver
 * fora do ar, inacessível ou com credencial inválida, a home e as páginas de
 * produto precisam continuar abrindo normalmente: sem este wrapper, uma falha
 * de banco derruba a loja inteira em erro 500 — sem catálogo, sem link de
 * produto e sem checkout — que é exatamente o sintoma de "clicar no produto e
 * não abrir".
 *
 * Leituras e escritas de pedido/pagamento NUNCA usam este wrapper: ali um erro
 * precisa estourar de verdade, jamais virar um resultado vazio silencioso que
 * faria a loja mentir sobre o estado de uma cobrança.
 */
async function leituraOpcional<T>(rotulo: string, executar: () => Promise<T>, padrao: T): Promise<T> {
  try {
    return await executar();
  } catch (err) {
    console.error(`Leitura opcional "${rotulo}" falhou; a loja segue sem ela:`, err);
    return padrao;
  }
}

let schemaEnsured = false;

/**
 * Cria as tabelas caso não existam. Chamado sob demanda pelas rotas de API
 * (nunca durante o build), para permitir deploy sem depender de migrations
 * externas para o MVP.
 */
export async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      review_token TEXT,
      transaction_hash TEXT,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_document TEXT NOT NULL,

      street TEXT NOT NULL,
      number TEXT NOT NULL,
      complement TEXT,
      neighborhood TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      zip_code TEXT NOT NULL,

      subtotal INTEGER NOT NULL,
      discount INTEGER NOT NULL DEFAULT 0,
      coupon_code TEXT,
      total INTEGER NOT NULL,

      payment_method TEXT NOT NULL DEFAULT 'pix',
      payment_status TEXT NOT NULL DEFAULT 'pending',

      pix_qr_code TEXT,
      pix_qr_code_text TEXT,
      raw_gateway_response JSONB,

      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_content TEXT,
      utm_term TEXT,

      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      variant TEXT,
      custom_name TEXT,
      unit_price INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      total INTEGER NOT NULL
    );

    -- Colunas adicionadas depois do lançamento inicial: seguras de rodar em banco já existente.
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_token TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS custom_name TEXT;

    -- Dados do navegador do comprador, guardados no checkout para a Conversions
    -- API do Meta: o Purchase é enviado a partir do webhook do gateway, que não
    -- tem acesso a cookie, IP nem user-agent de quem comprou.
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS meta_fbp TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS meta_fbc TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_ip TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_user_agent TEXT;

    CREATE TABLE IF NOT EXISTS reviews (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (order_id, product_id)
    );

    -- Cupom de desconto ganho ao avaliar um pedido, resgatável numa compra futura.
    CREATE TABLE IF NOT EXISTS coupons (
      id BIGSERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      discount_percent SMALLINT NOT NULL,
      source_order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      used_order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ
    );

    -- Rastreio da entrega. Vão como ALTER porque a tabela orders já existe em
    -- produção: CREATE TABLE IF NOT EXISTS não adiciona coluna em tabela criada
    -- antes, então sem isto as colunas nunca apareceriam no banco atual.
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_code TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_orders_transaction_hash ON orders (transaction_hash);
    CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders (payment_status);
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews (product_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews (created_at);
    CREATE INDEX IF NOT EXISTS idx_coupons_source_order_id ON coupons (source_order_id);
  `);
  schemaEnsured = true;
}

export interface CreateOrderInput {
  customer: {
    name: string;
    email: string;
    phone: string;
    document: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  items: Array<{
    productId: string;
    productName: string;
    variant: string | null;
    customName: string | null;
    unitPrice: number;
    quantity: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  couponCode: string | null;
  total: number;
  utm: {
    src: string;
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
    utm_term: string;
    utm_content: string;
  };
  /** Dados do navegador do comprador usados pela Conversions API do Meta. */
  meta: {
    fbp: string | null;
    fbc: string | null;
    clientIp: string | null;
    userAgent: string | null;
  };
}

export async function createOrder(input: CreateOrderInput): Promise<OrderRecord> {
  await ensureSchema();
  const reviewToken = crypto.randomUUID();
  // 25 placeholders numerados + 2 literais ('pix','pending') = 27 colunas.
  // Ao mexer aqui, recontar as duas listas — um desalinhamento já quebrou o checkout uma vez.
  const rows = await query<OrderRecord>(
    `INSERT INTO orders (
      review_token,
      customer_name, customer_email, customer_phone, customer_document,
      street, number, complement, neighborhood, city, state, zip_code,
      subtotal, discount, coupon_code, total, payment_method, payment_status,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      meta_fbp, meta_fbc, client_ip, client_user_agent
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'pix','pending',$17,$18,$19,$20,$21,$22,$23,$24,$25)
    RETURNING *`,
    [
      reviewToken,
      input.customer.name,
      input.customer.email,
      input.customer.phone,
      input.customer.document,
      input.customer.street,
      input.customer.number,
      input.customer.complement ?? "",
      input.customer.neighborhood,
      input.customer.city,
      input.customer.state,
      input.customer.zipCode,
      input.subtotal,
      input.discount,
      input.couponCode,
      input.total,
      input.utm.utm_source,
      input.utm.utm_medium,
      input.utm.utm_campaign,
      input.utm.utm_content,
      input.utm.utm_term,
      input.meta.fbp,
      input.meta.fbc,
      input.meta.clientIp,
      input.meta.userAgent,
    ]
  );
  const order = rows[0];

  for (const item of input.items) {
    await query(
      `INSERT INTO order_items (order_id, product_id, product_name, variant, custom_name, unit_price, quantity, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        order.id,
        item.productId,
        item.productName,
        item.variant,
        item.customName,
        item.unitPrice,
        item.quantity,
        item.total,
      ]
    );
  }

  return order;
}

export async function attachTransaction(
  orderId: number,
  transactionHash: string,
  qrCodeImage: string | null,
  qrCodeText: string | null,
  raw: unknown
): Promise<void> {
  await ensureSchema();
  await query(
    `UPDATE orders
     SET transaction_hash = $2, pix_qr_code = $3, pix_qr_code_text = $4, raw_gateway_response = $5, updated_at = now()
     WHERE id = $1`,
    [orderId, transactionHash, qrCodeImage, qrCodeText, JSON.stringify(raw)]
  );
}

export async function getOrderById(id: number): Promise<OrderRecord | undefined> {
  await ensureSchema();
  const rows = await query<OrderRecord>(`SELECT * FROM orders WHERE id = $1`, [id]);
  return rows[0];
}

export async function getOrderByTransactionHash(hash: string): Promise<OrderRecord | undefined> {
  await ensureSchema();
  const rows = await query<OrderRecord>(`SELECT * FROM orders WHERE transaction_hash = $1`, [hash]);
  return rows[0];
}

export async function getOrderItems(orderId: number): Promise<OrderItemRecord[]> {
  await ensureSchema();
  return query<OrderItemRecord>(`SELECT * FROM order_items WHERE order_id = $1 ORDER BY id`, [orderId]);
}

/** `changedToPaid` indica se este chamado foi o que realmente confirmou o pagamento
 *  (status anterior não era "paid") — usado pra disparar o evento de compra pro
 *  Meta só uma vez, mesmo com múltiplos polls/webhooks batendo no mesmo pedido. */
export async function updateOrderStatus(
  orderId: number,
  status: OrderStatus
): Promise<{ changedToPaid: boolean }> {
  await ensureSchema();

  if (status === "paid") {
    // Atômico de propósito. O webhook da processadora e o polling da tela de
    // pagamento podem confirmar o MESMO pedido ao mesmo tempo. Com um SELECT
    // seguido de UPDATE, os dois liam "ainda não pago", os dois recebiam
    // changedToPaid = true e o evento Purchase era enviado duas vezes — venda
    // duplicada no Gerenciador de Anúncios, inflando o ROAS com faturamento
    // que não existiu.
    //
    // Numa única instrução, o primeiro que chegar trava a linha e grava; o
    // segundo espera o lock, reavalia o WHERE contra o valor já gravado, não
    // casa e volta sem linha nenhuma. Exatamente um caller recebe `true`.
    const linhasAfetadas = await query<{ id: string }>(
      `UPDATE orders SET payment_status = 'paid', updated_at = now()
       WHERE id = $1 AND payment_status <> 'paid'
       RETURNING id`,
      [orderId]
    );
    return { changedToPaid: linhasAfetadas.length > 0 };
  }

  await query(`UPDATE orders SET payment_status = $2, updated_at = now() WHERE id = $1`, [orderId, status]);
  // Pedido cancelado (pagamento não concluído) devolve o cupom usado nele, se houver,
  // pra não queimar o benefício de quem nem chegou a pagar.
  if (status === "canceled") {
    await query(
      `UPDATE coupons SET used_order_id = NULL, used_at = NULL WHERE used_order_id = $1`,
      [orderId]
    );
  }

  // Qualquer status diferente de "paid" nunca é uma confirmação de pagamento;
  // o caso "paid" já retornou acima.
  return { changedToPaid: false };
}

export async function listOrders(filter?: OrderStatus): Promise<OrderRecord[]> {
  await ensureSchema();
  if (filter) {
    return query<OrderRecord>(
      `SELECT * FROM orders WHERE payment_status = $1 ORDER BY created_at DESC LIMIT 200`,
      [filter]
    );
  }
  return query<OrderRecord>(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 200`);
}

// ---------------------------------------------------------------------------
// Avaliações (reviews)
//
// Só é possível avaliar um item de um pedido pago, e só quem tem o
// `review_token` do pedido (entregue apenas na tela de sucesso do próprio
// comprador) — assim ninguém consegue postar avaliação em nome de outro
// cliente adivinhando o id sequencial do pedido.
// ---------------------------------------------------------------------------

export interface CreateReviewInput {
  orderId: number;
  productId: string;
  customerName: string;
  rating: number;
  comment: string | null;
}

export async function createReview(input: CreateReviewInput): Promise<ReviewRecord> {
  await ensureSchema();
  const rows = await query<ReviewRecord>(
    `INSERT INTO reviews (order_id, product_id, customer_name, rating, comment)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [input.orderId, input.productId, input.customerName, input.rating, input.comment]
  );
  return rows[0];
}

export async function getReviewForOrderProduct(
  orderId: number,
  productId: string
): Promise<ReviewRecord | undefined> {
  await ensureSchema();
  const rows = await query<ReviewRecord>(
    `SELECT * FROM reviews WHERE order_id = $1 AND product_id = $2`,
    [orderId, productId]
  );
  return rows[0];
}

export async function getReviewsForProduct(productId: string, limit = 50): Promise<ReviewRecord[]> {
  return leituraOpcional(`avaliações de ${productId}`, async () => {
    await ensureSchema();
    return query<ReviewRecord>(
      `SELECT * FROM reviews WHERE product_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [productId, limit]
    );
  }, []);
}

export async function getRatingSummary(productId: string): Promise<ProductRatingSummary> {
  return leituraOpcional(
    `nota média de ${productId}`,
    async () => {
      await ensureSchema();
      const rows = await query<{ average: string | null; count: string }>(
        `SELECT AVG(rating)::numeric(10,2) AS average, COUNT(*)::text AS count
         FROM reviews WHERE product_id = $1`,
        [productId]
      );
      const row = rows[0];
      return {
        productId,
        average: row?.average ? Number(row.average) : 0,
        count: row?.count ? Number(row.count) : 0,
      };
    },
    { productId, average: 0, count: 0 }
  );
}

export async function getAllRatingSummaries(): Promise<ProductRatingSummary[]> {
  return leituraOpcional("notas médias da vitrine", async () => {
    await ensureSchema();
    const rows = await query<{ product_id: string; average: string | null; count: string }>(
      `SELECT product_id, AVG(rating)::numeric(10,2) AS average, COUNT(*)::text AS count
       FROM reviews GROUP BY product_id`
    );
    return rows.map((r) => ({
      productId: r.product_id,
      average: r.average ? Number(r.average) : 0,
      count: Number(r.count),
    }));
  }, []);
}

/** Últimas avaliações de toda a loja — usado no aviso de prova social em tempo real. */
export async function getRecentReviews(limit = 10): Promise<ReviewRecord[]> {
  return leituraOpcional("avaliações recentes", async () => {
    await ensureSchema();
    return query<ReviewRecord>(`SELECT * FROM reviews ORDER BY id DESC LIMIT $1`, [limit]);
  }, []);
}

// ---------------------------------------------------------------------------
// Cupons de desconto — ganhos ao avaliar um pedido pago, resgatáveis numa
// compra futura. Um cupom por pedido (não por avaliação individual).
// ---------------------------------------------------------------------------

const COUPON_DISCOUNT_PERCENT = 10;
const COUPON_EXPIRES_DAYS = 60;

function generateCouponCode(): string {
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `LULA${COUPON_DISCOUNT_PERCENT}-${random}`;
}

/** Cria (ou devolve o já existente) cupom de recompensa por avaliar este pedido. */
export async function getOrCreateCouponForOrder(orderId: number): Promise<CouponRecord> {
  await ensureSchema();
  const existing = await query<CouponRecord>(
    `SELECT * FROM coupons WHERE source_order_id = $1 LIMIT 1`,
    [orderId]
  );
  if (existing[0]) return existing[0];

  // Tenta algumas vezes caso o código gerado colida (extremamente improvável).
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const rows = await query<CouponRecord>(
        `INSERT INTO coupons (code, discount_percent, source_order_id, expires_at)
         VALUES ($1,$2,$3, now() + interval '${COUPON_EXPIRES_DAYS} days')
         RETURNING *`,
        [generateCouponCode(), COUPON_DISCOUNT_PERCENT, orderId]
      );
      return rows[0];
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "23505" /* unique_violation */ || attempt === 4) throw err;
    }
  }
  throw new Error("Não foi possível gerar um cupom.");
}

/** Consulta um cupom pelo código, sem consumi-lo (usado pra pré-visualizar o desconto no checkout). */
export async function findValidCoupon(code: string): Promise<CouponRecord | undefined> {
  await ensureSchema();
  const rows = await query<CouponRecord>(
    `SELECT * FROM coupons
     WHERE code = $1 AND used_order_id IS NULL AND (expires_at IS NULL OR expires_at > now())`,
    [code.trim().toUpperCase()]
  );
  return rows[0];
}

/**
 * Marca o cupom como usado por um pedido, de forma atômica (só sucede se
 * ainda não tiver sido resgatado) — evita uso duplicado em corrida.
 */
export async function redeemCoupon(code: string, orderId: number): Promise<CouponRecord | undefined> {
  await ensureSchema();
  const rows = await query<CouponRecord>(
    `UPDATE coupons SET used_order_id = $2, used_at = now()
     WHERE code = $1 AND used_order_id IS NULL AND (expires_at IS NULL OR expires_at > now())
     RETURNING *`,
    [code.trim().toUpperCase(), orderId]
  );
  return rows[0];
}

// ---------------------------------------------------------------------------
// Rastreio da entrega
// ---------------------------------------------------------------------------

export interface RastreioPublico {
  id: number;
  status: OrderStatus;
  total: number;
  createdAt: string;
  trackingCode: string | null;
  carrier: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  /** Só cidade/UF — endereço completo nunca sai numa página pública. */
  cidade: string;
  estado: string;
  /** Datas projetadas a partir do destino. Previsão, não rastreamento. */
  previsao: PrevisaoEntrega | null;
  /** Primeiro nome apenas, para o cliente reconhecer o pedido sem expor o resto. */
  primeiroNome: string;
  itens: Array<{ nome: string; variante: string | null; quantidade: number }>;
}

/**
 * Busca um pedido para a página pública de rastreio.
 *
 * Exige número do pedido E CPF: só o CPF não basta. CPF circula com facilidade
 * no Brasil, e uma consulta por CPF sozinho deixaria qualquer pessoa listar os
 * pedidos de alguém. Exigir os dois não pesa para quem comprou (tem ambos) e
 * elimina a enumeração — trocar o número na URL não leva a lugar nenhum.
 *
 * Devolve apenas o necessário para rastrear: nunca endereço completo, e-mail,
 * telefone ou dados de pagamento.
 */
export async function buscarPedidoParaRastreio(
  orderId: number,
  documento: string
): Promise<RastreioPublico | null> {
  await ensureSchema();
  const digitos = documento.replace(/\D/g, "");
  if (!Number.isInteger(orderId) || orderId <= 0 || digitos.length !== 11) return null;

  const rows = await query<OrderRecord>(
    // A comparação ignora a formatação do CPF gravada no pedido.
    `SELECT * FROM orders
     WHERE id = $1 AND regexp_replace(customer_document, '\\D', '', 'g') = $2`,
    [orderId, digitos]
  );
  const order = rows[0];
  if (!order) return null;

  const itens = await getOrderItems(order.id);

  return {
    id: order.id,
    status: order.payment_status,
    total: order.total,
    createdAt: order.created_at,
    trackingCode: order.tracking_code,
    carrier: order.carrier,
    shippedAt: order.shipped_at,
    deliveredAt: order.delivered_at,
    cidade: order.city,
    estado: order.state,
    // Só faz sentido projetar entrega depois que o pagamento entrou.
    previsao:
      order.payment_status === "paid"
        ? estimarEntrega(order.state, order.updated_at ?? order.created_at, order.shipped_at)
        : null,
    primeiroNome: order.customer_name.trim().split(/\s+/)[0] ?? "",
    itens: itens.map((i) => ({
      nome: i.product_name,
      variante: i.variant,
      quantidade: i.quantity,
    })),
  };
}

/** Grava (ou limpa) o rastreio de um pedido. Usado pelo painel admin. */
export async function definirRastreio(
  orderId: number,
  trackingCode: string | null,
  carrier: string | null
): Promise<void> {
  await ensureSchema();
  await query(
    // Os casts para ::text são obrigatórios: dentro de `CASE WHEN $2 IS NULL`
    // o Postgres não tem como inferir o tipo do parâmetro e recusa a query com
    // "could not determine data type of parameter".
    `UPDATE orders
     SET tracking_code = $2::text,
         carrier = $3::text,
         -- A data de postagem é gravada junto com o primeiro código, e mantida
         -- se o código for só corrigido depois.
         shipped_at = CASE WHEN $2::text IS NULL THEN NULL ELSE COALESCE(shipped_at, now()) END,
         updated_at = now()
     WHERE id = $1`,
    [orderId, trackingCode, carrier]
  );
}

/** Marca ou desmarca a entrega como concluída. */
export async function definirEntregue(orderId: number, entregue: boolean): Promise<void> {
  await ensureSchema();
  await query(
    `UPDATE orders SET delivered_at = ${entregue ? "COALESCE(delivered_at, now())" : "NULL"}, updated_at = now()
     WHERE id = $1`,
    [orderId]
  );
}

/** Todas as avaliações, para o painel admin. Nunca exposto publicamente. */
export async function listarAvaliacoesAdmin(limit = 200): Promise<
  Array<ReviewRecord & { product_name: string | null }>
> {
  await ensureSchema();
  return query<ReviewRecord & { product_name: string | null }>(
    `SELECT r.*, oi.product_name
     FROM reviews r
     LEFT JOIN LATERAL (
       SELECT product_name FROM order_items
       WHERE order_id = r.order_id AND product_id = r.product_id
       LIMIT 1
     ) oi ON true
     ORDER BY r.id DESC
     LIMIT $1`,
    [limit]
  );
}
