# CEFNF Backend (Express) — Railway/Render Ready

API simples para **enviar** e **buscar** canhotos de nota.

## Endpoints
- `GET /health` → `{"ok":true}`
- `POST /api/notas` (multipart form: `numeroEnvio`, `data`, `arquivo`) → salva em `/uploads` e responde `{"ok":true, "arquivo_url":"..." }`
- `GET /api/notas/:numero` ou `GET /api/notas?numero=` → responde `{"ok":true, "numero":"...", "arquivo_url":"..."}` ou 404 se não existir

## Como rodar local
```bash
npm install
npm start
# abre http://localhost:3000/health
```

## Deploy na Railway (passo a passo)
1. Crie um repositório no GitHub (ex.: `cefnf-backend`).
2. Faça upload destes arquivos (`package.json`, `server.js`, pasta `data/` e crie `uploads/` vazia).
3. Em https://railway.app → **New Project → Deploy from GitHub** → selecione o repositório.
4. Após o build, em **Settings → Variables**, adicione (opcional):
   - `PUBLIC_BASE_URL =` a URL pública do serviço (ex.: `https://seu-backend.up.railway.app`)
   - `MAX_FILE_MB = 25` (se quiser ajustar o limite de upload)
5. Em **Settings → Domains → Add Domain**, pegue a URL pública (ex.: `https://seu-backend.up.railway.app`).
6. Teste `GET /health` nessa URL. Deve responder `{"ok":true}`.

> Dica: se não setar `PUBLIC_BASE_URL`, a API tenta derivar automaticamente pelo host do request.

## CORS
Está liberado para qualquer origem (`origin: true`). Se quiser travar só no seu domínio, troque:
```js
app.use(cors({ origin: ["https://cefnf.netlify.app"], credentials: true }));
```

## Estrutura
```
server.js
package.json
uploads/           # onde os arquivos são salvos
data/index.json    # índice simples com {numero, arquivo_url, timestamp}
```

---

**Pronto para ser usado com seu site do Netlify** (use a engrenagem do site configurável para colar a URL nova).
