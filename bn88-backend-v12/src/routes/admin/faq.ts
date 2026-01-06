import { Router } from "express";

const r = Router();

// stub: ให้หน้าไม่พัง (ค่อยทำของจริงทีหลัง)
r.get("/", (_req, res) => {
  return res.json({ ok: true, items: [] });
});

export default r;

