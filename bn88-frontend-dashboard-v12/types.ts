/**
 * Shared type definitions for the dashboard. These interfaces model the
 * structure of chat sessions and messages as returned from the backend API.
 */
export interface ChatSession {
  /** Unique identifier for the session */
  id: string;
  /** Display name for the conversation (often a user or channel name) */
  title: string;
  /** ISO timestamp of the most recent message in the session */
  lastMessageAt?: string;
}

export interface ChatMessage {
  /** Unique identifier for the message */
  id: string;
  /** Identifier of the session this message belongs to */
  sessionId: string;
  /** Textual content of the message */
  content: string;
  /** ISO timestamp when the message was created */
  createdAt: string;
  /** Optional sender identifier or name */
  sender?: string;
}
