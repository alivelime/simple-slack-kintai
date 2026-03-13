export interface User {
  id: string;
  slack_user_id: string;
  display_name: string;
  is_admin: boolean;
  created_at: string;
}

export interface PunchRecord {
  id: string;
  user_id: string;
  date: string;
  punch_in: string | null;
  punch_out: string | null;
  created_at: string;
}

export interface PunchRecordWithUser extends PunchRecord {
  users: {
    display_name: string;
    slack_user_id: string;
  };
}
