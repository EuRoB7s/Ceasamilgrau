import express from "express";
import cors from "cors";
import multer from "multer";
import fse from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import morgan from "morgan";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 25);
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

// We'll try to use PUBLIC_BASE_URL if set, else derive from request host.
const ENV_PUBLIC = process.env.PUBLIC_BASE_URL || "";

const app = express();
app.use(morgan("tiny"));

// CORS (permissive by default; lock down if desired)
app.use(cors({ origin: true, credentials: true }));

// Basic body parser for JSON (not needed for multipart but fine to have)
app.use(express.json({ limit: "1mb" }));

// Ensure folders exist
const UPLOAD_DIR = path.join(__dirname, "uploads");
const DATA_DIR = path.join(__dirname, "data");
const INDEX_FILE = path.join(DATA_DIR, "index.json");
await fse.ensureDir(UPLOAD_DIR);
await fse.ensureDir(DATA_DIR);
if (!(await fse.pathExists(INDEX_FILE))) {
  await fse.writeJson(INDEX_FILE, { items: [] }, { spaces: 2 });
}

// Serve uploads statically
app.use("/uploads", express.static(UPLOAD_DIR, {
  setHeaders: (res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }
}));

// Helpers
function sanitize(name = "") {
  return name.replace(/[^\w.\-]/g, "_");
}
function fullBaseUrl(req) {
  if (ENV_PUBLIC) return ENV_PUBLIC.replace(/\/+$/, "");
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "http").toString();
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}
async function loadIndex() {
  try {
    return await fse.readJson(INDEX_FILE);
  } catch {
    return { items: [] };
  }
}
async function saveIndex(data) {
  await fse.writeJson(INDEX_FILE, data, { spaces: 2 });
}

// Multer storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) { cb(null, UPLOAD_DIR); },
  filename: function(req, file, cb) {
    const numeroEnvio = sanitize(req.body.numeroEnvio || "sem_numero");
    const ts = Date.now();
    const orig = sanitize(file.originalname || "arquivo");
    cb(null, `${numeroEnvio}-${ts}-${orig}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES }
});

// Routes
app.get("/health", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify({ ok: true, now: new Date().toISOString() }));
});

// GET /api/notas/:numero  OR  GET /api/notas?numero=
app.get("/api/notas/:numero?", async (req, res) => {
  const numero = req.params.numero || req.query.numero;
  if (!numero) return res.status(400).json({ ok: false, erro: "Informe o número" });

  // Strategy: first try index.json; if not found, fallback: scan filenames.
  const idx = await loadIndex();
  const found = [...idx.items]
    .filter(x => String(x.numero) === String(numero))
    .sort((a,b)=> b.timestamp - a.timestamp)[0];

  if (found) {
    return res.json({ ok: true, numero: String(found.numero), arquivo_url: found.arquivo_url });
  }

  // Fallback: scan directory (first match by prefix `${numero}-`)
  const files = await fse.readdir(UPLOAD_DIR);
  const match = files.find(name => name.startsWith(`${sanitize(String(numero))}-`));
  if (!match) return res.status(404).json({ ok: false, erro: "Nota não encontrada" });

  const url = `${fullBaseUrl(req)}/uploads/${encodeURIComponent(match)}`;
  return res.json({ ok: true, numero: String(numero), arquivo_url: url });
});

// POST /api/notas (multipart)
// fields: numeroEnvio, data, arquivo(file)
app.post("/api/notas", upload.single("arquivo"), async (req, res) => {
  try {
    const numeroEnvio = (req.body.numeroEnvio || "").trim();
    const data = (req.body.data || "").trim();
    if (!numeroEnvio || !req.file) {
      return res.status(400).json({ ok: false, erro: "Campos obrigatórios: numeroEnvio e arquivo" });
    }
    const url = `${fullBaseUrl(req)}/uploads/${encodeURIComponent(req.file.filename)}`;

    // update index
    const idx = await loadIndex();
    idx.items.push({
      numero: String(numeroEnvio),
      data: data || null,
      filename: req.file.filename,
      arquivo_url: url,
      timestamp: Date.now()
    });
    await saveIndex(idx);

    return res.json({ ok: true, numeroEnvio: String(numeroEnvio), data: data || null, arquivo_url: url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, erro: "Falha interna ao enviar" });
  }
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ ok: false, erro: "Rota não encontrada" });
});

app.listen(PORT, () => {
  console.log(`API on http://localhost:${PORT}`);
  console.log(`Uploads dir: ${UPLOAD_DIR}`);
});
