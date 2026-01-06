// src/services/ai/campaignVision.ts
import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

type CampaignTaskConfig = {
  title: string;
  instructions: string;
  exampleImageUrl?: string;
};

export type CampaignAnalyzeResult = {
  ok: boolean;
  stepDone?: number;
  reason?: string;
  nextStepText?: string;
  finished?: boolean;
  rewardCode?: string;
};

export async function analyzeCampaignImage(params: {
  imageUrl: string;
  task: CampaignTaskConfig;
  currentStep: number;
}): Promise<CampaignAnalyzeResult> {
  const { imageUrl, task, currentStep } = params;

  const prompt = `
คุณคือระบบตรวจรูปภาพสำหรับกิจกรรมแจกของของเพจเกม
กติกา:
- อ่านคำอธิบายกิจกรรม: "${task.title}"
- ใช้คำสั่งต่อไปนี้เป็นเกณฑ์ตรวจรูป: ${task.instructions}

ให้ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่น:
{
  "ok": true|false,
  "stepDone": <เลขขั้นตอนที่ผู้ใช้ทำสำเร็จล่าสุด>,
  "reason": "อธิบายสั้น ๆ",
  "nextStepText": "ข้อความภาษาไทยที่ให้บอทตอบกลับลูกค้า",
  "finished": true|false
}
`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: imageUrl },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
  });

  const raw = resp.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as CampaignAnalyzeResult;
}

