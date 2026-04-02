export interface Task {
  id: string;
  user_id: string;
  title: string;
  status: "open" | "done";
  priority: 1 | 2 | 3;
  source: "manual" | "github" | "calendar";
  grinshaw_note: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}
