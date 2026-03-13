"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { User } from "@/lib/types";

interface Props {
  users: User[];
}

export function AdminUserFilter({ users }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (value: string | null) => {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("user");
    } else {
      params.set("user", value);
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <Select
      defaultValue={searchParams.get("user") ?? "all"}
      onValueChange={handleChange}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="ユーザーを選択" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">全員</SelectItem>
        {users.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            {user.display_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
