# VesteLula — Loja + Checkout PIX

Loja virtual (Next.js App Router + TypeScript + Tailwind) para venda de camisetas
e bonés, com checkout próprio e pagamento via PIX através da InvictusPay.

## Rodando localmente

```bash
npm install
cp .env.example .env
# preencha DATABASE_URL, INVICTUSPAY_* e ADMIN_* no .env
npm run dev
```

As tabelas do banco (`orders`, `order_items`) são criadas automaticamente na
primeira chamada que usar o banco — não é preciso rodar migrations manuais.

## Variáveis de ambiente

Veja `.env.example`. Resumo do que falta preencher antes de operar em produção:

- `DATABASE_URL`: string de conexão Postgres (ex: Supabase).
- `INVICTUSPAY_API_TOKEN`: gere um token novo na InvictusPay — nunca reaproveite
  um token que já tenha sido exposto.
- `INVICTUSPAY_OFFER_HASH`: hash da oferta cadastrada na InvictusPay.
- `INVICTUSPAY_PRODUCT_HASH_SHIRT` / `INVICTUSPAY_PRODUCT_HASH_CAP`: hashes de
  produto (um para camisetas, outro para bonés).
- `ADMIN_PASSWORD`: senha do painel `/admin`.
- `ADMIN_SESSION_SECRET`: string aleatória longa (ex: `openssl rand -hex 32`).

## Ajuste pendente: formato da resposta do PIX

A documentação da InvictusPay fornecida não mostrava o JSON completo devolvido
na criação de uma cobrança PIX. Por isso `lib/invictuspay.ts` tem a função
`normalizeInvictusPixResponse()`, que tenta reconhecer os nomes de campo mais
comuns (QR Code em base64, código copia-e-cola, hash da transação). Assim que
você tiver uma resposta real da API:

1. Gere uma transação de teste e salve o JSON retornado.
2. Ajuste os caminhos dentro de `normalizeInvictusPixResponse` para bater com
   os nomes de campo reais.
3. Faça o mesmo em `app/api/webhooks/invictuspay/route.ts` (`extractHashAndStatus`)
   assim que tiver um payload real de webhook.

## Estrutura

```
app/
  page.tsx                     — home
  produto/[slug]/page.tsx      — página do produto
  carrinho/page.tsx            — carrinho
  checkout/page.tsx            — checkout (dados + endereço + ViaCEP)
  pedido/[id]/pix/page.tsx     — tela de pagamento PIX (QR Code + polling)
  pedido/[id]/sucesso/page.tsx — confirmação de pagamento
  admin/                       — painel de pedidos (protegido por senha)
  api/
    checkout/pix/route.ts          — cria pedido + cobrança PIX
    orders/[id]/status/route.ts    — consulta status do pedido
    webhooks/invictuspay/route.ts  — recebe atualizações de pagamento
    admin/...                      — login, listagem, detalhe e reembolso

lib/
  products.ts     — catálogo (única fonte de preços)
  pricing.ts      — recalcula o carrinho no servidor
  validators.ts   — validação com Zod + CPF
  db.ts           — Postgres (pg) + criação de tabelas
  invictuspay.ts  — cliente da API da InvictusPay
  admin-auth.ts   — sessão assinada do painel admin
```

## Segurança

- O token da InvictusPay só é usado em código server-side (`lib/invictuspay.ts`,
  marcado com `import "server-only"`), nunca é enviado ao navegador.
- O preço de cada item é sempre recalculado a partir de `lib/products.ts`
  (`lib/pricing.ts`); o frontend envia apenas `productId`, `size` e `quantity`.
- `/admin` e `/api/admin/*` são protegidos por `middleware.ts` (sessão assinada
  via cookie httpOnly).
- Reembolso só é acessível pelo painel admin autenticado — não existe endpoint
  público para o cliente reembolsar.

## Deploy

Pronto para Vercel. Configure as variáveis de ambiente do `.env.example` no
projeto da Vercel e aponte `DATABASE_URL` para o seu Postgres/Supabase.
