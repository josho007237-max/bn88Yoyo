export type LineRawEvent = {/* ... ตาม LINE */};
export type TelegramRawEvent = {/* ... ตาม Telegram */};
export type FacebookRawEvent = {/* ... ตาม FB */};

export type IngestPlatform = "line" | "telegram" | "facebook";

export type IngestRawEvent =
  | { platform: "line"; event: LineRawEvent }
  | { platform: "telegram"; event: TelegramRawEvent }
  | { platform: "facebook"; event: FacebookRawEvent };

