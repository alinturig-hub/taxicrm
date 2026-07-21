"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

export type WorkspaceTab = {
  id: string;
  label: string;
};

type WorkspacePanelProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  status?: ReactNode;
  activeTab: string;
  tabs: WorkspaceTab[];
  onTabChange: (tabId: string) => void;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  widthClassName?: string;
};

export default function WorkspacePanel({
  open,
  title,
  subtitle,
  status,
  activeTab,
  tabs,
  onTabChange,
  onClose,
  children,
  footer,
  widthClassName = "w-full sm:w-[520px] xl:w-[600px]",
}: WorkspacePanelProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label="Close workspace panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={[
          "absolute inset-y-0 right-0 flex max-w-full flex-col",
          "border-l border-slate-800 bg-slate-950 shadow-2xl",
          widthClassName,
        ].join(" ")}
      >
        <header className="border-b border-slate-800 bg-slate-950 px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="truncate text-xl font-bold tracking-tight text-white">
                  {title}
                </h2>

                {status}
              </div>

              {subtitle ? (
                <p className="mt-2 truncate text-sm text-slate-400">
                  {subtitle}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              ✕
            </button>
          </div>
        </header>

        <nav
          className="flex overflow-x-auto border-b border-slate-800 bg-slate-950 px-4 sm:px-6"
          aria-label="Workspace tabs"
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={[
                  "shrink-0 border-b-2 px-4 py-4 text-sm font-semibold transition",
                  active
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-200",
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-6">
          {children}
        </div>

        {footer ? (
          <footer className="border-t border-slate-800 bg-slate-950 px-5 py-4 sm:px-6">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
