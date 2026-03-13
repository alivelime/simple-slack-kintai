import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthSelector } from "@/components/month-selector";
import { AttendanceTable } from "@/components/attendance-table";
import type { PunchRecord } from "@/lib/types";

interface Props {
  searchParams: Promise<{ month?: string }>;
}

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  // Determine month
  const now = new Date();
  let year: number, month: number;
  if (params.month) {
    const [y, m] = params.month.split("-").map(Number);
    year = y;
    month = m - 1;
  } else {
    // Use JST current month
    const jstDate = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
    );
    year = jstDate.getFullYear();
    month = jstDate.getMonth();
  }

  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`;

  const { data: records } = await supabase
    .from("punch_records")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl">打刻記録</h2>
        <MonthSelector />
      </div>
      <Card>
        <CardContent className="p-0">
          <AttendanceTable
            records={(records as PunchRecord[]) ?? []}
            year={year}
            month={month}
          />
        </CardContent>
      </Card>
    </div>
  );
}
