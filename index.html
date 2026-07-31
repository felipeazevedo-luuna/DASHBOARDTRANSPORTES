# Painel de SLA · Luuna — setup da conexão privada

O dashboard (`dashboard_sla_luuna.html`) roda no Netlify e lê a planilha **privada**
através de uma **Netlify Function** (`netlify/functions/sheet-data.js`) autenticada
por uma **conta de serviço** do Google. A credencial fica só no servidor.

## Estrutura no repositório do Netlify

```
/
├─ dashboard_sla_luuna.html      → sua página (pode renomear para index.html)
├─ netlify.toml
└─ netlify/
   └─ functions/
      └─ sheet-data.js
```

## 1. Criar a conta de serviço (Google Cloud)

1. Acesse console.cloud.google.com e crie/selecione um projeto.
2. **APIs e serviços → Biblioteca** → ative a **Google Sheets API**.
3. **APIs e serviços → Credenciais → Criar credenciais → Conta de serviço**.
4. Dê um nome, crie, e abra a conta de serviço criada.
5. Aba **Chaves → Adicionar chave → Criar nova chave → JSON**. Baixa um `.json`.
6. Abra o JSON — você vai usar dois campos: `client_email` e `private_key`.

## 2. Dar acesso à planilha

- Copie o `client_email` (algo como `nome@projeto.iam.gserviceaccount.com`).
- Na planilha: **Compartilhar** → cole esse e-mail como **Leitor**.
- É só isso: a planilha continua privada, sem publicar nada.

## 3. Variáveis de ambiente no Netlify

Site → **Site settings → Environment variables** → adicione:

| Variável              | Valor                                                        |
|-----------------------|--------------------------------------------------------------|
| `SHEET_ID`            | o trecho entre `/d/` e `/edit` da URL da planilha            |
| `SHEET_RANGE`         | `NomeDaAba!A:W`  (troque pelo nome real da aba)              |
| `GOOGLE_CLIENT_EMAIL` | o `client_email` do JSON                                     |
| `GOOGLE_PRIVATE_KEY`  | o `private_key` do JSON (cole inteiro, incluindo os `\n`)    |
| `HAS_HEADER`          | `true` se a 1ª linha for cabeçalho (padrão)                 |
| `SHEET_ID_TRANSITO`   | ID da planilha de pedidos em trânsito ("Rastreamento")      |
| `SHEET_RANGE_TRANSITO`| `Rastreamento!A:R`                                          |

> A planilha de trânsito precisa ser **compartilhada com a mesma conta de serviço**
> (`GOOGLE_CLIENT_EMAIL`, como Leitor). Se `SHEET_ID_TRANSITO` não for definida, a
> aba "Pedidos em trânsito" fica vazia e a de "Entregues" funciona normalmente.

> Sobre a `GOOGLE_PRIVATE_KEY`: cole exatamente como está no JSON, começando em
> `-----BEGIN PRIVATE KEY-----` e terminando em `-----END PRIVATE KEY-----`.
> Se o Netlify guardar os `\n` literais, tudo bem — a função converte sozinha.

## 4. Deploy e teste

1. Suba os arquivos (ou conecte o repositório). Faça o deploy.
2. Teste a função direto: abra `https://SEU-SITE.netlify.app/.netlify/functions/sheet-data`
   — deve responder um JSON com `"ok":true` e as linhas.
3. Abra o dashboard: ele já aponta para essa função em `CONFIG.API_URL`.

## Erros comuns

- **403 / "The caller does not have permission"**: a planilha não foi compartilhada
  com o `client_email` da conta de serviço.
- **"Faltam variáveis de ambiente"**: alguma env var não foi salva (ou faltou
  refazer o deploy depois de adicioná-las).
- **Token/assinatura**: a `GOOGLE_PRIVATE_KEY` foi colada incompleta ou sem as
  linhas `BEGIN/END`.
- **Sem linhas**: `SHEET_RANGE` aponta para aba errada — confira o nome exato.
