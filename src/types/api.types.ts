/**
 * Agent Society — Qwen API Contract Types
 */

export interface QwenChatRequest {
  model: string;
  messages: QwenMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface QwenMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface QwenChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: QwenChoice[];
  usage: QwenUsage;
}

export interface QwenChoice {
  index: number;
  message: { role: "assistant"; content: string };
  finish_reason: string | null;
}

export interface QwenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}