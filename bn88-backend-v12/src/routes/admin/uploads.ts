import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = (Date.now() + "-" + file.originalname).replace(/[^\w.\-]+/g, "_");
    cb(null, safe);
  },
});

const upload = multer({ storage });

// ต้องมี POST "/"
router.post("/", upload.single("file"), (req, res) => {
  const f = req.file;
  if (!f) return res.status(400).json({ ok: false, message: "file_required" });

  return res.json({
    ok: true,
    url: `/api/uploads/${f.filename}`,
    filename: f.filename,
    size: f.size,
    mime: f.mimetype,
  });
});

export default router;


