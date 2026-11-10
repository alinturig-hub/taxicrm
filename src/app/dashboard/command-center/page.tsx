import { redirect } from "next/navigation";
import { periods, type WorkspacePeriod } from "@/lib/workspace/home/config";
export default function CommandCenter({ searchParams }: {
    searchParams: {
        period?: string;
    };
}) { const p = searchParams.period; redirect("/dashboard/workspace" + (p && periods.includes(p as WorkspacePeriod) ? `?period=${p}` : "")); }
