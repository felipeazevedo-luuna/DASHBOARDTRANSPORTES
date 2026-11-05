/**
 * SERVIDOR LOCAL — roda o painel no seu computador lendo a planilha de verdade.
 * ------------------------------------------------------------------
 * Usa a MESMA função do Netlify (netlify/functions/dados.js), então o que
 * funcionar aqui funciona igual depois de publicado. Sem dependências npm.
 *
 * Requisitos: Node.js 18 ou mais novo  (confira com:  node --version)
 *
 * Credenciais (escolha UMA forma):
 *   1) Coloque nesta pasta o JSON da conta de serviço com o nome credenciais.json
 *      (o mesmo arquivo baixado do Google Cloud; é a conta que já lê a Dash fedex)
 *   2) ou crie um arquivo .env.local com:
 *        GOOGLE_CLIENT_EMAIL=...@...iam.gserviceaccount.com
 *        GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 *        DASHFEDEX_SHEET_ID=...   (opcional — já vem a Dash fedex por padrão)
 *
 * Login: para testar o login com Google aqui, coloque no .env.local
 *   GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com
 * e cadastre http://localhost:8888 nas "Origens JavaScript autorizadas" do cliente OAuth.
 * Sem essa variável, o servidor LOCAL roda sem login (só no seu computador).
 *
 * Rodar:   node servidor-local.js
 * Abrir:   http://localhost:8888
 *
 * Sem credenciais, o painel abre com dados de exemplo e avisa.
 * credenciais.json e .env.local NÃO devem ir para o GitHub (já estão no .gitignore).
 * ------------------------------------------------------------------
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORTA = Number(process.env.PORT || 8888);
const RAIZ = __dirname;
const DASHFEDEX_PADRAO = "1RMM3Niaf3E9WVCN3NdfU1Cb4Fuz4VSJjaLUPBdrFldI";

if (typeof fetch !== "function") {
  console.error("\n✖ Este servidor precisa do Node.js 18 ou mais novo. Versão atual: " + process.version + "\n");
  process.exit(1);
}

// ---------- credenciais ----------
function lerEnvLocal() {
  const arq = path.join(RAIZ, ".env.local");
  if (!fs.existsSync(arq)) return;
  fs.readFileSync(arq, "utf8").split(/\r?\n/).forEach(function (linha) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) return;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  });
}
function lerCredenciaisJson() {
  const arq = path.join(RAIZ, "credenciais.json");
  if (!fs.existsSync(arq)) return;
  try {
    const j = JSON.parse(fs.readFileSync(arq, "utf8"));
    if (!process.env.GOOGLE_CLIENT_EMAIL) process.env.GOOGLE_CLIENT_EMAIL = j.client_email;
    if (!process.env.GOOGLE_PRIVATE_KEY) process.env.GOOGLE_PRIVATE_KEY = j.private_key;
  } catch (e) {
    console.error("✖ Não consegui ler o credenciais.json: " + e.message);
  }
}
lerEnvLocal();
lerCredenciaisJson();
if (!process.env.DASHFEDEX_SHEET_ID && !process.env.SHEET_ID_TRANSITO) process.env.DASHFEDEX_SHEET_ID = DASHFEDEX_PADRAO;
const TEM_CREDENCIAIS = !!(process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
// Sem cliente OAuth configurado, o servidor local dispensa o login (só aqui; no Netlify nunca).
if (!process.env.GOOGLE_OAUTH_CLIENT_ID) process.env.PAINEL_SEM_LOGIN = "1";

// A função lê as variáveis ao carregar — por isso o require vem depois.
const funcao = require("./netlify/functions/dados.js");

// ---------- arquivos estáticos ----------
const TIPOS = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".json":"application/json; charset=utf-8",
  ".css":"text/css; charset=utf-8", ".svg":"image/svg+xml", ".png":"image/png", ".ico":"image/x-icon", ".md":"text/plain; charset=utf-8" };
const BLOQUEADOS = ["credenciais.json", ".env.local", ".env"];

function servirArquivo(req, res, caminho) {
  let rel = decodeURIComponent(caminho.split("?")[0]);
  if (rel === "/" || rel === "") rel = "/index.html";
  const arq = path.normalize(path.join(RAIZ, rel));
  if (!arq.startsWith(RAIZ) || BLOQUEADOS.indexOf(path.basename(arq)) >= 0) { res.writeHead(403); return res.end("Proibido"); }
  fs.readFile(arq, function (err, dados) {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Não encontrado"); }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(arq).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(dados);
  });
}

// ---------- servidor ----------
http.createServer(async function (req, res) {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/dados" || url.pathname === "/.netlify/functions/dados") {
    const params0 = Object.fromEntries(url.searchParams.entries());
    if (!TEM_CREDENCIAIS && params0.acao !== "config") {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: "sem credenciais no computador — coloque o credenciais.json na pasta do painel" }));
    }
    const params = params0;
    const t0 = Date.now();
    let corpo = "";
    if (req.method === "POST") corpo = await new Promise((ok) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => ok(b)); });
    try {
      const r = await funcao.handler({ queryStringParameters: params, httpMethod: req.method, headers: req.headers, body: corpo });
      res.writeHead(r.statusCode, Object.assign({}, r.headers, { "Cache-Control": "no-store" }));
      res.end(r.body);
      if (params.acao !== "config") console.log("  " + new Date().toLocaleTimeString("pt-BR") + "  /api/dados?" + (params.acao ? "acao=" + params.acao : "pagina=" + (params.pagina || "transito")) +
                  "  →  " + r.statusCode + "  (" + (Date.now() - t0) + " ms)");
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
    return;
  }
  servirArquivo(req, res, url.pathname);
}).listen(PORTA, function () {
  console.log("\n  Painel Logística rodando em  http://localhost:" + PORTA);
  console.log(TEM_CREDENCIAIS
    ? "  Lendo a planilha com a conta " + process.env.GOOGLE_CLIENT_EMAIL
    : "  Sem credenciais: o painel vai abrir com dados de exemplo (veja o LEIA-ME).");
  console.log(process.env.PAINEL_SEM_LOGIN === "1"
    ? "  Login: desligado neste computador (sem GOOGLE_OAUTH_CLIENT_ID no .env.local)."
    : "  Login: ligado — entre com a conta @" + (process.env.PAINEL_DOMINIO || "zeb.mx") + ".");
  console.log("  Para parar: Ctrl + C\n");
});
