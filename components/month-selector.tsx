"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export function MonthSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const monthParam = searchParams.get("month");
  const current = monthParam
    ? new Date(monthParam + "-01")
    : new Date();
  const year = current.getFullYear();
  const month = current.getMonth();

  const label = `${year}年${month + 1}月`;

  const navigate = (offset: number) => {
    const d = new Date(year, month + offset, 1);
    const value = d.toLocaleDateString("en-CA", {
      year: "numeric",
      month: "2-digit",
    }).slice(0, 7);
    router.push(`?month=${value}`);
  };

  return (
    <div className="flex items-center gap-4">
      <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
        ◀ 前月
      </Button>
      <span className="font-heading text-xl">{label}</span>
      <Button variant="outline" size="sm" onClick={() => navigate(1)}>
        翌月 ▶
      </Button>
    </div>
  );
}
