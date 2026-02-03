const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const QRCode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 3000;

// Paths
const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const FRAMES_DIR = path.join(UPLOADS_DIR, "frames");
const PHOTOS_DIR = path.join(UPLOADS_DIR, "photos");

for (const p of [UPLOADS_DIR, FRAMES_DIR, PHOTOS_DIR]) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// Serve static
app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOADS_DIR, {
  setHeaders(res) {
    // Prevent caching during development; you can remove this in production
    res.setHeader("Cache-Control", "no-store");
  }
}));

// Simple "admin token" (optional). If not set, uploads are open.
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

// Multer storage for frames
const framesStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, FRAMES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    const id = crypto.randomBytes(8).toString("hex");
    cb(null, `frame_${Date.now()}_${id}${ext}`);
  }
});

// Multer storage for photos
const photosStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PHOTOS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    const id = crypto.randomBytes(10).toString("hex");
    cb(null, `photo_${Date.now()}_${id}${ext}`);
  }
});

const uploadFrames = multer({
  storage: framesStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB per frame
});

const uploadPhoto = multer({
  storage: photosStorage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB per photo
});

// Helpers
function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) return next();
  const token = req.get("x-admin-token") || req.query.token || "";
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized (bad admin token)" });
  }
  next();
}

function listPngLike(dirPath) {
  const files = fs.readdirSync(dirPath, { withFileTypes: true })
    .filter(d => d.isFile())
    .map(d => d.name)
    .filter(name => /\.(png|webp|jpg|jpeg)$/i.test(name))
    .sort((a, b) => b.localeCompare(a)); // newest-ish first (by name timestamp)
  return files;
}

// API: list frames
app.get("/api/frames", (req, res) => {
  try {
    const files = listPngLike(FRAMES_DIR);
    const frames = files.map(f => ({
      name: f,
      url: `/uploads/frames/${encodeURIComponent(f)}`
    }));
    res.json({ frames });
  } catch (e) {
    res.status(500).json({ error: "Failed to list frames" });
  }
});

// API: upload frames (admin)
app.post("/api/frames", requireAdmin, uploadFrames.array("frames", 10), (req, res) => {
  const uploaded = (req.files || []).map(f => ({
    name: f.filename,
    url: `/uploads/frames/${encodeURIComponent(f.filename)}`
  }));
  res.json({ uploaded });
});

// API: delete a frame (admin)
app.delete("/api/frames/:name", requireAdmin, (req, res) => {
  const name = req.params.name;
  const full = path.join(FRAMES_DIR, name);
  if (!full.startsWith(FRAMES_DIR)) return res.status(400).json({ error: "Bad name" });
  if (!fs.existsSync(full)) return res.status(404).json({ error: "Not found" });
  fs.unlinkSync(full);
  res.json({ ok: true });
});

// API: upload photo (from booth)
app.post("/api/photo", uploadPhoto.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No photo uploaded" });
  const photoUrl = `/uploads/photos/${encodeURIComponent(req.file.filename)}`;

  // Generate a QR as data URL (PNG). This makes the booth page simple: just show returned image.
  // The QR points to an absolute URL if BASE_URL is set; else to relative URL.
  const base = process.env.BASE_URL || ""; // e.g. https://your-domain.com
  const target = base ? `${base}${photoUrl}` : photoUrl;

  try {
    const qrDataUrl = await QRCode.toDataURL(target, { errorCorrectionLevel: "M", margin: 1, scale: 8 });
    res.json({ photoUrl, qrDataUrl, targetUrl: target });
  } catch (e) {
    res.status(500).json({ error: "Failed to generate QR code" });
  }
});

// Optional: health check
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Photo booth running on http://localhost:${PORT}`);
  console.log(`Admin page: http://localhost:${PORT}/admin.html`);
});
