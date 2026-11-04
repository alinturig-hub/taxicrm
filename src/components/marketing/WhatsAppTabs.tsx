"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export default function WhatsAppTabs({ tabs }: { tabs: { label: string; href: string }[] }) {
  const pathname = usePathname();
  return <nav aria-label="WhatsApp" className="flex flex-wrap gap-2">{tabs.map(tab => <Link key={tab.href} href={tab.href} aria-current={pathname === tab.href ? "page" : undefined} className={`rounded-lg border border-app-border px-4 py-2 ${pathname === tab.href ? "bg-teal-700 text-white" : "bg-surface text-app-primary"}`}>{tab.label}</Link>)}</nav>;
}
