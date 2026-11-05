/**
 * PAINEL LOGÍSTICA · LUUNA — backend de dados (Netlify Function)
 * ------------------------------------------------------------------
 * Lê planilhas PRIVADAS via Google Sheets API com uma CONTA DE SERVIÇO.
 * A credencial fica só no servidor (variáveis de ambiente do Netlify);
 * o navegador nunca a vê. Sem dependências npm.
 *
 * Uso:  /.netlify/functions/dados?pagina=transito
 *
 * Cada página do painel declara de qual planilha e de quais abas ela lê
 * (objeto PAGINAS abaixo). Para ligar uma página nova, basta acrescentar
 * uma entrada — o front não muda de endpoint.
 *
 * Variáveis de ambiente (Netlify → Site configuration → Environment):
 *   GOOGLE_CLIENT_EMAIL   e-mail da conta de serviço (…@…iam.gserviceaccount.com)
 *   GOOGLE_PRIVATE_KEY    private_key do JSON da conta de serviço (com \n)
 *   DASHFEDEX_SHEET_ID    ID da planilha "Dash fedex" (trecho entre /d/ e /edit)
 *   ENTREGUES_SHEET_ID    ID da planilha "PEDIDOS ENTREGUES" (opcional: já vem o ID atual)
 *   INHOUSE_SHEET_ID      ID da planilha "INHOUSE" (opcional: já vem o ID atual)
 *
 * LOGIN (conta Google da empresa):
 *   GOOGLE_OAUTH_CLIENT_ID  ID do cliente OAuth (tipo "Aplicativo da Web") — obrigatório
 *   PAINEL_DOMINIO          domínio aceito (padrão: zeb.mx)
 *   PAINEL_EMAILS_EXTRA     opcional: e-mails de fora do domínio liberados, separados por vírgula
 *   SESSAO_HORAS            opcional: duração do login (padrão: 12)
 *   SESSION_SECRET          opcional: chave para assinar a sessão (padrão: derivada da GOOGLE_PRIVATE_KEY)
 * Sem GOOGLE_OAUTH_CLIENT_ID a função NÃO entrega dados (falha fechada).
 * ------------------------------------------------------------------
 */
const crypto = require("crypto");

const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY  = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

// Página → planilha + abas. "obrigatoria: false" não derruba a resposta
// se a aba ainda não existir (ex.: Historico recém-criado).
const PAGINAS = {
  transito: {
    planilha: () => process.env.DASHFEDEX_SHEET_ID || process.env.SHEET_ID_TRANSITO,
    abas: {
      rastreamento: { range: "Rastreamento!A:W", obrigatoria: true },
      historico:    { range: "Historico!A:J",    obrigatoria: false },
      // quantos itens tem cada pedido em trânsito (export do QuickSight, 1 linha por item)
      itens:        { range: "'Base de dados'!C:C", obrigatoria: false }
    }
  },
  // Pedidos entregues: aba BASE da planilha "PEDIDOS ENTREGUES".
  // A base tem milhares de linhas: a função devolve só as colunas que o painel
  // usa e só as entregas dos últimos N dias (?dias=, padrão 200; ?dias=0 = tudo),
  // para a resposta ficar leve.
  finalizados: {
    planilha: () => process.env.ENTREGUES_SHEET_ID || "1GXxR37E_lCvJXDVE3nDP-IxMiXNxv5XmMorXe8vMaYk",
    abas: {
      base: {
        range: "BASE!A:AD", obrigatoria: true,
        colunas: ["DELIVERED_DATE", "ORG_DELIVERY_DATE", "DATA DE CRIAÇÃO", "S_AND_OP_AGGREGATOR", "POS", "DOCNAME", "% On Time", "NF",
                  "Transportadora", "Data prevista Zecore", "Data baixada Zecore", "Data prevista transportadora",
                  "Data de entrega Transportadora", "Baixa API", "Motivo do atraso", "UF", "Região", "SEMANA", "DIAS", "CEP",
                  "VALOR FRETE", "VALOR NF", "LAT", "LNG"],
        filtroData: { coluna: "DELIVERED_DATE", diasPadrao: 200 }
      }
    }
  },
  // Pedidos inhouse (frota própria): planilha INHOUSE. Só as colunas que o painel
  // usa — o CPF dos motoristas e o nome dos clientes NUNCA saem da planilha.
  inhouse: {
    planilha: () => process.env.INHOUSE_SHEET_ID || "1J8SXfo0ZzSegVQfkH1iUpXf1BAVNTvR8Fl9kJIpzEE8",
    abas: {
      entregas:       { range: "ENTREGAS!A:N", obrigatoria: true,
                        colunas: ["ENTREGAS", "FALHAS", "TOTAL ENTREGA", "COLETA", "FALHAS COLETAS", "TOTAL COLETA", "DATA", "SEMANA"] },
      falhas:         { range: "'FALHAS POR MOTORISTA'!A:G", obrigatoria: false,
                        colunas: ["MOTORISTA", "SALES ORDER", "MOTIVO FALHA ENTREGA", "TIPO", "DATA"] },
      motoristas:     { range: "'REGISTRO MOTORISTAS'!A:E", obrigatoria: false,
                        colunas: ["MOTORISTA", "PLACA CARRO", "MODELO CARRO", "M³"] },
      capacidade:     { range: "CAPACIDADE!A:E", obrigatoria: false,
                        colunas: ["MOTORISTA", "VOLUME", "VEICULO", "VOLUME VEICULO", "DIA"] },
      abastecimentos: { range: "ABASTECIMENTOS!A:E", obrigatoria: false, colunas: ["MOTORISTA", "LOJA", "DATA"] },
      pedidos:        { range: "'PEDIDOS DIÁRIO  POR IT'!A:F", obrigatoria: false,
                        colunas: ["MOTORISTA", "NF", "SHIPPING CORE", "DIA", "POS"] },
      valores:        { range: "VALORES!A:L", obrigatoria: false,
                        colunas: ["MOTORISTA", "QTD REV", "QTD ENT", "QTD NF TOTAL", "QTD ITEM", "VALOR CARRO", "VALOR NOTA", "VALOR TOTAL", "DIA"] },
      avaliacoes:     { range: "'AVALIAÇÕES'!A:E", obrigatoria: false, colunas: ["MOTORISTA", "RATING", "COMENTARIO", "DIA", "MOTIVO"] }
    }
  },
  // Montagens (MMS e inhouse): planilha MONTAGENS. Nome e CPF do cliente NÃO são lidos.
  montagens: {
    planilha: () => process.env.MONTAGENS_SHEET_ID,
    nomePlanilha: "MONTAGENS V2",      // sem o ID, procura pelo nome entre as planilhas compartilhadas com o robô
    abas: {
      montagens: { range: "MONTAGENS!A:AH", obrigatoria: true,
                   // coluna A: "MONTADOR" (na planilha antiga o cabeçalho era só "c")
                   apelidos: { "MONTADOR": ["c", "MONTADOR / OPERADOR", "OPERADOR"] },
                   colunas: ["MONTADOR", "CANAL", "CASO", "PEDIDO", "NF", "SKU", "SKU2", "SKU3", "SKU4", "SKU5", "UF", "VALOR", "VALOR MONTAGEM",
                             "DATA ENVIO MMS", "DATA ENVIO INHOUSE", "DATA ENVIO", "DATA AGENDADA", "DATA ADESÃO", "PREVISÃO DE ENTREGA", "DATA REALIZADA", "NOVA DATA",
                             "MOTIVO CANCELAMENTO", "STATUS", "SEMANA", "MOTORISTA INHOUSE"],
                   opcionais: ["SEMANA", "MOTORISTA INHOUSE", "PREVISÃO DE ENTREGA", "SKU2", "SKU3", "SKU4", "SKU5", "CASO", "DATA ENVIO INHOUSE", "DATA ENVIO"] }
    }
  }
};

function b64url(input) {
  return Buffer.from(input).toString("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

let tokenCache = {};
const ESCOPO_LEITURA = "https://www.googleapis.com/auth/spreadsheets.readonly";
const ESCOPO_ESCRITA = "https://www.googleapis.com/auth/spreadsheets";

async function getAccessToken(escopo) {
  escopo = escopo || ESCOPO_LEITURA;
  const agora = Math.floor(Date.now() / 1000);
  const c = tokenCache[escopo];
  if (c && c.expira - 60 > agora) return c.valor;

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: CLIENT_EMAIL,
    scope: escopo,
    aud: "https://oauth2.googleapis.com/token",
    exp: agora + 3600,
    iat: agora,
  }));
  const unsigned = header + "." + claim;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(PRIVATE_KEY, "base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: unsigned + "." + signature,
    }),
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error("Falha ao obter token do Google: " + JSON.stringify(data));
  tokenCache[escopo] = { valor: data.access_token, expira: agora + (data.expires_in || 3600) };
  return data.access_token;
}

/* ------------------------------------------------------------
   LOGIN
   1) O navegador faz login com o Google e manda o "ID token" para
      ?acao=login. A função confere no Google se o token é válido, se
      foi emitido para o nosso cliente OAuth e se o e-mail é do domínio.
   2) Se estiver tudo certo, devolve uma sessão própria, assinada com
      HMAC, válida por SESSAO_HORAS. Toda leitura de dados exige essa
      sessão no cabeçalho Authorization.
   ------------------------------------------------------------ */
const OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || "";
const DOMINIO = (process.env.PAINEL_DOMINIO || "zeb.mx").toLowerCase();
const EMAILS_EXTRA = (process.env.PAINEL_EMAILS_EXTRA || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
const SESSAO_HORAS = Number(process.env.SESSAO_HORAS || 12);
// Só o servidor local (servidor-local.js) liga isto, e só sem client OAuth configurado.
const SEM_LOGIN = process.env.PAINEL_SEM_LOGIN === "1";

function chaveSessao() {
  return crypto.createHash("sha256").update((process.env.SESSION_SECRET || PRIVATE_KEY) + "|painel-logistica-sessao").digest();
}
function assinar(obj) {
  const corpo = b64url(JSON.stringify(obj));
  const sig = crypto.createHmac("sha256", chaveSessao()).update(corpo).digest("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return corpo + "." + sig;
}
function verificarSessao(event) {
  const h = (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
  const tok = h.replace(/^Bearer\s+/i, "");
  const partes = tok.split(".");
  if (partes.length !== 2) return null;
  const esperado = crypto.createHmac("sha256", chaveSessao()).update(partes[0]).digest("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const a = Buffer.from(esperado), b = Buffer.from(partes[1]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let dados;
  try { dados = JSON.parse(Buffer.from(partes[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); } catch (e) { return null; }
  if (!dados.exp || Date.now() > dados.exp) return null;
  return dados;
}
function emailPermitido(email, hd) {
  email = String(email || "").toLowerCase();
  if (EMAILS_EXTRA.indexOf(email) >= 0) return true;
  return email.endsWith("@" + DOMINIO) && (!hd || String(hd).toLowerCase() === DOMINIO);
}
async function fazerLogin(event) {
  let corpo = {};
  try { corpo = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : (event.body || "{}")); } catch (e) {}
  if (!corpo.credential) return { status: 400, body: { error: "Login sem credencial do Google." } };
  const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(corpo.credential));
  const info = await r.json();
  if (!r.ok || info.error_description || info.error) return { status: 401, body: { error: "Login do Google inválido ou expirado. Tente de novo." } };
  if (info.aud !== OAUTH_CLIENT_ID) return { status: 401, body: { error: "Login emitido para outro aplicativo." } };
  if (String(info.email_verified) !== "true") return { status: 403, body: { error: "E-mail do Google não verificado." } };
  if (!emailPermitido(info.email, info.hd)) {
    await registrarAcesso(event, info.email, info.name, "login negado", "fora do domínio @" + DOMINIO);
    return { status: 403, body: { error: "Acesso restrito a contas @" + DOMINIO + ". Você entrou com " + info.email + "." } };
  }
  const sessao = { email: info.email, nome: info.name || info.email, exp: Date.now() + SESSAO_HORAS * 3600 * 1000 };
  await registrarAcesso(event, sessao.email, sessao.nome, "login", "sessão de " + SESSAO_HORAS + " h");
  return { status: 200, body: { ok: true, token: assinar(sessao), email: sessao.email, nome: sessao.nome, exp: sessao.exp } };
}

/* ------------------------------------------------------------
   REGISTRO DE ACESSOS
   Cada login (aceito ou negado) e cada página aberta vira uma linha na
   aba "Acessos" da planilha ACESSOS_SHEET_ID. A conta de serviço precisa
   ser EDITORA dessa planilha. Sem a variável, o registro fica desligado.
   Nunca atrapalha o painel: se a gravação falhar, o acesso segue normal.
   ------------------------------------------------------------ */
const ACESSOS_SHEET_ID = process.env.ACESSOS_SHEET_ID || "";
const ABA_ACESSOS = "Acessos";

function agoraBR() {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
                                              hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(",", "");
}
function navegadorCurto(ua) {
  ua = String(ua || "");
  const so = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua) ? "Mac" : /Android/.test(ua) ? "Android" :
             /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Linux/.test(ua) ? "Linux" : "";
  const nav = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return [nav, so].filter(Boolean).join(" · ") || ua.substring(0, 60);
}
async function registrarAcesso(event, email, nome, evento, detalhe) {
  if (!ACESSOS_SHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) return { ok: false, erro: "ACESSOS_SHEET_ID não configurado" };
  const h = event.headers || {};
  const ip = h["x-nf-client-connection-ip"] || (h["x-forwarded-for"] || "").split(",")[0].trim() || "";
  const linha = [agoraBR(), email || "", nome || "", evento, detalhe || "", navegadorCurto(h["user-agent"]), ip];
  const gravar = (async () => {
    const token = await getAccessToken(ESCOPO_ESCRITA);
    const url = "https://sheets.googleapis.com/v4/spreadsheets/" + ACESSOS_SHEET_ID + "/values/" +
                encodeURIComponent(ABA_ACESSOS + "!A1") + ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS";
    const r = await fetch(url, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
                                 body: JSON.stringify({ values: [linha] }) });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      const msg = (j.error && j.error.message) || ("HTTP " + r.status);
      console.error("[ACESSOS] Não gravou: " + msg);           // aparece em Netlify → Functions → dados → Logs
      return { ok: false, status: r.status, erro: msg };
    }
    return { ok: true };
  })().catch(e => { console.error("[ACESSOS] Erro: " + (e.message || e)); return { ok: false, erro: String(e.message || e) }; });
  // espera no máximo 4 s: o registro nunca deixa o painel lento
  return Promise.race([gravar, new Promise(r => setTimeout(() => r({ ok: false, erro: "demorou mais de 4 s" }), 4000))]);
}

// Explica em português o erro mais comum de cada caso
function dicaAcessos(r) {
  const e = String(r.erro || "");
  if (/não configurado/.test(e)) return "Crie a variável ACESSOS_SHEET_ID no Netlify (escopo: Functions) e faça um novo deploy.";
  if (/Unable to parse range/i.test(e)) return 'A planilha não tem uma aba chamada exatamente "' + ABA_ACESSOS + '". Renomeie a aba.';
  if (r.status === 403 || /permission/i.test(e)) return "Compartilhe a planilha como EDITOR com " + CLIENT_EMAIL + ".";
  if (r.status === 404 || /not found/i.test(e)) return "O ID em ACESSOS_SHEET_ID não corresponde a uma planilha. Copie o trecho da URL entre /d/ e /edit.";
  if (/has not been used|disabled/i.test(e)) return "Ative a Google Sheets API no projeto da conta de serviço.";
  return r.ok ? "Tudo certo: uma linha de teste foi gravada." : "Veja a mensagem de erro acima.";
}

// "dd/mm/aaaa" → Date
function dataBR(v) {
  const m = String(v || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? new Date(+m[3], m[2] - 1, +m[1]) : null;
}

// Mantém só as colunas pedidas (pelo nome do cabeçalho) e, se configurado,
// só as linhas cuja data está dentro dos últimos N dias.
// Compara nomes de coluna sem ligar para acento, maiúscula ou espaços a mais
function normCol(h) {
  return String(h || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}
function enxugar(aba, cfg, diasParam) {
  if (!cfg.colunas && !cfg.filtroData) return aba;
  // O cabeçalho nem sempre está na 1ª linha (título, linha em branco…): usa,
  // entre as 6 primeiras, a linha que tem mais nomes de coluna esperados.
  let header = aba.header, rows = aba.rows;
  if (cfg.colunas) {
    const alvo = cfg.colunas.map(normCol).concat([].concat.apply([], Object.values(cfg.apelidos || {})).map(normCol));
    const conta = (lin) => (lin || []).map(normCol).filter((h) => alvo.indexOf(h) >= 0).length;
    let melhor = conta(header), pos = -1;
    for (let k = 0; k < Math.min(6, rows.length); k++) { const c = conta(rows[k]); if (c > melhor) { melhor = c; pos = k; } }
    if (pos >= 0) { header = rows[pos]; rows = rows.slice(pos + 1); }
  }
  const cabN = (header || []).map(normCol), cab = (header || []).map((h) => String(h || "").trim());
  const apelidos = cfg.apelidos || {};
  const idx = cfg.colunas ? cfg.colunas.map((nm) => {
    let i = cabN.indexOf(normCol(nm));
    (apelidos[nm] || []).forEach((ap) => { if (i < 0) i = cabN.indexOf(normCol(ap)); });
    return i;
  }) : cab.map((_, i) => i);
  const opc = (cfg.opcionais || []).map(normCol);
  const faltando = cfg.colunas ? cfg.colunas.filter((nm, k) => idx[k] < 0 && opc.indexOf(normCol(nm)) < 0) : [];
  if (cfg.filtroData) {
    const dias = diasParam != null && diasParam !== "" ? Number(diasParam) : cfg.filtroData.diasPadrao;
    const iData = cabN.indexOf(normCol(cfg.filtroData.coluna));
    if (iData >= 0 && dias > 0) {
      const limite = new Date(); limite.setHours(0, 0, 0, 0); limite.setDate(limite.getDate() - dias);
      rows = rows.filter((r) => { const d = dataBR(r[iData]); return !d || d >= limite; });
    }
  }
  return {
    // devolve sempre os nomes "oficiais" das colunas, para o painel achar cada uma
    header: cfg.colunas ? cfg.colunas.slice() : cab,
    rows: rows.filter((r) => r.some((x) => String(x || "").trim())).map((r) => idx.map((i) => (i >= 0 && r[i] != null ? String(r[i]).trim() : ""))),
    faltando: faltando,
    cabecalhoLido: cab.filter(Boolean)
  };
}

// Acha o ID de uma planilha pelo nome, entre as compartilhadas com a conta de serviço
// (usa a Google Drive API, só leitura). Guarda o resultado enquanto a função estiver viva.
const CACHE_IDS = {};
async function idPeloNome(nome) {
  if (CACHE_IDS[nome]) return CACHE_IDS[nome];
  const token = await getAccessToken("https://www.googleapis.com/auth/drive.metadata.readonly");
  const q = "name = '" + nome.replace(/'/g, "\\'") + "' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false";
  const url = "https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(q) + "&fields=files(id,name)&pageSize=5&supportsAllDrives=true&includeItemsFromAllDrives=true";
  const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (j.error && j.error.message) || ("HTTP " + r.status);
    throw new Error("Não consegui procurar a planilha \"" + nome + "\" pelo nome (" + msg + "). Mande o link da planilha para colocar o ID no dados.js.");
  }
  const f = (j.files || [])[0];
  if (!f) throw new Error("Não achei a planilha \"" + nome + "\" entre as compartilhadas com " + CLIENT_EMAIL + ". Confira o nome e o compartilhamento, ou mande o link da planilha.");
  CACHE_IDS[nome] = f.id;
  return f.id;
}

async function lerRange(token, planilhaId, range) {
  const url = "https://sheets.googleapis.com/v4/spreadsheets/" + planilhaId +
              "/values/" + encodeURIComponent(range);
  const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
  const valores = j.values || [];
  return { header: valores[0] || [], rows: valores.slice(1) };
}

exports.handler = async function (event) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    // Dados confidenciais: nunca guardar em cache (nem na borda do Netlify).
    "Cache-Control": "private, no-store",
  };
  const q = event.queryStringParameters || {};

  try {
    // Configuração pública do login (o navegador precisa do Client ID para mostrar o botão)
    if (q.acao === "config") {
      return { statusCode: 200, headers, body: JSON.stringify({ googleClientId: OAUTH_CLIENT_ID, dominio: DOMINIO, loginAtivo: !SEM_LOGIN }) };
    }
    if (q.acao === "testar-acessos") {
      const r = await registrarAcesso(event, "teste do registro", "", "teste", "linha de teste");
      return { statusCode: 200, headers, body: JSON.stringify({
        planilha: ACESSOS_SHEET_ID ? ACESSOS_SHEET_ID.substring(0, 8) + "…" : "(vazio)", aba: ABA_ACESSOS,
        contaDeServico: CLIENT_EMAIL, gravou: !!r.ok, erro: r.erro || null, oQueFazer: dicaAcessos(r) }, null, 2) };
    }
    if (q.acao === "login") {
      if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Use POST." }) };
      if (!OAUTH_CLIENT_ID) return { statusCode: 500, headers, body: JSON.stringify({ error: "Login não configurado: falta a variável GOOGLE_OAUTH_CLIENT_ID." }) };
      const r = await fazerLogin(event);
      return { statusCode: r.status, headers, body: JSON.stringify(r.body) };
    }

    // Daqui para baixo, só com sessão válida
    let usuario = null;
    if (!SEM_LOGIN) {
      if (!OAUTH_CLIENT_ID) return { statusCode: 500, headers, body: JSON.stringify({ error: "Login não configurado: falta a variável GOOGLE_OAUTH_CLIENT_ID. Os dados ficam bloqueados até configurar." }) };
      usuario = verificarSessao(event);
      if (!usuario) return { statusCode: 401, headers, body: JSON.stringify({ error: "login", mensagem: "Faça login com sua conta @" + DOMINIO + "." }) };
    }

    const nome = q.pagina || "transito";
    const pagina = PAGINAS[nome];
    if (!pagina) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: "Página desconhecida: " + nome }) };
    }

    let planilhaId = pagina.planilha();
    if (!planilhaId && pagina.nomePlanilha && CLIENT_EMAIL && PRIVATE_KEY) {
      try { planilhaId = await idPeloNome(pagina.nomePlanilha); }
      catch (e) { return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) }; }
    }
    if (!planilhaId || !CLIENT_EMAIL || !PRIVATE_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({
        error: "Faltam variáveis de ambiente: GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY e o ID da planilha (DASHFEDEX_SHEET_ID / ENTREGUES_SHEET_ID" + (nome === "inhouse" ? " / INHOUSE_SHEET_ID" : nome === "montagens" ? " / MONTAGENS_SHEET_ID" : "") + ")." }) };
    }

    if (q.visita === "1" && usuario) await registrarAcesso(event, usuario.email, usuario.nome, "abriu página", nome);

    const token = await getAccessToken();
    const saida = { ok: true, pagina: nome, abas: {}, avisos: [], lidoEm: new Date().toISOString(), usuario: usuario && usuario.email };

    await Promise.all(Object.keys(pagina.abas).map(async (chave) => {
      const cfg = pagina.abas[chave];
      try {
        const ab = enxugar(await lerRange(token, planilhaId, cfg.range), cfg, q.dias);
        if (ab.faltando && ab.faltando.length) {
          const nomeAba = cfg.range.split("!")[0].replace(/'/g, "");
          saida.avisos.push((ab.cabecalhoLido || []).length
            ? "Aba " + nomeAba + ": não encontrei a(s) coluna(s) " + ab.faltando.join(", ") + ". Cabeçalho lido: " + ab.cabecalhoLido.slice(0, 14).join(" | ")
            : "Aba " + nomeAba + ": vazia ou com outro nome na planilha.");
        }
        delete ab.faltando; delete ab.cabecalhoLido;
        saida.abas[chave] = ab;
      } catch (e) {
        if (cfg.obrigatoria) throw e;
        saida.abas[chave] = { header: [], rows: [] };
        saida.avisos.push("Aba " + cfg.range.split("!")[0] + " não lida: " + String(e.message || e));
      }
    }));

    return { statusCode: 200, headers, body: JSON.stringify(saida) };
  } catch (err) {
    return { statusCode: 500, headers: Object.assign({}, headers, { "Cache-Control": "no-store" }),
             body: JSON.stringify({ error: String(err.message || err) }) };
  }
};