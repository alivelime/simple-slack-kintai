import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PunchRecord } from "@/lib/types";

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

function dayOfWeek(dateStr: string): string {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const d = new Date(dateStr + "T00:00:00+09:00");
  return days[d.getDay()];
}

interface Props {
  records: PunchRecord[];
  year: number;
  month: number; // 0-indexed
}

export function AttendanceTable({ records, year, month }: Props) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const recordMap = new Map<string, PunchRecord>();
  for (const r of records) {
    recordMap.set(r.date, r);
  }

  const rows = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const record = recordMap.get(dateStr);
    return { dateStr, day, record };
  });

  return (
    <Table className="ledger-table">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[120px]">日付</TableHead>
          <TableHead className="w-[60px]">曜日</TableHead>
          <TableHead>出勤</TableHead>
          <TableHead>退勤</TableHead>
          <TableHead>勤務時間</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ dateStr, day, record }) => {
          const dow = dayOfWeek(dateStr);
          const isWeekend = dow === "土" || dow === "日";
          return (
            <TableRow
              key={dateStr}
              className={isWeekend ? "text-muted-foreground" : ""}
            >
              <TableCell>{`${month + 1}/${day}`}</TableCell>
              <TableCell className={dow === "日" ? "text-red-700" : dow === "土" ? "text-blue-700" : ""}>
                {dow}
              </TableCell>
              <TableCell>{formatTime(record?.punch_in ?? null)}</TableCell>
              <TableCell>{formatTime(record?.punch_out ?? null)}</TableCell>
              <TableCell>
                {calcHours(record?.punch_in ?? null, record?.punch_out ?? null)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
