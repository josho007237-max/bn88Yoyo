// src/pages/ChatCenter.tsx

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  type BotItem,
  type ChatSession,
  type ChatMessage,
  type MessageType,
  type FaqEntry,
  type EngagementMessage,
  type LiveStream,
  type LiveQuestion,
  type LivePoll,
  getBots,
  getChatSessions,
  getChatMessages,
  replyChatSession,
  getApiBase,
  searchChatMessages,
  sendRichMessage,
  startTelegramLive,
  submitLiveQuestion,
  createLivePoll,
  getLiveSummary,
  getFaqEntries,
  createFaqEntry,
  updateFaqEntry,
  deleteFaqEntry,
  getEngagementMessages,
  createEngagementMessage,
  updateEngagementMessage,
  deleteEngagementMessage,
  getLineContentBlob,
} from "../lib/api";

const POLL_INTERVAL_MS = 3000; // 3 วินาที
const PAGE_SIZE = 50;

// ใช้ SSE จริงจัง => ปิด polling
const ENABLE_SSE = true;

type PlatformFilterValue =
  | "all"
  | "line"
  | "telegram"
  | "facebook"
  | "webchat"
  | "other";
type MainTab = "chat" | "automation" | "live" | "rich" | "metrics";

type MetricsSnapshot = {
  deliveryTotal: number;
  errorTotal: number;
  perChannel: Record<string, { sent: number; errors: number }>;
  updatedAt?: string;
};

type ConversationGroup = {
  conversationId: string;
  messages: ChatMessage[];
  latestAt: number;
  session?: ChatMessage["session"];
  platform: string | null;
  botId: string | null;
  displayName?: string;
  userId?: string;
};

/* ---------------------- Intent helpers (frontend only) ---------------------- */

const getSessionIntentCode = (s: ChatSession): string | null => {
  const anySession = s as any;
  return (
    anySession.lastKind ??
    anySession.lastIntentCode ??
    anySession.intentKind ??
    anySession.kind ??
    null
  );
};

const getMessageIntentCode = (m: ChatMessage): string | null => {
  const anyMsg = m as any;
  return (
    anyMsg.kind ??
    anyMsg.intentCode ??
    anyMsg.intentKind ??
    anyMsg.meta?.kind ??
    anyMsg.meta?.intent?.code ??
    null
  );
};

const intentCodeToLabel = (code?: string | null): string | null => {
  if (!code) return null;
  const c = String(code).toLowerCase();
  if (c === "deposit") return "ฝากเงิน";
  if (c === "withdraw") return "ถอนเงิน";
  if (c === "register") return "สมัครสมาชิก";
  if (c === "kyc") return "ยืนยันตัวตน";
  if (c === "other") return "อื่น ๆ";
  return code;
};

const IntentBadge: React.FC<{ code?: string | null }> = ({ code }) => {
  const label = intentCodeToLabel(code);
  if (!label || String(code).toLowerCase() === "other") return null;

  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/40">
      {label}
    </span>
  );
};

export const FaqList: React.FC<{
  items: FaqEntry[];
  onEdit?: (item: FaqEntry) => void;
  onDelete?: (id: string) => void;
  loading?: boolean;
}> = ({ items, onEdit, onDelete, loading }) => {
  if (loading)
    return <div className="text-xs text-zinc-400">กำลังโหลด FAQ...</div>;
  if (!items.length)
    return <div className="text-xs text-zinc-400">ยังไม่มี FAQ</div>;

  return (
    <div className="space-y-2">
      {items.map((f) => (
        <div
          key={f.id}
          className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/70 flex items-start justify-between gap-3"
        >
          <div className="space-y-1 text-sm">
            <div className="font-semibold text-zinc-100">{f.question}</div>
            <div className="text-zinc-300 text-xs whitespace-pre-line">
              {f.answer}
            </div>
            <div className="text-[11px] text-zinc-500 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                {f.enabled ? "เปิดใช้งาน" : "ปิด"}
              </span>
              {Array.isArray(f.keywords) && f.keywords.length > 0 && (
                <span className="text-[11px] text-zinc-400 truncate">
                  คีย์เวิร์ด: {(f.keywords as string[]).join(", ")}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 text-[11px]">
            {onEdit && (
              <button
                type="button"
                className="px-2 py-1 rounded bg-emerald-700/40 border border-emerald-600 text-emerald-100"
                onClick={() => onEdit(f)}
              >
                แก้ไข
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="px-2 py-1 rounded bg-red-700/30 border border-red-700 text-red-200"
                onClick={() => onDelete(f.id)}
              >
                ลบ
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export const EngagementList: React.FC<{
  items: EngagementMessage[];
  onToggle?: (item: EngagementMessage, next: boolean) => void;
  onEdit?: (item: EngagementMessage) => void;
  onDelete?: (id: string) => void;
  loading?: boolean;
}> = ({ items, onToggle, onEdit, onDelete, loading }) => {
  if (loading)
    return <div className="text-xs text-zinc-400">กำลังโหลด Engagement...</div>;
  if (!items.length)
    return <div className="text-xs text-zinc-400">ยังไม่มี Engagement</div>;

  return (
    <div className="space-y-2">
      {items.map((m) => (
        <div
          key={m.id}
          className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/70 flex items-start justify-between gap-3"
        >
          <div className="space-y-1 text-sm">
            <div className="font-semibold text-zinc-100">
              {m.platform.toUpperCase()} • {m.channelId}
            </div>
            <div className="text-zinc-300 text-xs whitespace-pre-line">
              {m.text}
            </div>
            <div className="text-[11px] text-zinc-500 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                ทุก {m.intervalMinutes} นาที
              </span>
              <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                {m.enabled ? "เปิด" : "ปิด"}
              </span>
            </div>
          </div>

          <div className="flex gap-2 text-[11px]">
            {onToggle && (
              <button
                type="button"
                className="px-2 py-1 rounded bg-indigo-700/40 border border-indigo-600 text-indigo-100"
                onClick={() => onToggle(m, !m.enabled)}
              >
                {m.enabled ? "ปิด" : "เปิด"}
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                className="px-2 py-1 rounded bg-emerald-700/40 border border-emerald-600 text-emerald-100"
                onClick={() => onEdit(m)}
              >
                แก้ไข
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="px-2 py-1 rounded bg-red-700/30 border border-red-700 text-red-200"
                onClick={() => onDelete(m.id)}
              >
                ลบ
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export const BotPreviewCard: React.FC<{
  platform: "line" | "telegram";
  sampleFaq?: FaqEntry | null;
  sampleEngagement?: EngagementMessage | null;
}> = ({ platform, sampleFaq, sampleEngagement }) => {
  const hasFaq = Boolean(sampleFaq);
  const hasEng = Boolean(sampleEngagement);

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-zinc-100">ตัวอย่างข้อความ</div>
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-3 text-sm">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px]">
            {platform.toUpperCase()}
          </span>
          <span>ข้อความบอท</span>
        </div>

        {hasFaq ? (
          <div className="space-y-1">
            <div className="font-semibold text-zinc-100">
              {sampleFaq?.question}
            </div>
            <div className="text-zinc-200 text-sm whitespace-pre-line">
              {sampleFaq?.answer}
            </div>
          </div>
        ) : (
          <div className="text-zinc-500 text-sm">ยังไม่มี FAQ</div>
        )}

        {hasEng && (
          <div className="border-t border-zinc-800 pt-3 space-y-1">
            <div className="text-xs text-zinc-400">ข้อความ Engagement</div>
            <div className="text-zinc-200 whitespace-pre-line">
              {sampleEngagement?.text}
            </div>
            <div className="text-[11px] text-zinc-500">
              ทุก {sampleEngagement?.intervalMinutes} นาที ไปยัง{" "}
              {sampleEngagement?.channelId}
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-zinc-500">
        LINE จะแสดงเป็น Flex/Quick reply, Telegram แสดงเป็น inline keyboard ได้
      </div>
    </div>
  );
};

const ChatCenter: React.FC = () => {
  const [bots, setBots] = useState<BotItem[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(
    null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [conversationPage, setConversationPage] = useState(1);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<ChatMessage[] | null>(
    null
  );
  const [searching, setSearching] = useState(false);

  const [loadingBots, setLoadingBots] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const [replyText, setReplyText] = useState("");
  const [mainTab, setMainTab] = useState<MainTab>("chat");

  // auto-grow reply textarea
  const replyTaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = replyTaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }, [replyText]);

  const [replyType, setReplyType] = useState<MessageType>("TEXT");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentMetaInput, setAttachmentMetaInput] = useState("");

  // Local upload -> backend (/api/admin/uploads) -> set attachmentUrl/meta
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pickedFileName, setPickedFileName] = useState("");

  const [richPlatform, setRichPlatform] = useState<string>("line");
  const [richTitle, setRichTitle] = useState("");
  const [richBody, setRichBody] = useState("");
  const [richImageUrl, setRichImageUrl] = useState("");
  const [richAltText, setRichAltText] = useState("");
  const [richButtons, setRichButtons] = useState<
    Array<{
      label: string;
      action: "uri" | "message" | "postback";
      value: string;
    }>
  >([]);
  const [richInlineKeyboard, setRichInlineKeyboard] = useState<
    Array<Array<{ text: string; callbackData: string }>>
  >([]);
  const [sendingRich, setSendingRich] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);

  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [liveForm, setLiveForm] = useState({
    channelId: "",
    title: "",
    description: "",
  });
  const [liveQuestionText, setLiveQuestionText] = useState("");
  const [pollForm, setPollForm] = useState({ question: "", options: "" });
  const [liveTab, setLiveTab] = useState<"qna" | "polls">("qna");
  const [liveLoading, setLiveLoading] = useState(false);

  const [faqForm, setFaqForm] = useState({
    question: "",
    answer: "",
    keywords: "",
  });
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [faqItems, setFaqItems] = useState<FaqEntry[]>([]);

  const [engagementForm, setEngagementForm] = useState({
    text: "",
    intervalMinutes: 60,
    channelId: "",
  });
  const [engagementPlatform, setEngagementPlatform] = useState<
    "line" | "telegram"
  >("line");
  const [editingEngagementId, setEditingEngagementId] = useState<string | null>(
    null
  );
  const [engagementItems, setEngagementItems] = useState<EngagementMessage[]>(
    []
  );
  const [automationLoading, setAutomationLoading] = useState(false);
  const [automationError, setAutomationError] = useState<string | null>(null);
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [previewPlatform, setPreviewPlatform] = useState<"line" | "telegram">(
    "line"
  );

  // รูป preview overlay
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // map รูป (LINE) ที่โหลดเป็น blob แล้ว
  const [imgUrlMap, setImgUrlMap] = useState<Record<string, string>>({});
  const imgUrlCreatedRef = useRef<Record<string, string>>({});

  // ล้าง objectURL เก่าทุกครั้งที่เปลี่ยน session (กัน memory leak + กันรูปค้าง)
  useEffect(() => {
    setImgUrlMap((prev) => {
      Object.values(prev).forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          // ignore
        }
      });
      return {};
    });
    imgUrlCreatedRef.current = {};
  }, [selectedSession?.id]);

  const tenant = import.meta.env.VITE_TENANT || "bn9";
  const apiBase = getApiBase();

  // ช่องค้นหา sessions
  const [sessionQuery, setSessionQuery] = useState("");

  // filter platform
  const [platformFilter, setPlatformFilter] =
    useState<PlatformFilterValue>("all");

  const messagesRef = useRef<HTMLDivElement | null>(null);

  /* ------------------- Refs for SSE (กัน stale/closure) ------------------- */
  const selectedBotIdRef = useRef<string | null>(null);
  const selectedSessionIdRef = useRef<string | null>(null);
  const mainTabRef = useRef<MainTab>("chat");
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const isViewingHistoryRef = useRef(false);
  const refreshLockRef = useRef<number>(0);

  const fetchSessions = useCallback(
    async (botId: string, preferSessionId?: string | null) => {
      try {
        setLoadingSessions(true);
        setError(null);

        const data = await getChatSessions(botId, 50);
        setSessions(data);

        const preferId =
          preferSessionId ?? selectedSessionIdRef.current ?? null;
        const nextSession = preferId
          ? (data.find((s) => s.id === preferId) ?? data[0] ?? null)
          : (data[0] ?? null);

        setSelectedSession((prev) => {
          if (prev?.id && nextSession?.id && prev.id === nextSession.id)
            return prev;
          return nextSession ?? null;
        });

        if (!nextSession) setMessages([]);
        return nextSession ?? null;
      } catch (e) {
        console.error(e);
        setError("โหลดรายการห้องแชทไม่สำเร็จ");
        setSessions([]);
        setSelectedSession(null);
        setMessages([]);
        return null;
      } finally {
        setLoadingSessions(false);
      }
    },
    []
  );

  const fetchMessages = useCallback(
    async (sessionId: string) => {
      try {
        setLoadingMessages(true);
        setError(null);

        const data = await getChatMessages(sessionId, 200);
        setMessages(data.items ?? []); // ✅
        return data.items ?? [];
      } catch (e) {
        console.error(e);
        setError("โหลดข้อความไม่สำเร็จ");
        return [];
      } finally {
        setLoadingMessages(false);
      }
    },
    [getChatMessages]
  ); // เพิ่มอันนี้

  const loadAutomation = useCallback(async (botId: string) => {
    try {
      setAutomationLoading(true);
      setAutomationError(null);

      const [faqRes, engRes] = await Promise.all([
        getFaqEntries(botId),
        getEngagementMessages(botId),
      ]);
      setFaqItems(faqRes || []);
      setEngagementItems(engRes || []);
    } catch (err) {
      console.error(err);
      setAutomationError("โหลดข้อมูลบอทไม่สำเร็จ");
      setFaqItems([]);
      setEngagementItems([]);
    } finally {
      setAutomationLoading(false);
    }
  }, []);
  useEffect(() => {
    if (mainTab !== "chat") return;

    const sid = selectedSession?.id;
    if (!sid) {
      setMessages([]);
      return;
    }

    void fetchMessages(sid);
  }, [selectedSession?.id, mainTab, fetchMessages]);

  // 1) โหลด sessions ทุกครั้งที่เลือก bot
  useEffect(() => {
    if (!selectedBotId) return;
    fetchSessions(selectedBotId, null);
  }, [selectedBotId, fetchSessions]);

  // 2) auto-select ห้องแรก ถ้ายังไม่ได้เลือกห้อง
  useEffect(() => {
    if (selectedSession?.id) return;
    if (!sessions?.length) return;

    setSelectedSession(sessions[0]); // หรือ setSelectedSessionId(sessions[0].id)
  }, [sessions, selectedSession?.id, setSelectedSession]);

  // 3) โหลด messages ทุกครั้งที่เปลี่ยนห้อง
  useEffect(() => {
    if (!selectedBotId) return;
    if (!selectedSession?.id) return;

    // ของคุณมักมีฟังก์ชัน fetchMessages(sessionId) หรือ loadConversation(...)
    fetchMessages(selectedSession.id);
  }, [selectedBotId, selectedSession?.id, fetchMessages]);

  /* ------------------------- โหลดรายชื่อบอททั้งหมด ------------------------- */
  useEffect(() => {
    const loadBots = async () => {
      try {
        setLoadingBots(true);
        setError(null);

        const res = await getBots();
        const items = res.items ?? [];
        setBots(items);

        if (items.length > 0) setSelectedBotId(items[0].id);
        else setSelectedBotId(null);
      } catch (e) {
        console.error(e);
        setError("โหลดรายชื่อบอทไม่สำเร็จ");
      } finally {
        setLoadingBots(false);
      }
    };

    void loadBots();
  }, []);

  /* ------------------------- โหลดรูป LINE เป็น blob ------------------------- */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const imageMsgs = (messages ?? []).filter((m) => {
        const t = ((m.type as string) || (m as any).messageType || "TEXT")
          .toString()
          .toUpperCase();
        return t === "IMAGE";
      });

      for (const m of imageMsgs) {
        if (imgUrlCreatedRef.current[m.id]) continue;

        try {
          const blob = await getLineContentBlob(m.id);
          const url = URL.createObjectURL(blob);

          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }

          imgUrlCreatedRef.current[m.id] = url;
          setImgUrlMap((prev) => ({ ...prev, [m.id]: url }));
        } catch (e) {
          console.warn("load image blob failed", m.id, e);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [messages]);

  /* -------------------- โหลด sessions ตามบอทที่เลือกอยู่ -------------------- */
  useEffect(() => {
    const loadSessions = async () => {
      if (!selectedBotId) {
        setSessions([]);
        setSelectedSession(null);
        setMessages([]);
        setFaqItems([]);
        setEngagementItems([]);
        return;
      }
      await fetchSessions(selectedBotId);
      await loadAutomation(selectedBotId);
    };

    void loadSessions();
  }, [selectedBotId, fetchSessions, loadAutomation]);

  /* ------------------- SSE: รับข้อความใหม่แบบ realtime (Chat) ------------------- */

  // refs สำหรับกัน useEffect rerun เพราะฟังก์ชันเปลี่ยน reference
  const fetchSessionsRef = useRef(fetchSessions);
  const fetchMessagesRef = useRef(fetchMessages);

  // ✅ sync ref ให้ตาม state (สำคัญมาก)
  useEffect(() => {
    selectedBotIdRef.current = selectedBotId ?? null;
  }, [selectedBotId]);

  useEffect(() => {
    selectedSessionIdRef.current = selectedSession?.id ?? null;
  }, [selectedSession?.id]);

  useEffect(() => {
    isViewingHistoryRef.current = isViewingHistory;
  }, [isViewingHistory]);

  useEffect(() => {
    mainTabRef.current = mainTab; // เช่น "chat"
  }, [mainTab]);

  useEffect(() => {
    fetchSessionsRef.current = fetchSessions;
    fetchMessagesRef.current = fetchMessages;
  }, [fetchSessions, fetchMessages]);

  useEffect(() => {
    if (!ENABLE_SSE) return;
    if (!tenant) return;

    const token = localStorage.getItem("token"); // เปลี่ยน key ให้ตรงของคุณถ้าไม่ใช่ "token"
    if (!token) return;

    const base = apiBase.replace(/\/$/, "");
    const url =
      `${base}/live/${encodeURIComponent(tenant)}` +
      `?token=${encodeURIComponent(token)}`;

    console.log("[SSE connect url]", url);

    const w = window as any;

    // ปิดตัวเก่าก่อน (จะเกิดตอน tenant/apiBase เปลี่ยน)
    try {
      w.__CHAT_SSE__?.close?.();
    } catch {}
    w.__CHAT_SSE__ = null;

    const es = new EventSource(url);
    w.__CHAT_SSE__ = es;

    const extractBotId = (p: any): string | null =>
      p?.botId ??
      p?.data?.botId ??
      p?.message?.botId ??
      p?.data?.message?.botId ??
      p?.session?.botId ??
      p?.data?.session?.botId ??
      p?.message?.session?.botId ??
      p?.data?.message?.session?.botId ??
      null;

    const extractSessionId = (p: any): string | null =>
      p?.sessionId ??
      p?.data?.sessionId ??
      p?.message?.sessionId ??
      p?.data?.message?.sessionId ??
      p?.session?.id ??
      p?.data?.session?.id ??
      p?.message?.session?.id ??
      p?.data?.message?.session?.id ??
      null;

    const runRefresh = async (payload: any, evType: string) => {
      if (mainTabRef.current !== "chat") return;
      if (isViewingHistoryRef.current) return;

      // กันยิงถี่
      const now = Date.now();
      if (now - refreshLockRef.current < 500) return;
      refreshLockRef.current = now;

      const botIdNow = selectedBotIdRef.current;
      if (!botIdNow) {
        console.log("[SSE skip] no botIdNow", { botIdNow });
        return;
      }

      const botIdFromEvent = extractBotId(payload);
      if (botIdFromEvent && botIdFromEvent !== botIdNow) return;

      const sessionIdFromEvent = extractSessionId(payload);
      const currentSessionId = selectedSessionIdRef.current;

      // รีเฟรช list ห้องก่อน (badge/lastMessageAt)
      const nextSession = await fetchSessionsRef.current(
        botIdNow,
        currentSessionId ?? undefined
      );

      // ถ้า event ระบุ sessionId และไม่ใช่ห้องที่กำลังดู => ไม่โหลด messages (กันเด้ง)
      if (
        sessionIdFromEvent &&
        currentSessionId &&
        sessionIdFromEvent !== currentSessionId
      )
        return;

      const targetSessionId = currentSessionId || nextSession?.id || null;
      if (targetSessionId) await fetchMessagesRef.current(targetSessionId);

      console.log("[SSE refreshed]", {
        evType,
        botIdFromEvent,
        sessionIdFromEvent,
        targetSessionId,
      });
    };

    // ✅ handler กลาง: รองรับทั้ง default message + named event
    const handleEvent = (ev: MessageEvent) => {
      const evName = ev.type; // ถ้ามาจาก addEventListener จะเป็นชื่อ event เช่น "user_message"

      let outer: any = {};
      try {
        outer = JSON.parse(ev.data || "{}");
      } catch {
        outer = { raw: String(ev.data ?? "") };
      }

      console.log("[SSE raw]", { evName, outer });

      // ignore heartbeat
      if (
        evName === "hello" ||
        evName === "ping" ||
        evName === "hb" ||
        evName === "heartbeat"
      )
        return;

      // บาง backend ใส่ type ใน payload / บางที payload อยู่ใน outer.data
      const evType = outer?.type || evName;
      const payload = outer?.data ?? outer;

      void runRefresh(payload, evType);
    };

    es.onopen = () => console.log("[SSE open]");
    es.onerror = (e) => console.warn("[SSE error]", e);

    // default message (จะยิงเมื่อ backend ไม่ได้ใส่ "event:" หรือใส่ event: message)
    es.onmessage = handleEvent;

    // ✅ named events (ของคุณ backend broadcast "user message" ให้ใส่ user_message แน่นอน)
    es.addEventListener("user_message", handleEvent as any);

    // ใส่เผื่อไว้ (ไม่พังถ้าไม่มี)
    es.addEventListener("bot_message", handleEvent as any);
    es.addEventListener("chat:message:new", handleEvent as any);
    es.addEventListener("message:new", handleEvent as any);

    return () => {
      try {
        es.close();
      } catch {}
      if (w.__CHAT_SSE__ === es) w.__CHAT_SSE__ = null;
    };
  }, [apiBase, tenant]);

  /* ----------------------------- handlers ----------------------------- */
  function handleSelectSession(s: ChatSession) {
    setSelectedSession(s);
    setReplyText("");
    setSearchResults(null);
    setSelectedConversationId(s.id);
    setConversationPage(1);

    void fetchMessages(s.id);
  }
  const getAuthHeaders = () => {
    const rawToken =
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("authToken") ||
      "";

    const token =
      rawToken && rawToken.startsWith("Bearer ")
        ? rawToken
        : rawToken
          ? `Bearer ${rawToken}`
          : "";

    const tenantId =
      localStorage.getItem("tenantId") ||
      localStorage.getItem("x-tenant") ||
      localStorage.getItem("tenant") ||
      "";

    const h: Record<string, string> = {};
    if (token) h["Authorization"] = token;
    if (tenantId) h["x-tenant"] = tenantId;
    return h;
  };

  const handleSendReply = async () => {
    if (!selectedSession) return;

    const text = (replyText ?? "").trim();
    const attUrl = (attachmentUrl ?? "").trim();

    // กัน 400
    if (!text && !attUrl) return;

    // parse attachmentMeta ก่อนส่ง
    let attachmentMeta: unknown = undefined;
    if ((attachmentMetaInput ?? "").trim()) {
      try {
        attachmentMeta = JSON.parse(attachmentMetaInput);
      } catch {
        toast.error("รูปแบบ Attachment meta ต้องเป็น JSON ที่ถูกต้อง");
        return;
      }
    }

    const out: any = {};
    if (text) out.text = text;
    if (attUrl) out.attachmentUrl = attUrl;
    if (attachmentMeta !== undefined) out.attachmentMeta = attachmentMeta;

    // type ให้สัมพันธ์กับของที่ส่ง
    out.type = attUrl ? (replyType === "IMAGE" ? "IMAGE" : "FILE") : "TEXT";

    try {
      setSending(true);
      setError(null);

      const res = await replyChatSession(selectedSession.id, out);

      if (res?.ok) {
        toast.success("ส่งข้อความสำเร็จ");
        await fetchMessages(selectedSession.id);

        setReplyText("");
        setAttachmentUrl("");
        setAttachmentMetaInput("");
        setReplyType("TEXT");
      } else {
        const msg = res?.error ? String(res.error) : "ส่งข้อความไม่สำเร็จ";
        setError(msg);
        toast.error(msg);
      }
    } catch (e) {
      console.error(e);
      setError("ส่งข้อความไม่สำเร็จ");
      toast.error("ส่งข้อความไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  };

  const onPickFile = useCallback(async (file?: File) => {
    if (!file) return;
    try {
      setUploading(true);
      setPickedFileName(file.name);

      const fd = new FormData();
      fd.append("file", file);

      const base = String(getApiBase() || "/api").replace(/\/$/, "");
      const resp = await fetch(`${base}/admin/uploads`, {
        method: "POST",
        body: fd,
        headers: {
          ...getAuthHeaders(),
        },
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !(data as any)?.ok || !(data as any)?.url) {
        toast.error((data as any)?.message || "อัปโหลดไม่สำเร็จ");
        return;
      }

      const url = String((data as any).url);
      const mime = String((data as any).mime || file.type || "").toLowerCase();

      setAttachmentUrl(url);
      setAttachmentMetaInput(
        JSON.stringify(
          {
            fileName: (data as any).fileName || file.name,
            mime: mime || undefined,
            size: (data as any).size || file.size || undefined,
          },
          null,
          0
        )
      );

      if (mime.startsWith("image/")) setReplyType("IMAGE");
      else setReplyType("FILE");

      toast.success("อัปโหลดไฟล์แล้ว");
    } catch (e) {
      console.error(e);
      toast.error("อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }, []);
  const handleAddRichButton = () => {
    setRichButtons((prev) => [
      ...prev,
      { label: "ปุ่ม", action: "uri", value: "https://example.com" },
    ]);
  };

  const handleUpdateRichButton = (
    idx: number,
    key: "label" | "action" | "value",
    value: string
  ) => {
    setRichButtons((prev) => {
      const next = [...prev];
      if (!next[idx]) return prev;
      next[idx] = { ...next[idx], [key]: value } as any;
      return next;
    });
  };

  const handleAddInlineRow = () => {
    setRichInlineKeyboard((prev) => [
      ...prev,
      [{ text: "ปุ่ม", callbackData: "cb" }],
    ]);
  };

  const handleAddInlineButton = (rowIdx: number) => {
    setRichInlineKeyboard((prev) => {
      const rows = prev.map((r) => [...r]);
      if (!rows[rowIdx]) rows[rowIdx] = [];
      rows[rowIdx].push({ text: "ปุ่มใหม่", callbackData: "cb" });
      return rows;
    });
  };

  const handleUpdateInlineButton = (
    rowIdx: number,
    btnIdx: number,
    field: "text" | "callbackData",
    value: string
  ) => {
    setRichInlineKeyboard((prev) => {
      const rows = prev.map((r) => [...r]);
      if (!rows[rowIdx] || !rows[rowIdx][btnIdx]) return prev;
      rows[rowIdx][btnIdx] = { ...rows[rowIdx][btnIdx], [field]: value };
      return rows;
    });
  };

  const resetRichComposer = () => {
    setRichTitle("");
    setRichBody("");
    setRichImageUrl("");
    setRichAltText("");
    setRichButtons([]);
    setRichInlineKeyboard([]);
  };

  const handleSendRich = async () => {
    if (!selectedSession) {
      toast.error("กรุณาเลือกห้องแชทก่อน");
      return;
    }
    if (!richTitle.trim() || !richBody.trim()) {
      toast.error("กรุณากรอกหัวข้อและเนื้อหา");
      return;
    }

    setSendingRich(true);
    try {
      const payload = {
        sessionId: selectedSession.id,
        platform: richPlatform,
        title: richTitle.trim(),
        body: richBody.trim(),
        imageUrl: richImageUrl.trim() || undefined,
        altText: richAltText.trim() || undefined,
        buttons: richButtons.filter((b) => b.label.trim() && b.value.trim()),
        inlineKeyboard:
          richPlatform === "telegram"
            ? richInlineKeyboard
                .map((row) =>
                  row.filter((b) => b.text.trim() && b.callbackData.trim())
                )
                .filter((row) => row.length > 0)
            : undefined,
      };

      const res = await sendRichMessage(payload);
      if (res.ok) {
        toast.success("ส่ง Rich Message สำเร็จ");
        resetRichComposer();
        await fetchMessages(selectedSession.id);
      } else {
        toast.error("ส่ง Rich Message ไม่สำเร็จ");
      }
    } catch (err) {
      console.error("send rich error", err);
      toast.error("ส่ง Rich Message ไม่สำเร็จ");
    } finally {
      setSendingRich(false);
    }
  };

  const handleKeyDownInput: React.KeyboardEventHandler<HTMLTextAreaElement> = (
    e
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendReply();
    }
  };

  const reloadLive = useCallback(async () => {
    try {
      setLiveLoading(true);
      const res = await getLiveSummary();

      // รองรับหลายรูปแบบผลลัพธ์ (กันพัง)
      const streams =
        (res as any)?.streams ??
        (res as any)?.items ??
        (res as any)?.data?.streams ??
        [];

      setLiveStreams(Array.isArray(streams) ? streams : []);
    } catch (err) {
      console.error("[reloadLive] failed", err);
      toast.error("โหลด Live ไม่สำเร็จ");
    } finally {
      setLiveLoading(false);
    }
  }, []);

  const handleStartLive = async () => {
    try {
      if (!liveForm.channelId || !liveForm.title) {
        toast.error("กรอก channelId และ title ก่อน");
        return;
      }
      await startTelegramLive(liveForm);
      toast.success("เริ่ม Live stream แล้ว");
      void reloadLive();
    } catch (err) {
      console.error(err);
      toast.error("เริ่ม Live ไม่สำเร็จ");
    }
  };

  const handleSubmitLiveQuestion = async () => {
    const active = liveStreams[0];
    if (!active) {
      toast.error("ยังไม่มี Live stream");
      return;
    }
    if (!liveQuestionText.trim()) {
      toast.error("พิมพ์คำถามก่อน");
      return;
    }
    try {
      await submitLiveQuestion({
        liveStreamId: active.id,
        channelId: active.channelId,
        text: liveQuestionText.trim(),
      } as any);
      toast.success("ส่งคำถามแล้ว");
      setLiveQuestionText("");
    } catch (err) {
      console.error(err);
      toast.error("ส่งคำถามไม่สำเร็จ");
    }
  };

  const handleCreatePoll = async () => {
    const active = liveStreams[0];
    if (!active) {
      toast.error("ยังไม่มี Live stream");
      return;
    }
    const opts = pollForm.options
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);

    if (opts.length < 2) {
      toast.error("ระบุตัวเลือกอย่างน้อย 2 ตัว");
      return;
    }

    try {
      await createLivePoll({
        liveStreamId: active.id,
        question: pollForm.question,
        options: opts,
        channelId: active.channelId,
      });
      toast.success("สร้าง Poll แล้ว");
      setPollForm({ question: "", options: "" });
    } catch (err) {
      console.error(err);
      toast.error("สร้าง Poll ไม่สำเร็จ");
    }
  };

  // ===== SEARCH =====
  const handleSearchSubmit: React.FormEventHandler<HTMLFormElement> = async (
    e
  ) => {
    e.preventDefault();

    const q = searchTerm.trim();
    if (!q) {
      setSearchResults(null);
      if (selectedSession) await fetchMessages(selectedSession.id);
      return;
    }

    try {
      setSearching(true);

      const res = await searchChatMessages({
        q,
        botId: selectedBotId,
        limit: 200,
      });
      const items = Array.isArray(res) ? res : res.items;

      setSearchResults(items);

      if (!Array.isArray(res) && res.conversationId) {
        setSelectedConversationId(res.conversationId);
        setConversationPage(1);
      }
    } catch (err) {
      console.error(err);
      toast.error("ค้นหาไม่สำเร็จ");
    } finally {
      setSearching(false);
    }
  };

  // ===== FAQ =====
  const resetFaqForm = () => {
    setFaqForm({ question: "", answer: "", keywords: "" });
    setEditingFaqId(null);
  };

  const handleSaveFaq = async () => {
    if (!selectedBotId) {
      toast.error("กรุณาเลือกบอทก่อน");
      return;
    }
    if (!faqForm.question.trim() || !faqForm.answer.trim()) {
      toast.error("กรอกคำถามและคำตอบให้ครบ");
      return;
    }

    try {
      setAutomationLoading(true);

      const payload = {
        botId: selectedBotId,
        question: faqForm.question.trim(),
        answer: faqForm.answer.trim(),
        keywords: faqForm.keywords
          ? faqForm.keywords
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean)
          : [],
      };

      if (editingFaqId) {
        const updated = await updateFaqEntry(editingFaqId, payload);
        setFaqItems((prev) =>
          prev.map((f) => (f.id === updated.id ? updated : f))
        );
        toast.success("อัปเดต FAQ แล้ว");
      } else {
        const created = await createFaqEntry(payload);
        setFaqItems((prev) => [created, ...prev]);
        toast.success("เพิ่ม FAQ แล้ว");
      }

      resetFaqForm();
    } catch (err) {
      console.error(err);
      toast.error("บันทึก FAQ ไม่สำเร็จ");
    } finally {
      setAutomationLoading(false);
    }
  };

  const handleDeleteFaq = async (id: string) => {
    try {
      await deleteFaqEntry(id);
      setFaqItems((prev) => prev.filter((f) => f.id !== id));
      toast.success("ลบ FAQ แล้ว");
    } catch (err) {
      console.error(err);
      toast.error("ลบ FAQ ไม่สำเร็จ");
    }
  };

  const handleSaveEngagement = async () => {
    if (!selectedBotId) {
      toast.error("กรุณาเลือกบอทก่อน");
      return;
    }
    if (!engagementForm.text.trim() || !engagementForm.channelId.trim()) {
      toast.error("กรอกข้อความและ channel ให้ครบ");
      return;
    }

    try {
      setAutomationLoading(true);

      const payload = {
        botId: selectedBotId,
        platform: engagementPlatform,
        channelId: engagementForm.channelId.trim(),
        text: engagementForm.text.trim(),
        intervalMinutes: Number(engagementForm.intervalMinutes) || 60,
        enabled: automationEnabled,
      };

      if (editingEngagementId) {
        const updated = await updateEngagementMessage(
          editingEngagementId,
          payload
        );
        setEngagementItems((prev) =>
          prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
        );
        toast.success("อัปเดต Engagement แล้ว");
      } else {
        const created = await createEngagementMessage(payload);
        setEngagementItems((prev) => [created, ...prev]);
        toast.success("เพิ่ม Engagement แล้ว");
      }

      setEngagementForm({ text: "", intervalMinutes: 60, channelId: "" });
      setEditingEngagementId(null);
    } catch (err) {
      console.error(err);
      toast.error("บันทึก Engagement ไม่สำเร็จ");
    } finally {
      setAutomationLoading(false);
    }
  };

  const handleToggleEngagement = async (
    item: EngagementMessage,
    next: boolean
  ) => {
    try {
      setAutomationLoading(true);
      const updated = await updateEngagementMessage(item.id, { enabled: next });
      setEngagementItems((prev) =>
        prev.map((m) => (m.id === item.id ? { ...m, ...updated } : m))
      );
      toast.success(next ? "เปิดบอทแล้ว" : "ปิดบอทแล้ว");
    } catch (err) {
      console.error(err);
      toast.error("สลับสถานะไม่สำเร็จ");
    } finally {
      setAutomationLoading(false);
    }
  };

  const handleDeleteEngagement = async (id: string) => {
    try {
      await deleteEngagementMessage(id);
      setEngagementItems((prev) => prev.filter((m) => m.id !== id));
      toast.success("ลบ Engagement แล้ว");
    } catch (err) {
      console.error(err);
      toast.error("ลบ Engagement ไม่สำเร็จ");
    }
  };

  const handleClearSearch = async () => {
    setSearchTerm("");
    setSearchResults(null);
    if (selectedSession) await fetchMessages(selectedSession.id);
  };

  const currentBot = bots.find((b) => b.id === selectedBotId) || null;
  /* ------------------------- filter ห้องแชทตาม query + platform ------------------------- */
  const filteredSessions = useMemo(() => {
    const q = sessionQuery.trim().toLowerCase();

    return sessions.filter((s) => {
      const plat = (s.platform || "").toLowerCase();

      if (platformFilter !== "all") {
        if (platformFilter === "other") {
          if (["line", "telegram", "facebook", "webchat"].includes(plat))
            return false;
        } else if (plat !== platformFilter) {
          return false;
        }
      }

      if (!q) return true;
      const name = (s.displayName || "").toLowerCase();
      const uid = (s.userId || "").toLowerCase();
      return name.includes(q) || uid.includes(q);
    });
  }, [sessions, sessionQuery, platformFilter]);

  const normalizedMessages = useMemo(
    () =>
      (searchResults ?? messages).map((m) => ({
        ...m,
        conversationId: (m as any).conversationId || (m as any).sessionId,
      })),
    [messages, searchResults]
  );

  const conversationGroups = useMemo<ConversationGroup[]>(() => {
    const map = new Map<string, ChatMessage[]>();

    for (const m of normalizedMessages) {
      const cid =
        (m as any).conversationId || (m as any).sessionId || "unknown";
      const prev = map.get(cid) ?? [];
      prev.push(m);
      map.set(cid, prev);
    }

    const groups = Array.from(map.entries()).map(([conversationId, msgs]) => {
      const sorted = [...msgs].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const latest = sorted[sorted.length - 1];

      return {
        conversationId,
        messages: sorted,
        latestAt: latest ? new Date(latest.createdAt).getTime() : 0,
        session: (latest as any)?.session,
        platform:
          (latest as any)?.platform ??
          (latest as any)?.session?.platform ??
          null,
        botId:
          (latest as any)?.botId ?? (latest as any)?.session?.botId ?? null,
        displayName: (latest as any)?.session?.displayName ?? undefined,
        userId: (latest as any)?.session?.userId ?? undefined,
      };
    });

    return groups.sort((a, b) => b.latestAt - a.latestAt);
  }, [normalizedMessages]);

  // สำคัญ: ห้าม reset page ทุกครั้งที่ messages เปลี่ยน (นี่คือสาเหตุ "เด้งกลับ")
  useEffect(() => {
    if (conversationGroups.length === 0) {
      setSelectedConversationId(null);
      setConversationPage(1);
      return;
    }

    const prev = selectedConversationId;
    const hasPrev =
      prev && conversationGroups.some((c) => c.conversationId === prev);
    if (hasPrev) return;

    const nextId = conversationGroups[0]?.conversationId ?? null;
    setSelectedConversationId(nextId);
    setConversationPage(1);
  }, [conversationGroups, selectedConversationId]);

  const activeConversation = useMemo(() => {
    if (!selectedConversationId) return conversationGroups[0] ?? null;
    return (
      conversationGroups.find(
        (c) => c.conversationId === selectedConversationId
      ) ??
      conversationGroups[0] ??
      null
    );
  }, [conversationGroups, selectedConversationId]);

  const totalPages = useMemo(() => {
    if (!activeConversation) return 1;
    return Math.max(
      1,
      Math.ceil(activeConversation.messages.length / PAGE_SIZE)
    );
  }, [activeConversation]);

  useEffect(() => {
    setConversationPage((prev) => (prev > totalPages ? totalPages : prev));
  }, [totalPages]);

  const pagedMessages = useMemo(() => {
    if (!activeConversation) return [] as ChatMessage[];

    const list = activeConversation.messages; // list นี้ถูก sort ASC อยู่แล้ว
    const total = list.length;

    // หน้า 1 = ตัดจากท้ายสุด (ล่าสุด)
    const end = total - (conversationPage - 1) * PAGE_SIZE;
    const start = Math.max(0, end - PAGE_SIZE);

    return list.slice(start, Math.max(0, end));
  }, [activeConversation, conversationPage]);

  const messagesWithDateHeader = useMemo(() => {
    const result: Array<
      ChatMessage & { _showDateHeader?: boolean; _dateLabel?: string }
    > = [];
    let lastDateKey = "";

    for (const m of pagedMessages) {
      const d = new Date(m.createdAt);
      const dateKey = d.toISOString().slice(0, 10);
      const show = dateKey !== lastDateKey;

      if (show) lastDateKey = dateKey;
      result.push({
        ...(m as any),
        _showDateHeader: show,
        _dateLabel: show ? d.toLocaleDateString() : "",
      });
    }

    return result;
  }, [pagedMessages]);

  useEffect(() => {
    if (!messagesRef.current) return;
    if (conversationPage !== 1) return; // เพิ่มบรรทัดนี้
    messagesRef.current.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [pagedMessages.length, selectedConversationId, conversationPage]);

  const conversationLabel = (c: ConversationGroup) =>
    c.displayName || c.userId || c.conversationId;

  const platformLabel = (p?: string | null) => {
    const plat = (p || "").toLowerCase();
    if (plat === "line") return "LINE";
    if (plat === "telegram") return "Telegram";
    if (plat === "facebook") return "Facebook";
    if (plat === "webchat") return "Webchat";
    if (!plat) return "-";
    return plat;
  };

  const platformFilterLabel = (v: PlatformFilterValue) => {
    if (v === "all") return "ทุกแพลตฟอร์ม";
    if (v === "line") return "LINE";
    if (v === "telegram") return "Telegram";
    if (v === "facebook") return "Facebook";
    if (v === "webchat") return "Webchat";
    return "อื่น ๆ";
  };

  const selectedSessionIntentCode = selectedSession
    ? getSessionIntentCode(selectedSession)
    : null;
  const isSearchMode = Boolean(searchResults);

  const channelMetrics = useMemo(
    () => Object.entries(metrics?.perChannel ?? {}),
    [metrics?.perChannel]
  );
  const channelMetricsData = useMemo(
    () =>
      channelMetrics.map(([channelId, stats]) => ({
        channelId,
        sent: stats.sent ?? 0,
        errors: stats.errors ?? 0,
      })),
    [channelMetrics]
  );

  const previewFaq = useMemo(() => faqItems[0] ?? null, [faqItems]);
  const previewEngagement = useMemo(
    () => engagementItems.find((m) => m.enabled) ?? engagementItems[0] ?? null,
    [engagementItems]
  );

  /* ------------------------------ UI หลัก ------------------------------ */

  const TabButton: React.FC<{ id: MainTab; label: string }> = ({
    id,
    label,
  }) => {
    const active = mainTab === id;
    return (
      <button
        type="button"
        onClick={() => setMainTab(id)}
        aria-label={`เปิดแท็บ ${label}`}
        className={`px-3 py-2 rounded-lg border text-xs transition ${
          active
            ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-100"
            : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800/60"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-col min-h-[80vh] gap-3">
      {/* แถบด้านบน */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Chat Center</h1>
          <span className="text-xs text-zinc-400">
            ดูแชทลูกค้าจากหลายบอท หลายแพลตฟอร์ม ในที่เดียว
          </span>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">แพลตฟอร์ม:</span>
            <select
              aria-label="เลือกแพลตฟอร์ม"
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-100"
              value={platformFilter}
              onChange={(e) =>
                setPlatformFilter(e.target.value as PlatformFilterValue)
              }
            >
              <option value="all">{platformFilterLabel("all")}</option>
              <option value="line">{platformFilterLabel("line")}</option>
              <option value="telegram">
                {platformFilterLabel("telegram")}
              </option>
              <option value="facebook">
                {platformFilterLabel("facebook")}
              </option>
              <option value="webchat">{platformFilterLabel("webchat")}</option>
              <option value="other">{platformFilterLabel("other")}</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">บอท:</span>
            {loadingBots ? (
              <span className="text-xs text-zinc-300">กำลังโหลดบอท...</span>
            ) : bots.length === 0 ? (
              <span className="text-xs text-red-400">
                ยังไม่มีบอทในระบบ กรุณาสร้างบอทก่อน
              </span>
            ) : (
              <select
                aria-label="เลือกบอท"
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-100"
                value={selectedBotId ?? ""}
                onChange={(e) => setSelectedBotId(e.target.value || null)}
              >
                {bots.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || b.id} ({b.platform})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* แถบแท็บ */}
      <div className="flex gap-2 flex-wrap">
        <TabButton id="chat" label="Chat" />
        <TabButton id="automation" label="Automation" />
        <TabButton id="live" label="Live" />
        <TabButton id="rich" label="Rich" />
        <TabButton id="metrics" label="Metrics" />
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-red-400 border border-zinc-800 rounded-lg bg-zinc-900/40">
          {error}
        </div>
      )}

      {/* ========================= TAB: CHAT ========================= */}
      {mainTab === "chat" && (
        <div className="flex flex-1 gap-4 min-h-0">
          {/* ซ้าย: รายการห้องแชท */}
          <div className="w-80 border border-zinc-700 rounded-xl bg-zinc-900/60 flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-zinc-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm">Chat Sessions</div>
                <span className="text-xs text-zinc-400">
                  bot: {currentBot ? currentBot.name || currentBot.id : "-"}
                </span>
              </div>

              <input
                type="text"
                aria-label="ค้นหาห้องแชท"
                className="w-full bg-zinc-950/70 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="ค้นหาชื่อลูกค้า หรือ userId..."
                value={sessionQuery}
                onChange={(e) => setSessionQuery(e.target.value)}
              />
            </div>

            {loadingSessions ? (
              <div className="p-4 text-sm text-zinc-400">กำลังโหลด...</div>
            ) : !selectedBotId ? (
              <div className="p-4 text-sm text-zinc-400">
                กรุณาเลือกบอทเพื่อดูห้องแชท
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="p-4 text-sm text-zinc-400">
                ไม่พบห้องแชทที่ตรงกับเงื่อนไข
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {filteredSessions.map((s) => {
                  const isActive = selectedSession?.id === s.id;
                  const intentCode = getSessionIntentCode(s);

                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectSession(s)}
                      className={`w-full text-left px-4 py-3 border-b border-zinc-800 text-sm hover:bg-zinc-800/60 ${
                        isActive ? "bg-zinc-800/80" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium truncate">
                          {s.displayName || s.userId}
                        </div>
                        <div className="flex items-center gap-1">
                          <IntentBadge code={intentCode} />
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-800 text-zinc-200">
                            {platformLabel(s.platform)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-400">
                        {new Date(s.lastMessageAt).toLocaleString()}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ขวา: ข้อความในห้อง */}
          <div className="flex-1 border border-zinc-700 rounded-xl bg-zinc-900/60 flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex flex-col gap-1 min-w-[200px]">
                <div className="font-semibold text-sm">
                  {isSearchMode
                    ? `ผลการค้นหา (${searchResults?.length ?? 0})`
                    : selectedSession
                      ? selectedSession.displayName || selectedSession.userId
                      : "ไม่มีห้องแชทที่เลือก"}
                </div>

                {!isSearchMode && selectedSession && (
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span>
                      platform: {platformLabel(selectedSession.platform)}
                    </span>
                    <IntentBadge code={selectedSessionIntentCode} />
                  </div>
                )}
              </div>

              <form
                onSubmit={handleSearchSubmit}
                className="flex items-center gap-2 text-xs"
              >
                <input
                  aria-label="ค้นหาข้อความ"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ค้นหาข้อความ..."
                  className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1 text-xs text-zinc-100 w-56"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs disabled:opacity-60"
                >
                  {searching ? "ค้นหา..." : "ค้นหา"}
                </button>

                {isSearchMode && (
                  <button
                    type="button"
                    onClick={() => void handleClearSearch()}
                    className="px-3 py-1 rounded-lg bg-zinc-800 text-zinc-200 text-xs"
                  >
                    ล้างคำค้น
                  </button>
                )}
              </form>
            </div>

            <div className="px-4 py-3 border-b border-zinc-800 bg-black/10 flex flex-col gap-2">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs text-zinc-300">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-zinc-400">สนทนา:</span>
                  {activeConversation ? (
                    <span className="font-medium">
                      {conversationLabel(activeConversation)}
                    </span>
                  ) : (
                    <span className="text-zinc-500">-</span>
                  )}
                  {activeConversation?.platform && (
                    <span className="px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-[11px]">
                      {platformLabel(activeConversation.platform)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-zinc-400">
                    หน้า {conversationPage} / {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setConversationPage((p) => Math.max(1, p - 1))
                      }
                      disabled={conversationPage <= 1}
                      className="px-2 py-1 rounded border border-zinc-700 text-zinc-200 text-[11px] disabled:opacity-50"
                    >
                      ก่อนหน้า
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConversationPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={conversationPage >= totalPages}
                      className="px-2 py-1 rounded border border-zinc-700 text-zinc-200 text-[11px] disabled:opacity-50"
                    >
                      ถัดไป
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pt-1">
                {conversationGroups.length === 0 && (
                  <span className="text-[11px] text-zinc-500">
                    ไม่มีข้อความ
                  </span>
                )}

                {conversationGroups.map((c) => {
                  const isActive = c.conversationId === selectedConversationId;

                  return (
                    <button
                      key={c.conversationId}
                      type="button"
                      onClick={() => {
                        setSelectedConversationId(c.conversationId);
                        setConversationPage(1);
                      }}
                      className={`px-3 py-2 rounded-lg border text-left text-[11px] min-w-[180px] transition ${
                        isActive
                          ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-100"
                          : "border-zinc-700 bg-zinc-900 text-zinc-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs">
                          {conversationLabel(c)}
                        </span>
                        {c.platform && (
                          <span className="px-2 py-0.5 rounded-full bg-black/30 border border-white/10 text-[10px]">
                            {platformLabel(c.platform)}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-1">
                        {c.messages.length} ข้อความ
                      </div>
                    </button>
                  );
                })}
              </div>

              {isViewingHistory && (
                <div className="text-[11px] text-amber-300/90">
                  โหมดอ่านย้อนหลัง: ระบบจะหยุดรีเฟรชอัตโนมัติชั่วคราว
                  (กันเด้งกลับ)
                </div>
              )}
            </div>

            <div
              ref={messagesRef}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-2 text-sm min-h-0"
            >
              {loadingMessages && !isSearchMode && (
                <div className="text-zinc-400 text-xs">กำลังโหลดข้อความ...</div>
              )}

              {!loadingMessages &&
                !isSearchMode &&
                selectedSession &&
                (!activeConversation ||
                  activeConversation.messages.length === 0) && (
                  <div className="text-zinc-400 text-xs">
                    ยังไม่มีข้อความในห้องนี้
                  </div>
                )}

              {!isSearchMode && !selectedSession && (
                <div className="text-zinc-500 text-xs">
                  กรุณาเลือกลูกค้าจากด้านซ้ายเพื่อดูประวัติแชท
                </div>
              )}

              {isSearchMode && searchResults && searchResults.length === 0 && (
                <div className="text-zinc-400 text-xs">
                  ไม่พบข้อความที่ตรงกับคำค้นหา
                </div>
              )}

              {messagesWithDateHeader.map((m: any) => {
                const isBot = m.senderType === "bot";
                const isAdmin = m.senderType === "admin";

                let align = "justify-start";
                let bubble = "bg-zinc-800 text-zinc-50";

                if (isBot) {
                  align = "justify-end";
                  bubble = "bg-emerald-600 text-white";
                } else if (isAdmin) {
                  align = "justify-end";
                  bubble = "bg-blue-600 text-white";
                }

                const msgTypeRaw =
                  (m.type as string) || (m as any).messageType || "TEXT";
                const msgType = msgTypeRaw.toString().toUpperCase();

                const plat = (
                  m.platform ||
                  m.session?.platform ||
                  selectedSession?.platform ||
                  ""
                )
                  .toString()
                  .toLowerCase();

                let content: React.ReactNode = null;

                if (msgType === "TEXT") {
                  content = m.text || "";
                } else if (msgType === "IMAGE") {
                  if (plat === "line") {
                    const imageUrl = imgUrlMap[m.id];

                    content = (
                      <div className="space-y-2">
                        {m.text && (
                          <div className="whitespace-pre-line">{m.text}</div>
                        )}

                        {!imageUrl ? (
                          <div className="text-[11px] text-zinc-400">
                            กำลังโหลดรูป...
                          </div>
                        ) : (
                          <>
                            <div
                              className="inline-block max-w-[180px] cursor-pointer"
                              onClick={() => setPreviewImage(imageUrl)}
                              role="button"
                              aria-label="เปิดดูรูปแบบขยาย"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ")
                                  setPreviewImage(imageUrl);
                              }}
                            >
                              <img
                                src={imageUrl}
                                alt="attachment"
                                className="w-full max-h-40 object-cover rounded-lg border border-white/10"
                              />
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              แตะที่รูปเพื่อขยาย
                            </div>
                          </>
                        )}
                      </div>
                    );
                  } else {
                    const imageUrl = m.attachmentUrl || "";
                    content = imageUrl ? (
                      <div
                        className="inline-block max-w-[180px] cursor-pointer"
                        onClick={() => setPreviewImage(imageUrl)}
                        role="button"
                        aria-label="เปิดดูรูปแบบขยาย"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            setPreviewImage(imageUrl);
                        }}
                      >
                        <img
                          src={imageUrl}
                          alt="attachment"
                          className="w-full max-h-40 object-cover rounded-lg border border-white/10"
                        />
                      </div>
                    ) : (
                      <div className="text-[11px] text-zinc-400">
                        ไม่มีลิงก์รูป
                      </div>
                    );
                  }
                } else if (msgType === "FILE") {
                  const fileName =
                    (m.attachmentMeta as any)?.fileName || "ไฟล์แนบ";
                  content = (
                    <div className="space-y-1">
                      {m.text && (
                        <div className="whitespace-pre-line">{m.text}</div>
                      )}
                      <a
                        href={m.attachmentUrl || "#"}
                        target={m.attachmentUrl ? "_blank" : undefined}
                        rel="noreferrer"
                        className="underline text-emerald-200"
                      >
                        {fileName}
                      </a>
                    </div>
                  );
                } else {
                  content = (
                    <div className="space-y-1">
                      {m.text && (
                        <div className="whitespace-pre-line">{m.text}</div>
                      )}
                      <span className="px-2 py-1 rounded bg-black/30 border border-white/10 text-[11px]">
                        {msgType || "MESSAGE"}
                      </span>
                    </div>
                  );
                }

                const msgIntentCode = getMessageIntentCode(m);
                const msgIntentLabel = intentCodeToLabel(msgIntentCode);

                const messagePlatform = platformLabel(
                  m.platform || m.session?.platform || selectedSession?.platform
                );

                const sessionLabel = isSearchMode
                  ? m.session?.displayName ||
                    m.session?.userId ||
                    m.session?.id ||
                    ""
                  : null;

                return (
                  <React.Fragment key={m.id}>
                    {m._showDateHeader && m._dateLabel && (
                      <div className="flex justify-center my-2">
                        <span className="px-3 py-1 rounded-full bg-zinc-800 text-[10px] text-zinc-300">
                          {m._dateLabel}
                        </span>
                      </div>
                    )}

                    <div className={`flex ${align} gap-2 items-end text-sm`}>
                      <div className="max-w-[70%] flex flex-col gap-1">
                        {sessionLabel && (
                          <div className="text-[11px] text-zinc-400">
                            {sessionLabel}{" "}
                            {messagePlatform ? `(${messagePlatform})` : ""}
                          </div>
                        )}

                        <div
                          className={`px-3 py-2 rounded-2xl ${bubble} whitespace-pre-line`}
                        >
                          {content}

                          {m.senderType === "user" && msgIntentLabel && (
                            <div className="mt-1 text-[10px] opacity-80">
                              หมวด: {msgIntentLabel}
                            </div>
                          )}

                          <div className="mt-1 text-[10px] opacity-70 flex items-center justify-between gap-2">
                            {messagePlatform && (
                              <span className="px-2 py-0.5 rounded-full bg-black/20 border border-white/10">
                                {messagePlatform}
                              </span>
                            )}
                            <span className="ml-auto text-right">
                              {new Date(m.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* เครื่องมือแนบไฟล์/ประเภทข้อความ */}
            <div className="px-4 py-3 border-t border-zinc-800 flex flex-col gap-2 text-xs bg-black/20">
              <div className="flex flex-col md:flex-row gap-2">
                <label className="flex items-center gap-2 text-zinc-300">
                  ประเภทข้อความ
                  <select
                    aria-label="เลือกประเภทข้อความ"
                    className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1"
                    value={replyType}
                    onChange={(e) =>
                      setReplyType(e.target.value as MessageType)
                    }
                    disabled={sending}
                  >
                    <option value="TEXT">TEXT</option>
                    <option value="IMAGE">IMAGE</option>
                    <option value="FILE">FILE</option>
                    <option value="STICKER">STICKER</option>
                    <option value="SYSTEM">SYSTEM</option>
                  </select>
                </label>

                <input
                  type="text"
                  aria-label="ลิงก์ไฟล์หรือรูปแนบ"
                  className="flex-1 border border-zinc-700 bg-zinc-900 rounded px-3 py-1 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="ลิงก์ไฟล์/รูป (ถ้ามี)"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  disabled={sending}
                />
              </div>

              <input
                type="text"
                aria-label="Attachment meta JSON"
                className="border border-zinc-700 bg-zinc-900 rounded px-3 py-1 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder={
                  'Attachment meta (JSON) เช่น {"fileName":"image.png"}'
                }
                value={attachmentMetaInput}
                onChange={(e) => setAttachmentMetaInput(e.target.value)}
                disabled={sending}
              />

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs disabled:opacity-50"
                  disabled={uploading || sending}
                  onClick={() => fileInputRef.current?.click()}
                  title="อัปโหลดไฟล์จากเครื่อง"
                >
                  {uploading ? "กำลังอัปโหลด..." : "อัปโหลดไฟล์"}
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  aria-label="Upload file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = ""; // reset เลือกไฟล์เดิมซ้ำได้
                    void onPickFile(f);
                  }}
                />

                <span className="text-xs text-neutral-400 truncate max-w-[260px]">
                  {pickedFileName
                    ? `เลือกแล้ว: ${pickedFileName}`
                    : "ยังไม่เลือกไฟล์"}
                </span>

                {!!attachmentUrl && (
                  <button
                    type="button"
                    className="px-2 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-xs hover:bg-neutral-800"
                    onClick={() => {
                      setAttachmentUrl("");
                      setAttachmentMetaInput("");
                      setPickedFileName("");
                      setReplyType("TEXT");
                    }}
                    title="ล้างไฟล์แนบ"
                  >
                    ล้างไฟล์
                  </button>
                )}
              </div>
            </div>

            {/* กล่องส่งข้อความแอดมิน */}
            <div className="px-4 py-3 border-t border-zinc-800 flex gap-2 items-end">
              <textarea
                ref={replyTaRef}
                aria-label="พิมพ์ข้อความตอบลูกค้า"
                rows={1}
                className="flex-1 border border-zinc-700 bg-zinc-900 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 max-h-[180px] overflow-auto resize-none"
                placeholder={
                  selectedSession
                    ? "พิมพ์ข้อความตอบลูกค้า แล้วกด Enter หรือปุ่ม ส่ง (Shift+Enter ขึ้นบรรทัดใหม่)"
                    : "กรุณาเลือกห้องแชทก่อนตอบลูกค้า"
                }
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={handleKeyDownInput}
                disabled={!selectedSession || sending}
              />

              <button
                type="button"
                onClick={handleSendReply}
                disabled={
                  !selectedSession ||
                  sending ||
                  (replyText.trim().length === 0 &&
                    attachmentUrl.trim().length === 0)
                }
                className="px-4 py-2 rounded-lg bg-emerald-600 text-xs font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-500"
              >
                {sending ? "กำลังส่ง..." : "ส่ง"}
              </button>
            </div>
          </div>

          {/* Image Preview Overlay */}
          {previewImage && (
            <div
              className="fixed inset-0 z-[999] bg-black/70 flex items-center justify-center"
              onClick={() => setPreviewImage(null)}
              role="dialog"
              aria-label="แสดงรูปแบบขยาย"
            >
              <div
                className="relative max-w-5xl max-h-[90vh] mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  aria-label="ปิดหน้าต่างรูป"
                  className="absolute -top-3 -right-3 bg-black/80 text-white rounded-full w-8 h-8 flex items-center justify-center text-xl"
                >
                  ×
                </button>
                <img
                  src={previewImage}
                  alt="preview"
                  className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-xl"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================= TAB: AUTOMATION ========================= */}
      {mainTab === "automation" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
          <div className="lg:col-span-2 border border-zinc-800 rounded-xl bg-zinc-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-zinc-100">FAQ</div>
              <div className="text-[11px] text-zinc-500">
                bot: {currentBot ? currentBot.name || currentBot.id : "-"}
              </div>
            </div>

            {automationError && (
              <div className="text-xs text-red-400">{automationError}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                aria-label="คำถาม FAQ"
                className="bg-zinc-950/70 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100"
                placeholder="คำถาม"
                value={faqForm.question}
                onChange={(e) =>
                  setFaqForm((p) => ({ ...p, question: e.target.value }))
                }
              />
              <input
                aria-label="คีย์เวิร์ด FAQ"
                className="bg-zinc-950/70 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100"
                placeholder="คีย์เวิร์ด (คั่นด้วย , )"
                value={faqForm.keywords}
                onChange={(e) =>
                  setFaqForm((p) => ({ ...p, keywords: e.target.value }))
                }
              />
            </div>
            <textarea
              aria-label="คำตอบ FAQ"
              className="w-full bg-zinc-950/70 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 min-h-[120px]"
              placeholder="คำตอบ"
              value={faqForm.answer}
              onChange={(e) =>
                setFaqForm((p) => ({ ...p, answer: e.target.value }))
              }
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleSaveFaq()}
                disabled={automationLoading}
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs disabled:opacity-60"
              >
                {editingFaqId ? "บันทึกการแก้ไข" : "เพิ่ม FAQ"}
              </button>
              {editingFaqId && (
                <button
                  type="button"
                  onClick={resetFaqForm}
                  className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-xs"
                >
                  ยกเลิก
                </button>
              )}
            </div>

            <FaqList
              items={faqItems}
              loading={automationLoading}
              onEdit={(item) => {
                setEditingFaqId(item.id);
                setFaqForm({
                  question: item.question || "",
                  answer: item.answer || "",
                  keywords: Array.isArray(item.keywords)
                    ? (item.keywords as string[]).join(", ")
                    : "",
                });
              }}
              onDelete={(id) => void handleDeleteFaq(id)}
            />
          </div>

          <div className="border border-zinc-800 rounded-xl bg-zinc-900/60 p-4 space-y-4">
            <div className="font-semibold text-zinc-100">Engagement</div>

            <div className="flex gap-2">
              <select
                aria-label="เลือกแพลตฟอร์ม Engagement"
                className="bg-zinc-950/70 border border-zinc-700 rounded-lg px-2 py-2 text-xs text-zinc-100"
                value={engagementPlatform}
                onChange={(e) => setEngagementPlatform(e.target.value as any)}
              >
                <option value="line">LINE</option>
                <option value="telegram">Telegram</option>
              </select>
              <input
                aria-label="ChannelId Engagement"
                className="flex-1 bg-zinc-950/70 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100"
                placeholder="channelId"
                value={engagementForm.channelId}
                onChange={(e) =>
                  setEngagementForm((p) => ({
                    ...p,
                    channelId: e.target.value,
                  }))
                }
              />
            </div>

            <textarea
              aria-label="ข้อความ Engagement"
              className="w-full bg-zinc-950/70 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 min-h-[90px]"
              placeholder="ข้อความที่จะส่งซ้ำ"
              value={engagementForm.text}
              onChange={(e) =>
                setEngagementForm((p) => ({ ...p, text: e.target.value }))
              }
            />

            <div className="flex items-center gap-2">
              <input
                aria-label="ความถี่นาที Engagement"
                className="w-28 bg-zinc-950/70 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100"
                type="number"
                min={1}
                value={engagementForm.intervalMinutes}
                onChange={(e) =>
                  setEngagementForm((p) => ({
                    ...p,
                    intervalMinutes: Number(e.target.value),
                  }))
                }
              />
              <span className="text-xs text-zinc-400">นาที</span>
              <label className="ml-auto flex items-center gap-2 text-xs text-zinc-300">
                <input
                  aria-label="เปิดใช้งาน Engagement"
                  type="checkbox"
                  checked={automationEnabled}
                  onChange={(e) => setAutomationEnabled(e.target.checked)}
                />
                enabled
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleSaveEngagement()}
                disabled={automationLoading}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs disabled:opacity-60"
              >
                {editingEngagementId ? "บันทึกการแก้ไข" : "เพิ่ม Engagement"}
              </button>
              {editingEngagementId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingEngagementId(null);
                    setEngagementForm({
                      text: "",
                      intervalMinutes: 60,
                      channelId: "",
                    });
                  }}
                  className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-xs"
                >
                  ยกเลิก
                </button>
              )}
            </div>

            <EngagementList
              items={engagementItems}
              loading={automationLoading}
              onToggle={(item, next) => void handleToggleEngagement(item, next)}
              onEdit={(item) => {
                setEditingEngagementId(item.id);
                setEngagementPlatform(item.platform as any);
                setEngagementForm({
                  text: item.text || "",
                  intervalMinutes: Number(item.intervalMinutes) || 60,
                  channelId: item.channelId || "",
                });
                setAutomationEnabled(Boolean(item.enabled));
              }}
              onDelete={(id) => void handleDeleteEngagement(id)}
            />

            <div className="border-t border-zinc-800 pt-4 space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`px-3 py-2 rounded-lg border text-xs ${
                    previewPlatform === "line"
                      ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-100"
                      : "border-zinc-700 bg-zinc-900 text-zinc-200"
                  }`}
                  onClick={() => setPreviewPlatform("line")}
                >
                  Preview LINE
                </button>
                <button
                  type="button"
                  className={`px-3 py-2 rounded-lg border text-xs ${
                    previewPlatform === "telegram"
                      ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-100"
                      : "border-zinc-700 bg-zinc-900 text-zinc-200"
                  }`}
                  onClick={() => setPreviewPlatform("telegram")}
                >
                  Preview Telegram
                </button>
              </div>

              <BotPreviewCard
                platform={previewPlatform}
                sampleFaq={previewFaq}
                sampleEngagement={previewEngagement}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================= TAB: RICH ========================= */}
      {mainTab === "rich" && (
        <div className="border border-zinc-800 rounded-xl bg-zinc-900/60 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-zinc-100">
              Rich Message Composer
            </div>
            <div className="text-[11px] text-zinc-500">
              session:{" "}
              {selectedSession
                ? selectedSession.displayName ||
                  selectedSession.userId ||
                  selectedSession.id
                : "-"}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              aria-label="เลือกแพลตฟอร์ม Rich"
              className="bg-zinc-950/70 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100"
              value={richPlatform}
              onChange={(e) => setRichPlatform(e.target.value)}
            >
              <option value="line">LINE</option>
              <option value="telegram">Telegram</option>
            </select>

            <input
              aria-label="หัวข้อ Rich"
              className="bg-zinc-950/70 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100"
              placeholder="หัวข้อ"
              value={richTitle}
              onChange={(e) => setRichTitle(e.target.value)}
            />

            <input
              aria-label="รูป URL Rich"
              className="bg-zinc-950/70 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100"
              placeholder="รูป (URL) (ถ้ามี)"
              value={richImageUrl}
              onChange={(e) => setRichImageUrl(e.target.value)}
            />
          </div>

          <textarea
            aria-label="เนื้อหา Rich"
            className="w-full bg-zinc-950/70 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 min-h-[120px]"
            placeholder="เนื้อหา"
            value={richBody}
            onChange={(e) => setRichBody(e.target.value)}
          />

          <input
            aria-label="Alt text Rich"
            className="w-full bg-zinc-950/70 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100"
            placeholder="altText (ถ้ามี)"
            value={richAltText}
            onChange={(e) => setRichAltText(e.target.value)}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-zinc-300">Buttons</div>
              <button
                type="button"
                onClick={handleAddRichButton}
                className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-xs"
              >
                + เพิ่มปุ่ม
              </button>
            </div>

            {richButtons.length === 0 ? (
              <div className="text-xs text-zinc-500">ยังไม่มีปุ่ม</div>
            ) : (
              <div className="space-y-2">
                {richButtons.map((b, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 md:grid-cols-3 gap-2"
                  >
                    <input
                      aria-label={`label ปุ่ม ${idx + 1}`}
                      className="bg-zinc-950/70 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100"
                      value={b.label}
                      onChange={(e) =>
                        handleUpdateRichButton(idx, "label", e.target.value)
                      }
                      placeholder="label"
                    />
                    <select
                      aria-label={`action ปุ่ม ${idx + 1}`}
                      className="bg-zinc-950/70 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100"
                      value={b.action}
                      onChange={(e) =>
                        handleUpdateRichButton(idx, "action", e.target.value)
                      }
                    >
                      <option value="uri">uri</option>
                      <option value="message">message</option>
                      <option value="postback">postback</option>
                    </select>
                    <input
                      aria-label={`value ปุ่ม ${idx + 1}`}
                      className="bg-zinc-950/70 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100"
                      value={b.value}
                      onChange={(e) =>
                        handleUpdateRichButton(idx, "value", e.target.value)
                      }
                      placeholder="value"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {richPlatform === "telegram" && (
            <div className="space-y-2 border-t border-zinc-800 pt-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-zinc-300">Inline Keyboard</div>
                <button
                  type="button"
                  onClick={handleAddInlineRow}
                  className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-xs"
                >
                  + เพิ่มแถว
                </button>
              </div>

              {richInlineKeyboard.length === 0 ? (
                <div className="text-xs text-zinc-500">
                  ยังไม่มี inline keyboard
                </div>
              ) : (
                <div className="space-y-3">
                  {richInlineKeyboard.map((row, rowIdx) => (
                    <div
                      key={rowIdx}
                      className="border border-zinc-800 rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-zinc-400">
                          Row #{rowIdx + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddInlineButton(rowIdx)}
                          className="px-3 py-1 rounded bg-sky-700 text-white text-xs"
                        >
                          + ปุ่ม
                        </button>
                      </div>

                      <div className="space-y-2">
                        {row.map((btn, btnIdx) => (
                          <div
                            key={btnIdx}
                            className="grid grid-cols-1 md:grid-cols-2 gap-2"
                          >
                            <input
                              aria-label={`inline text row ${rowIdx + 1} btn ${btnIdx + 1}`}
                              className="bg-zinc-950/70 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100"
                              value={btn.text}
                              onChange={(e) =>
                                handleUpdateInlineButton(
                                  rowIdx,
                                  btnIdx,
                                  "text",
                                  e.target.value
                                )
                              }
                              placeholder="text"
                            />
                            <input
                              aria-label={`inline callback row ${rowIdx + 1} btn ${btnIdx + 1}`}
                              className="bg-zinc-950/70 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100"
                              value={btn.callbackData}
                              onChange={(e) =>
                                handleUpdateInlineButton(
                                  rowIdx,
                                  btnIdx,
                                  "callbackData",
                                  e.target.value
                                )
                              }
                              placeholder="callbackData"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleSendRich()}
              disabled={sendingRich}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-xs font-medium text-white disabled:opacity-50"
            >
              {sendingRich ? "กำลังส่ง..." : "ส่ง Rich"}
            </button>
            <button
              type="button"
              onClick={resetRichComposer}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-xs font-medium text-zinc-200"
            >
              ล้างฟอร์ม
            </button>
          </div>
        </div>
      )}

      {/* ========================= TAB: LIVE ========================= */}
      {mainTab === "live" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
          <div className="lg:col-span-2 border border-zinc-800 rounded-xl bg-zinc-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-zinc-100">Live Streams</div>
              <button
                type="button"
                onClick={() => void reloadLive()}
                className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-xs"
              >
                รีเฟรช
              </button>
            </div>

            {liveLoading ? (
              <div className="text-xs text-zinc-400">กำลังโหลด...</div>
            ) : liveStreams.length === 0 ? (
              <div className="text-xs text-zinc-400">ยังไม่มี live</div>
            ) : (
              <div className="space-y-2">
                {liveStreams.slice(0, 10).map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/40"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-zinc-100">
                        {s.title || s.id}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {s.channelId}
                      </div>
                    </div>
                    {s.description && (
                      <div className="text-xs text-zinc-300 mt-1">
                        {s.description}
                      </div>
                    )}
                    <div className="text-[11px] text-zinc-500 mt-2 flex gap-3">
                      <span>Q: {(s.questions || []).length}</span>
                      <span>P: {(s.polls || []).length}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-zinc-800 rounded-xl bg-zinc-900/60 p-4 space-y-4">
            <div className="font-semibold text-zinc-100">ควบคุม Live</div>

            <div className="space-y-2">
              <div className="text-xs text-zinc-400">Start Live (Telegram)</div>
              <input
                aria-label="Live channelId"
                className="w-full bg-zinc-950/70 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100"
                placeholder="channelId"
                value={liveForm.channelId}
                onChange={(e) =>
                  setLiveForm((p) => ({ ...p, channelId: e.target.value }))
                }
              />
              <input
                aria-label="Live title"
                className="w-full bg-zinc-950/70 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100"
                placeholder="title"
                value={liveForm.title}
                onChange={(e) =>
                  setLiveForm((p) => ({ ...p, title: e.target.value }))
                }
              />
              <input
                aria-label="Live description"
                className="w-full bg-zinc-950/70 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100"
                placeholder="description (optional)"
                value={liveForm.description}
                onChange={(e) =>
                  setLiveForm((p) => ({ ...p, description: e.target.value }))
                }
              />
              <button
                type="button"
                onClick={() => void handleStartLive()}
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs"
              >
                Start
              </button>
            </div>

            <div className="border-t border-zinc-800 pt-4 space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`px-3 py-2 rounded-lg border text-xs ${
                    liveTab === "qna"
                      ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-100"
                      : "border-zinc-700 bg-zinc-900 text-zinc-200"
                  }`}
                  onClick={() => setLiveTab("qna")}
                >
                  QnA
                </button>
                <button
                  type="button"
                  className={`px-3 py-2 rounded-lg border text-xs ${
                    liveTab === "polls"
                      ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-100"
                      : "border-zinc-700 bg-zinc-900 text-zinc-200"
                  }`}
                  onClick={() => setLiveTab("polls")}
                >
                  Polls
                </button>
              </div>

              {liveTab === "qna" ? (
                <div className="space-y-2">
                  <textarea
                    aria-label="พิมพ์คำถาม Live"
                    className="w-full bg-zinc-950/70 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 min-h-[90px]"
                    placeholder="พิมพ์คำถาม (ส่งเข้า live stream ล่าสุด)"
                    value={liveQuestionText}
                    onChange={(e) => setLiveQuestionText(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => void handleSubmitLiveQuestion()}
                    className="px-3 py-2 rounded-lg bg-sky-700 text-white text-xs"
                  >
                    ส่งคำถาม
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    aria-label="คำถาม Poll"
                    className="w-full bg-zinc-950/70 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100"
                    placeholder="คำถาม poll"
                    value={pollForm.question}
                    onChange={(e) =>
                      setPollForm((p) => ({ ...p, question: e.target.value }))
                    }
                  />
                  <input
                    aria-label="ตัวเลือก Poll"
                    className="w-full bg-zinc-950/70 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100"
                    placeholder="ตัวเลือก (คั่นด้วย , ) เช่น A,B,C"
                    value={pollForm.options}
                    onChange={(e) =>
                      setPollForm((p) => ({ ...p, options: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => void handleCreatePoll()}
                    className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs"
                  >
                    สร้าง Poll
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================= TAB: METRICS ========================= */}
      {mainTab === "metrics" && (
        <div className="bg-[#14171a] border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-sm text-zinc-100">
              Per-channel deliveries
            </div>
            <div className="text-[11px] text-zinc-500">
              updatedAt: {metrics?.updatedAt ?? "-"}
            </div>
          </div>

          {channelMetrics.length === 0 ? (
            <div className="text-xs text-zinc-400">ยังไม่มีข้อมูล</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={channelMetricsData}
                  margin={{ top: 8, right: 8, left: -16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="channelId"
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="sent" radius={[4, 4, 0, 0]} name="Sent" />
                  <Bar dataKey="errors" radius={[4, 4, 0, 0]} name="Errors" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="text-[11px] text-zinc-500">
            หมายเหตุ: ถ้าคุณมี endpoint metrics แล้ว เดี๋ยวค่อยผูกเพิ่ม
            (ตอนนี้เป็น UI เฉย ๆ)
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatCenter;
