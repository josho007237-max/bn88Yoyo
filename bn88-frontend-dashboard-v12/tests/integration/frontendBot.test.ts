import React from "react";
import { describe, it, beforeEach, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Minimal recharts mock to avoid rendering errors in jsdom
vi.mock("recharts", () => {
  const Stub = ({ children }: any) => <div>{children}</div>;
  return {
    ResponsiveContainer: Stub,
    BarChart: Stub,
    Bar: Stub,
    XAxis: Stub,
    YAxis: Stub,
    CartesianGrid: Stub,
    Tooltip: Stub,
  };
});

const faqStore: any[] = [
  { id: "faq-1", botId: "bot-1", question: "ถามอะไรได้บ้าง?", answer: "ตอบได้หลายอย่าง", keywords: [] },
];
const engagementStore: any[] = [
  { id: "eng-1", botId: "bot-1", platform: "line", channelId: "U123", text: "เริ่มใช้งาน", intervalMinutes: 60, enabled: true },
];

vi.stubGlobal(
  "EventSource",
  class {
    onmessage: any;
    addEventListener() {}
    removeEventListener() {}
    close() {}
  },
);

vi.mock("../../src/lib/api", () => {
  const bots = [{ id: "bot-1", tenant: "t1", name: "Bot One", platform: "line", active: true }];
  return {
    getApiBase: () => "http://localhost:3000",
    getBots: vi.fn(async () => bots),
    getChatSessions: vi.fn(async () => []),
    getChatMessages: vi.fn(async () => []),
    searchChatMessages: vi.fn(async () => []),
    replyChatSession: vi.fn(async () => ({ ok: true })),
    sendRichMessage: vi.fn(async () => ({ ok: true })),
    startTelegramLive: vi.fn(async () => ({ id: "live-1" })),
    submitLiveQuestion: vi.fn(async () => ({})),
    createLivePoll: vi.fn(async () => ({})),
    getLiveSummary: vi.fn(async () => ({ liveStreams: [], questions: [], polls: [] })),
    getFaqEntries: vi.fn(async (botId: string) => faqStore.filter((f) => f.botId === botId)),
    createFaqEntry: vi.fn(async (payload: any) => {
      const item = { id: `faq-${Date.now()}`, ...payload };
      faqStore.unshift(item);
      return item;
    }),
    updateFaqEntry: vi.fn(async (id: string, payload: any) => {
      const idx = faqStore.findIndex((f) => f.id === id);
      if (idx >= 0) faqStore[idx] = { ...faqStore[idx], ...payload };
      return faqStore[idx];
    }),
    deleteFaqEntry: vi.fn(async (id: string) => {
      const idx = faqStore.findIndex((f) => f.id === id);
      if (idx >= 0) faqStore.splice(idx, 1);
    }),
    getEngagementMessages: vi.fn(async (botId: string) => engagementStore.filter((e) => e.botId === botId)),
    createEngagementMessage: vi.fn(async (payload: any) => {
      const item = { id: `eng-${Date.now()}`, enabled: true, ...payload };
      engagementStore.unshift(item);
      return item;
    }),
    updateEngagementMessage: vi.fn(async (id: string, payload: any) => {
      const idx = engagementStore.findIndex((e) => e.id === id);
      if (idx >= 0) engagementStore[idx] = { ...engagementStore[idx], ...payload };
      return engagementStore[idx];
    }),
    deleteEngagementMessage: vi.fn(async (id: string) => {
      const idx = engagementStore.findIndex((e) => e.id === id);
      if (idx >= 0) engagementStore.splice(idx, 1);
    }),
  };
});

import ChatCenter from "../../src/pages/ChatCenter";

describe("ChatCenter FAQ & Engagement panel", () => {
  beforeEach(() => {
    faqStore.splice(0, faqStore.length, {
      id: "faq-1",
      botId: "bot-1",
      question: "ถามอะไรได้บ้าง?",
      answer: "ตอบได้หลายอย่าง",
      keywords: [],
    });
    engagementStore.splice(0, engagementStore.length, {
      id: "eng-1",
      botId: "bot-1",
      platform: "line",
      channelId: "U123",
      text: "เริ่มใช้งาน",
      intervalMinutes: 60,
      enabled: true,
    });
  });

  it("renders seeded FAQ/engagement and updates when adding new entries", async () => {
    render(
      <MemoryRouter>
        <ChatCenter />
      </MemoryRouter>,
    );

    await screen.findByText("ถามอะไรได้บ้าง?");
    await screen.findByText("เริ่มใช้งาน");

    const questionInput = screen.getByText("คำถาม").closest("input") as HTMLInputElement;
    const answerInput = screen.getByText("คำตอบ").closest("textarea") as HTMLTextAreaElement;
    fireEvent.change(questionInput, "บริการอะไรบ้าง?");
    fireEvent.change(answerInput, "มีหลายบริการ");
    const addFaqBtn = screen.getByText("เพิ่ม FAQ");
    fireEvent.click(addFaqBtn);

    await screen.findByText("บริการอะไรบ้าง?");

    const channelInput = screen.getByText("Channel/Group ID").closest("input") as HTMLInputElement;
    const engagementTextarea = screen
      .getByText("ข้อความที่จะโพสต์")
      .closest("textarea") as HTMLTextAreaElement;
    const intervalInput = screen.getByText("Interval (นาที)").closest("input") as HTMLInputElement;
    fireEvent.change(channelInput, "C111");
    fireEvent.change(engagementTextarea, "ทดสอบข้อความใหม่");
    fireEvent.change(intervalInput, "5");
    fireEvent.click(screen.getByText("เพิ่มข้อความ"));

    await screen.findByText("ทดสอบข้อความใหม่");
  });

  it("allows toggling engagement and shows preview updates", async () => {
    render(
      <MemoryRouter>
        <ChatCenter />
      </MemoryRouter>,
    );

    await screen.findByText("เริ่มใช้งาน");
    const toggleBtn = screen.getByText("ปิด");
    fireEvent.click(toggleBtn);

    await screen.findByText("ข้อความ Engagement");
  });
});
