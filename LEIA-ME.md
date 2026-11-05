# Rodar o painel no computador

## Jeito 1 — só para ver o visual (dados de exemplo)

Descompacte a pasta e dê dois cliques no `index.html`.
Abre no navegador com **dados fictícios**, e um aviso amarelo no topo diz isso.

## Jeito 2 — com a planilha de verdade

1. Instale o **Node.js 18 ou mais novo** (https://nodejs.org). Para conferir,
   abra o terminal e rode `node --version`.
2. Coloque nesta pasta o arquivo JSON da **conta de serviço do Google** (a mesma
   que o Painel de SLA usa para ler a Dash fedex) e renomeie para
   **`credenciais.json`**.
3. Abra o terminal **dentro desta pasta** e rode:

   ```
   node servidor-local.js
   ```

4. Abra **http://localhost:8888** no navegador.

O terminal mostra cada leitura da planilha. Para parar, `Ctrl + C`.

Se aparecer o aviso "sem credenciais no computador", o `credenciais.json` não
está na pasta ou tem outro nome.

### Não tem o JSON, só o e-mail e a chave?

Crie um arquivo `.env.local` nesta pasta com:

```
GOOGLE_CLIENT_EMAIL=nome@projeto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

São os mesmos valores das variáveis do site do Painel de SLA no Netlify.

## Login no computador

Sem nada a mais, o servidor local roda **sem login** (só no seu computador).
Para testar o login com Google aqui, acrescente no `.env.local`:

```
GOOGLE_OAUTH_CLIENT_ID=xxxx.apps.googleusercontent.com
```

e confira se `http://localhost:8888` está nas origens autorizadas do cliente OAuth.

## Cuidado

`credenciais.json` e `.env.local` são senhas. Eles já estão no `.gitignore` para
não irem para o GitHub quando você for publicar, e o servidor local se recusa a
entregar esses arquivos pelo navegador.
