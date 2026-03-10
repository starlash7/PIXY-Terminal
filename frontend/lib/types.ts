export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type ChatResponse = {
  reply: string;
  session_id: string;
  mode: string;
  warnings: string[];
  generated_at: string;
};

export type SkillCard = {
  id: string;
  title: string;
  path: string;
  summary: string;
  last_updated: string;
};

export type SkillsResponse = {
  skills: SkillCard[];
  source: string;
};

export type MemoryResponse = {
  content: string;
  path: string | null;
  warnings: string[];
};

export type SessionCard = {
  id: string;
  title: string;
  path: string;
  last_updated: string;
  message_count: number;
  preview: string;
};

export type SessionsResponse = {
  sessions: SessionCard[];
  source: string;
};

export type HealthResponse = {
  status: string;
  hermes_available: boolean;
  hermes_home: string;
  memory_path: string | null;
};
