"use client";
import Link from "next/link";
import { useState } from "react";
export type ConnectionDirectoryItem = { id: string; name: string; initials: string; category: string; status: string; description: string; detail: string; href: string };
export default function IntegrationDirectory({ items }: { items: ConnectionDirectoryItem[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All sources");
  const visible = items.filter(item => (category === "All sources" || item.category === category) && `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="integration-panel">
    <div className="integration-section-head"><div><h2>Data connections</h2><p>Manage how operational data enters your workspace.</p></div><span className="integration-label">{items.length} sources</span></div>
    <div className="integration-directory-tools"><label className="integration-search"><span aria-hidden="true">⌕</span><input aria-label="Search connections" placeholder="Search connections…" value={search} onChange={event => setSearch(event.target.value)} /></label><label className="integration-filter"><span className="sr-only">Connection category</span><select aria-label="Connection category" value={category} onChange={event => setCategory(event.target.value)}>{["All sources", "Dispatch", "Local data"].map(value => <option key={value}>{value}</option>)}</select></label></div>
    <div className="integration-directory">{visible.map(item => <article key={item.id} className="integration-connection-card">
      <div className="integration-card-top"><span className={`integration-provider-icon integration-provider-${item.id}`} aria-hidden="true">{item.initials}</span><span className="integration-badge">{item.status}</span></div>
      <div><p className="integration-eyebrow">{item.category}</p><h3>{item.name}</h3><p className="integration-card-copy">{item.description}</p></div><p className="integration-card-detail">{item.detail}</p><Link href={item.href} className="integration-card-link" aria-label={`Open ${item.name} workspace`}>Open workspace <span aria-hidden="true">↗</span></Link>
    </article>)}</div>
    {!visible.length && <div className="integration-empty"><h3>No matching connections</h3><p>Try a different name or select all sources.</p><button type="button" className="integration-button" onClick={() => { setSearch(""); setCategory("All sources"); }}>Clear filters</button></div>}
  </section>;
}
