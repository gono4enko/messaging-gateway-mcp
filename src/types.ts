export interface AgentRequest {
  channel: 'instagram' | 'whatsapp' | 'telegram';
  userId: string;
  text: string;
  meta?: Record<string, unknown>;
}

export interface AgentResponse {
  status: string;
  route: string;
  response?: string;
  reply?: string;
  text?: string;
  intent?: string;
  threadId?: string;
}
