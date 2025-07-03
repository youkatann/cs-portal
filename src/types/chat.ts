export type ChatMessage = {
  id: number;
  session_id: string;
  user_id: string | null;
  text: string;
  created_at: string;
  slack_ts: string | null;
};