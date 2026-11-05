# Painel Logística · Luuna

Painel multipáginas (menu lateral) lendo as planilhas do Google Sheets por uma
Netlify Function com conta de serviço. A credencial fica só no servidor.

Páginas: **Início**, **Pedidos em trânsito** e **Pedidos entregues** (conectadas),
Montagens e Pedidos inhouse (ainda sem fonte de dados).

## Estrutura

```
index.html                    página única (HTML + CSS + JS, sem build)
netlify/functions/dados.js    lê as abas do Sheets e devolve JSON
netlify.toml                  publica a raiz e cria o atalho /api/dados
mock/transito.js              dados de exemplo (fictícios) para testar sem planilha
servidor-local.js             roda o painel no computador com a planilha real (ver LEIA-ME)
```

## Publicar

1. Crie um repositório novo no GitHub com estes arquivos.
2. No Netlify: *Add new site → Import an existing project* → escolha o repositório.
   Não precisa de comando de build.
3. Em *Site configuration → Environment variables*, cadastre:

| Variável | Valor |
|---|---|
| `GOOGLE_CLIENT_EMAIL` | o mesmo do Painel de SLA |
| `GOOGLE_PRIVATE_KEY` | o mesmo do Painel de SLA |
| `DASHFEDEX_SHEET_ID` | ID da planilha Dash fedex (trecho entre `/d/` e `/edit` da URL) |
| `ENTREGUES_SHEET_ID` | opcional — ID da planilha PEDIDOS ENTREGUES (já vem o atual no código) |
| `GOOGLE_OAUTH_CLIENT_ID` | ID do cliente OAuth do login com Google (ver seção Login) |

4. Faça um novo deploy (*Deploys → Trigger deploy*) para as variáveis valerem.

A conta de serviço precisa ter acesso de leitor à Dash fedex. Como o Painel de
SLA já lê a aba Rastreamento, esse acesso já existe.

## Login (conta Google @zeb.mx)

O painel só entrega dados para quem entrar com uma conta Google do domínio
`zeb.mx`. A conferência é feita na função do Netlify: sem sessão válida, ela
responde 401 e não lê a planilha. Sem a variável `GOOGLE_OAUTH_CLIENT_ID`, os
dados ficam bloqueados (falha fechada).

Configurar uma vez:

1. Google Cloud Console (mesmo projeto da conta de serviço) → **APIs e serviços →
   Tela de permissão OAuth**: tipo **Interno** (se o projeto for da organização
   zeb.mx; senão, Externo), nome do app e e-mail de suporte.
2. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**.
   Em **Origens JavaScript autorizadas**, inclua o endereço do site
   (`https://SEU-SITE.netlify.app`) e `http://localhost:8888`.
3. Copie o **ID do cliente** e cadastre no Netlify como `GOOGLE_OAUTH_CLIENT_ID`.
   Faça um novo deploy.

Variáveis opcionais: `PAINEL_DOMINIO` (padrão `zeb.mx`), `PAINEL_EMAILS_EXTRA`
(e-mails de fora do domínio liberados, separados por vírgula), `SESSAO_HORAS`
(padrão 12) e `SESSION_SECRET`.

## Pedidos entregues

Lê a aba **BASE** da planilha **PEDIDOS ENTREGUES**. A conta de serviço precisa ter
acesso de **Leitor** a essa planilha também (compartilhe com o `client_email`).
A função devolve só as colunas usadas e as entregas dos últimos 200 dias.

- **OTD oficial**: coluna `% On Time` (baixa no Zecore).
- **OTD real da transportadora**: `Data de entrega Transportadora` ≤ `ORG_DELIVERY_DATE`
  (sem data da transportadora, usa `DELIVERED_DATE`).
- **Dias / SLA**: coluna `DIAS`; SLA de 10 dias (`SLA_DIAS` no script).
- **Atraso de entrega × de baixa**: coluna `Motivo do atraso`.

## De onde vem cada coisa

| No painel | Na planilha Dash fedex |
|---|---|
| Notas, prazo, UF, região, canal | aba **Rastreamento** (A:U) |
| Status (cores, filtros, donut) | coluna **U – STATUS PADRONIZADO** (DE-PARA da aba Mapa_Status) |
| Saída do armazém | coluna **S – STATUS PLATINUM** ("ENTREGUE A TRANSPORTADORA (data)") |
| Tempo entre filiais e histórico por NF | aba **Historico** (lida pelo nome das colunas) |
| "Última atualização" | célula **F1** ("Atualizado: …") |

Regras usadas nos indicadores (topo do `<script>` no `index.html`):

- **Em rota / Entregues / Retidas / Liberadas**: categorias `EM ROTA DE ENTREGA`,
  `ENTREGUE`, `RETIDO FISCALIZAÇÃO` e `LIBERADO FISCALIZAÇÃO`.
- **Liberadas** também conta notas que passaram por retenção no histórico e não estão mais retidas.
- **Com ocorrência**: lista `OCORRENCIAS`.
- **Notas em trânsito**: total da aba menos `ENTREGUE`.
- Categoria nova no DE-PARA aparece sozinha, com cor neutra. Para escolher a cor,
  acrescente na lista `CATEGORIAS`.

## Ver e baixar as notas de cada quadro

Passe o mouse num cartão ou quadro e clique nos três pontinhos (⋯). Cada quadro
oferece **Ver notas** (lista com busca, e clique na NF para o histórico) e
**Baixar CSV** (mesmas colunas da aba Rastreamento). Tudo respeita os filtros do
menu lateral. No celular, os três pontinhos ficam sempre visíveis.

As faixas de prazo ("atrasadas 3+ dias", "vencem hoje"…) abrem a lista direto
ao clicar. O quadro de tempo entre filiais baixa os trechos (média por trecho
ou um trecho por NF).

## Testar no computador

Veja o `LEIA-ME.md`. Resumindo: dois cliques no `index.html` abrem com dados de
exemplo; `node servidor-local.js` (com o `credenciais.json` na pasta) abre em
`http://localhost:8888` lendo a planilha de verdade.

Em produção, se a leitura falhar, a página mostra o erro e oferece abrir os
dados de exemplo — ela nunca troca os dados reais pelos de exemplo sem avisar.

## Ligar uma página nova

1. Em `netlify/functions/dados.js`, acrescente uma entrada em `PAGINAS`
   (planilha + abas).
2. No `index.html`, troque o `renderFuturo` da página por uma função própria.
