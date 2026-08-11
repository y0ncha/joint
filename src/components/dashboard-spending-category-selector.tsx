"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DashboardSpendingCategorySelector({
  categories,
  selectedCategoryId,
}: {
  categories: Array<{ id: string; name: string }>;
  selectedCategoryId?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function selectCategory(nextCategoryId: string) {
    const params = new URLSearchParams(searchParams);
    if (nextCategoryId === "all") params.delete("spendingCategory");
    else params.set("spendingCategory", nextCategoryId);
    router.push(`${pathname}?${params}`);
  }

  return (
    <Select value={selectedCategoryId ?? "all"} onValueChange={selectCategory}>
      <SelectTrigger aria-label="Break down spending by category" className="min-h-11 max-w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
