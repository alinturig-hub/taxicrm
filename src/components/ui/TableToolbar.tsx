"use client";

import type { ReactNode } from "react";

import ActionButton from "@/components/ui/ActionButton";
import SearchBar from "@/components/ui/SearchBar";

type TableToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  bulkActions?: ReactNode;
  selectedCount?: number;
  onRefresh?: () => void;
  refreshing?: boolean;
  onExport?: () => void;
  exportLabel?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
};

export default function TableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
  bulkActions,
  selectedCount = 0,
  onRefresh,
  refreshing = false,
  onExport,
  exportLabel = "Export",
  primaryAction,
  secondaryActions,
}: TableToolbarProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center">
          <SearchBar
            value={searchValue}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            className="w-full lg:max-w-md"
          />

          {filters ? (
            <div className="flex flex-wrap items-center gap-2">
              {filters}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedCount > 0 && bulkActions ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2">
              <span className="text-xs font-semibold text-blue-300">
                {selectedCount} selected
              </span>

              {bulkActions}
            </div>
          ) : null}

          {secondaryActions}

          {onRefresh ? (
            <ActionButton
              variant="secondary"
              onClick={onRefresh}
              disabled={refreshing}
              icon={refreshing ? "…" : "↻"}
            >
              {refreshing ? "Refreshing" : "Refresh"}
            </ActionButton>
          ) : null}

          {onExport ? (
            <ActionButton
              variant="secondary"
              onClick={onExport}
              icon="↓"
            >
              {exportLabel}
            </ActionButton>
          ) : null}

          {primaryAction}
        </div>
      </div>
    </section>
  );
}
