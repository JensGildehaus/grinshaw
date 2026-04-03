export interface Task {
  id: string;
  user_id: string;
  title: string;
  status: "open" | "done" | "snoozed";
  priority: "high" | "medium" | "low";
  topic: string | null;
  source: "manual" | "github" | "calendar";
  source_quote: string | null;
  grinshaw_note: string | null;
  due_date: string | null;
  reminded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserPreference {
  id: string;
  user_id: string;
  key: string;
  value: string | null;
  confidence: number;
  updated_at: string;
}
