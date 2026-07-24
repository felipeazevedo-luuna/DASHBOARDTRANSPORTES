/**
 * PAINEL DE SLA · LUUNA — backend de dados (Netlify Function)
 * ------------------------------------------------------------------
 * Lê a planilha PRIVADA via Google Sheets API usando uma CONTA DE
 * SERVIÇO. A credencial fica só no servidor (variáveis de ambiente
 * do Netlify); o navegador nunca a vê. Sem dependências npm.
 *
 * Variáveis de ambiente (Netlify → Site settings → Environment):
 *   SHEET_ID              ID da planilha (o trecho entre /d/ e /edit da URL)
 *   SHEET_RANGE           ex.: "Página1!A:W"  (aba!intervalo)
 *   GOOGLE_CLIENT_EMAIL   e-mail da conta de serviço (…@…iam.gserviceaccount.com)
 *   GOOGLE_PRIVATE_KEY    private_key do JSON da conta de serviço (com \n)
 *   HAS_HEADER            "true" (padrão) se a 1ª linha for cabeçalho
 * ------------------------------------------------------------------
 */
const crypto = require("crypto");

const SHEET_ID     = process.env.SHEET_ID;
const RANGE        = process.env.SHEET_RANGE || "Página1!A:W";
const HAS_HEADER   = (process.env.HAS_HEADER || "true").toLowerCase() !== "false";
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY  = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

// 2ª planilha — pedidos em trânsito ("Rastreamento"). Opcional.
const SHEET_ID_T   = process.env.SHEET_ID_TRANSITO;
const RANGE_T      = process.env.SHEET_RANGE_TRANSITO || "Rastreamento!A:R";
const HAS_HEADER_T = (process.env.HAS_HEADER_TRANSITO || "true").toLowerCase() !== "false";

function b64url(input) {
  return Buffer.from(input).toString("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));
  const unsigned = header + "." + claim;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(PRIVATE_KEY, "base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = unsigned + "." + signature;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error("Falha ao obter token: " + JSON.stringify(data));
  return data.access_token;
}

exports.handler = async function () {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  };
  try {
    if (!SHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({
        error: "Faltam variáveis de ambiente (SHEET_ID / GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY)." }) };
    }
    const token = await getAccessToken();
    const url = "https://sheets.googleapis.com/v4/spreadsheets/" + SHEET_ID +
                "/values/" + encodeURIComponent(RANGE);
    const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));

    let rows = j.values || [];
    if (HAS_HEADER) rows = rows.slice(1);

    // 2ª planilha (trânsito) — não derruba a resposta se falhar (ex.: ainda não compartilhada)
    let rowsTransito = [], transitoError = null;
    if (SHEET_ID_T) {
      try {
        const urlT = "https://sheets.googleapis.com/v4/spreadsheets/" + SHEET_ID_T +
                     "/values/" + encodeURIComponent(RANGE_T);
        const rt = await fetch(urlT, { headers: { Authorization: "Bearer " + token } });
        const jt = await rt.json();
        if (jt.error) throw new Error(jt.error.message || JSON.stringify(jt.error));
        rowsTransito = jt.values || [];
        if (HAS_HEADER_T) rowsTransito = rowsTransito.slice(1);
      } catch (e) { transitoError = String(e.message || e); }
    }

    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true, rows: rows, count: rows.length, range: RANGE,
      rowsTransito: rowsTransito, countTransito: rowsTransito.length, transitoError: transitoError,
      updated: new Date().toISOString() }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(err.message || err) }) };
  }
};
