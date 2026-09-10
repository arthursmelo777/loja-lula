# VesteLula — Loja + Checkout PIX

Loja virtual (Next.js App Router + TypeScript + Tailwind) para venda de camisetas
e bonés, com checkout próprio e pagamento via PIX.

## Rodando localmente

```bash
npm install
cp .env.example .env
# preencha DATABASE_URL e ADMIN_* no .env
npm run dev
```

As tabelas do banco (`orders`, `order_items`) são criadas automaticamente na
primeira chamada que usar o banco — não é preciso rodar migrations manuais.

## Variáveis de ambiente

Veja `.env.example`. Resumo do que falta preencher antes de operar em produção:

- `DATABASE_URL`: string de conexão Postgres (ex: Supabase).
- Credenciais da processadora de pagamento: dependem de qual você usar (veja
  "Processadora de pagamento" abaixo). Nenhuma vem configurada.
- `ADMIN_PASSWORD`: senha do painel `/admin`.
- `ADMIN_SESSION_SECRET`: string aleatória longa (ex: `openssl rand -hex 32`).

## Ajuste pendente: formato da resposta do PIX

A loja não fala com nenhuma processadora específica: ela fala com a interface
`ProcessadoraPagamento`, em `lib/pagamentos.ts`. Para ligar uma processadora:

1. Crie `lib/processadoras/<nome>.ts` implementando `ProcessadoraPagamento`
   (`criarCobrancaPix`, `consultarTransacao`, `reembolsar`, `interpretarWebhook`).
2. Devolva essa implementação em `getProcessadora()`, em `lib/pagamentos.ts`.
3. Cadastre `https://SEU-DOMINIO/api/webhooks/pagamento` como URL de webhook no
   painel da processadora.

Nenhuma rota, página ou tabela precisa mudar — conceitos próprios de cada
fornecedor (hashes de oferta, ids de produto, etc.) ficam dentro do adaptador.
Enquanto não houver processadora registrada, os pedidos continuam sendo criados
e gravados no banco; só a geração da cobrança falha, com mensagem explícita.

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
    webhooks/pagamento/route.ts    — recebe atualizações de pagamento
    admin/...                      — login, listagem, detalhe e reembolso

lib/
  products.ts     — catálogo (única fonte de preços)
  pricing.ts      — recalcula o carrinho no servidor
  validators.ts   — validação com Zod + CPF
  db.ts           — Postgres (pg) + criação de tabelas
  pagamentos.ts   — interface da processadora de pagamento
  admin-auth.ts   — sessão assinada do painel admin
```

## Segurança

- As credenciais da processadora só são usadas em código server-side
  (`lib/pagamentos.ts` e o adaptador, marcados com `import "server-only"`),
  nunca são enviadas ao navegador.
- O preço de cada item é sempre recalculado a partir de `lib/products.ts`
  (`lib/pricing.ts`); o frontend envia apenas `productId`, `size` e `quantity`.
- `/admin` e `/api/admin/*` são protegidos por `proxy.ts` (sessão assinada
  via cookie httpOnly).
- Reembolso só é acessível pelo painel admin autenticado — não existe endpoint
  público para o cliente reembolsar.

## Deploy

Pronto para Vercel. Configure as variáveis de ambiente do `.env.example` no
projeto da Vercel e aponte `DATABASE_URL` para o seu Postgres/Supabase.
