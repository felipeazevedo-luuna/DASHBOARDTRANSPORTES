# Painel de SLA · Luuna

Dashboard de SLA de entregas (por estado), média de dias e densidade de pedidos
no mapa do Brasil, com filtros de período, semana e transportadora. Lê os dados
de uma planilha **privada** do Google Sheets via uma Netlify Function autenticada
por **conta de serviço** — a credencial fica só no servidor.

## Estrutura

```
/
├─ index.html                    # o dashboard
├─ netlify.toml                  # config de deploy (publish + functions)
├─ SETUP.md                      # passo a passo da conta de serviço
└─ netlify/
   └─ functions/
      └─ sheet-data.js           # backend que lê a planilha e devolve JSON
```

## Deploy (resumo)

1. Suba este repositório no GitHub.
2. No Netlify: **Add new site → Import an existing project → GitHub** e escolha o repo.
   O `netlify.toml` já define publish (`.`) e a pasta de funções — não precisa mexer.
3. Configure as **variáveis de ambiente** (Site settings → Environment variables):
   `SHEET_ID`, `SHEET_RANGE`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `HAS_HEADER`.
4. Compartilhe a planilha com o e-mail da conta de serviço (como **Leitor**).
5. Deploy. Teste em `/.netlify/functions/sheet-data` (deve vir `"ok":true`).

Detalhes completos em [`SETUP.md`](./SETUP.md).

> ⚠️ A chave privada da conta de serviço vai **apenas** nas variáveis de ambiente
> do Netlify. Nunca comite o JSON da credencial no repositório.
