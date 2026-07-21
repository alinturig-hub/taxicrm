import type { ReactNode } from "react";

type FilterBarProps = {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export default function FilterBar({
  children,
  actions,
  className = "",
}: FilterBarProps) {
  return (
    <div
      className={[
        "flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4",
        "lg:flex-row lg:items-center lg:justify-between",
        className,
      ].join(" ")}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {children}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
