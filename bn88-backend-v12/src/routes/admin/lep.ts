import { Router } from "express";
import { z } from "zod";
import {
  createCampaign,
  getCampaign,
  getCampaignStatus,
  getLepHealth,
  listCampaigns,
  queueCampaign,
  LepClientError,
} from "../../services/lepClient";
import {
  listSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from "../../services/campaignSchedule";
import { getRequestId } from "../../utils/logger";
import { config } from "../../config";

const router = Router();

const buildSuccess = (result: {
  lepBaseUrl: string;
  status: number;
  data: any;
}) => ({
  ok: true,
  source: "lep",
  lepBaseUrl: result.lepBaseUrl,
  status: result.status,
  data: result.data,
});

const mapSchedule = (s: any) => ({
  id: s.id,
  campaignId: s.campaignId,
  cron: s.cronExpr,
  timezone: s.timezone,
  startAt: s.startAt,
  endAt: s.endAt,
  status: s.status,
  idempotencyKey: s.idempotencyKey,
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
});

const handleLepError = (err: any, res: any) => {
  const detail = err instanceof LepClientError ? err.message : "lep_error";
  return res.status(502).json({
    ok: false,
    message: "lep_error",
    detail,
    lepBaseUrl: err?.lepBaseUrl ?? config.LEP_BASE_URL,
  });
};

/* ------------------------------ schemas ------------------------------ */

const createCampaignSchema = z.object({
  name: z.string().min(1),
  message: z.string().min(1),
  targets: z.any().optional(),
});

const scheduleSchema = z.object({
  cron: z.string().min(1),
  timezone: z.string().min(1),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

/* ------------------------------ routes ------------------------------ */

router.get("/health", async (_req, res) => {
  try {
    const result = await getLepHealth();
    return res.json(buildSuccess(result));
  } catch (err: any) {
    return handleLepError(err, res);
  }
});

router.get("/campaigns", async (req, res) => {
  try {
    const page = req.query.page ? Number(req.query.page) : undefined;
    const pageSize = req.query.pageSize
      ? Number(req.query.pageSize)
      : undefined;

    const result = await listCampaigns({ page, pageSize });
    return res.json(buildSuccess(result));
  } catch (err: any) {
    return handleLepError(err, res);
  }
});

router.post("/campaigns", async (req, res) => {
  const parsed = createCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      message: "invalid_input",
      issues: parsed.error.issues,
    });
  }

  const name = parsed.data.name.trim();
  const message = parsed.data.message.trim();

  if (!name || !message) {
    return res
      .status(400)
      .json({ ok: false, message: "name & message required" });
  }

  try {
    const result = await createCampaign({
      name,
      message,
      targets: parsed.data.targets,
    });
    return res.json(buildSuccess(result));
  } catch (err: any) {
    return handleLepError(err, res);
  }
});

router.post("/campaigns/:id/queue", async (req, res) => {
  try {
    const result = await queueCampaign(req.params.id);
    return res.json(buildSuccess(result));
  } catch (err: any) {
    return handleLepError(err, res);
  }
});

router.get("/campaigns/:id", async (req, res) => {
  try {
    const result = await getCampaign(req.params.id);
    return res.json(buildSuccess(result));
  } catch (err: any) {
    return handleLepError(err, res);
  }
});

router.get("/campaigns/:id/status", async (req, res) => {
  try {
    const result = await getCampaignStatus(req.params.id);
    return res.json(buildSuccess(result));
  } catch (err: any) {
    return handleLepError(err, res);
  }
});

router.get("/campaigns/:id/schedules", async (req, res) => {
  try {
    const schedules = await listSchedules(req.params.id);
    const mapped = schedules.map(mapSchedule);

    return res.json(
      buildSuccess({
        lepBaseUrl: config.LEP_BASE_URL,
        status: 200,
        data: { campaignId: req.params.id, schedules: mapped },
      })
    );
  } catch (err: any) {
    return handleLepError(err, res);
  }
});

router.post("/campaigns/:id/schedules", async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({
        ok: false,
        message: "invalid_input",
        issues: parsed.error.issues,
      });
  }

  try {
    const requestId = getRequestId(req);
    const { cron, timezone, startAt, endAt, idempotencyKey } = parsed.data;

    const schedule = await createSchedule(req.params.id, {
      cron,
      timezone,
      startAt,
      endAt,
      idempotencyKey,
      requestId,
    });

    return res.json(
      buildSuccess({
        lepBaseUrl: config.LEP_BASE_URL,
        status: 200,
        data: { schedule: mapSchedule(schedule), campaignId: req.params.id },
      })
    );
  } catch (err: any) {
    return handleLepError(err, res);
  }
});

router.patch("/campaigns/:id/schedules/:scheduleId", async (req, res) => {
  const parsed = scheduleSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      message: "invalid_input",
      issues: parsed.error.issues,
    });
  }

  try {
    const requestId = getRequestId(req);
    const schedule = await updateSchedule(
      req.params.id,
      req.params.scheduleId,
      parsed.data,
      requestId
    );

    return res.json(
      buildSuccess({
        lepBaseUrl: config.LEP_BASE_URL,
        status: 200,
        data: { schedule: mapSchedule(schedule), campaignId: req.params.id },
      })
    );
  } catch (err: any) {
    return handleLepError(err, res);
  }
});

router.delete("/campaigns/:id/schedules/:scheduleId", async (req, res) => {
  try {
    const requestId = getRequestId(req);
    await deleteSchedule(req.params.id, req.params.scheduleId, requestId);

    return res.json(
      buildSuccess({
        lepBaseUrl: config.LEP_BASE_URL,
        status: 200,
        data: { scheduleId: req.params.scheduleId },
      })
    );
  } catch (err: any) {
    return handleLepError(err, res);
  }
});

export default router;

