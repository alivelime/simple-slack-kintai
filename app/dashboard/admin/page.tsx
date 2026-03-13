import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { MonthSelector } from "@/components/month-selector";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminUserFilter } from "@/components/admin-user-filter";
import type { PunchRecordWithUser, User } from "@/lib/types";

interface Props {
  searchParams: Promise<{ month?: string; user?: string }>;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function calcHours(punchIn: string | null, punchOut: string | null): string {
  if (!punchIn || !punchOut) return "—";
  const diff =
    (new Date(punchOut).getTime() - new Date(punchIn).getTime()) / 1000 / 60 / 60;
  return diff.toFixed(1) + "h";
}

export default async function AdminPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/");

  // Check admin
  const { data: currentUser } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", authUser.id)
    .single();

  if (!currentUser?.is_admin) redirect("/dashboard");

  // Determine month
  const now = new Date();
  let year: number, month: number;
  if (params.month) {
    const [y, m] = params.month.split("-").map(Number);
    year = y;
    month = m - 1;
  } else {
    const jstDate = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
    );
    year = jstDate.getFullYear();
    month = jstDate.getMonth();
  }

  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`;

  // Get all users for filter
  const { data: allUsers } = await supabase
    .from("users")
    .select("*")
    .order("display_name");

  // Build query
  let query = supabase
    .from("punch_records")
    .select("*, users(display_name, slack_user_id)")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  if (params.user) {
    query = query.eq("user_id", params.user);
  }

  const { data: records } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl">管理者ページ — 全員の打刻記録</h2>
      </div>
      <div className="flex items-center justify-between">
        <AdminUserFilter users={(allUsers as User[]) ?? []} />
        <MonthSelector />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table className="ledger-table">
            <TableHeader>
              <TableRow>
                <TableHead>名前</TableHead>
                <TableHead>日付</TableHead>
                <TableHead>出勤</TableHead>
                <TableHead>退勤</TableHead>
                <TableHead>勤務時間</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {((records as PunchRecordWithUser[]) ?? []).map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-bold">
                    {record.users?.display_name ?? "—"}
                  </TableCell>
                  <TableCell>{record.date}</TableCell>
                  <TableCell>{formatTime(record.punch_in)}</TableCell>
                  <TableCell>{formatTime(record.punch_out)}</TableCell>
                  <TableCell>
                    {calcHours(record.punch_in, record.punch_out)}
                  </TableCell>
                </TableRow>
              ))}
              {(!records || records.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    記録がありません
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
