import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { workspaceAccess } from "@/lib/workspace/access";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export default async function LocalDatasetPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { page?: string };
}) {
  const { access } = await workspaceAccess();
  if (!access.isSuperAdmin && !access.permissions.includes("integrations.view"))
    redirect("/dashboard");
  const requested = Number(searchParams.page || 1);
  const page =
    Number.isSafeInteger(requested) && requested > 0 && requested <= 100
      ? requested
      : 1;
  const dataset = await prisma.apiEndpointConfiguration.findFirst({
    where: { id: params.id, provider: "LOCAL" },
    select: {
      id: true,
      name: true,
      recordKey: true,
      _count: { select: { records: true } },
      records: {
        orderBy: { externalId: "asc" },
        skip: (page - 1) * 50,
        take: 50,
        select: { id: true, externalId: true, data: true },
      },
    },
  });
  if (!dataset) notFound();
  return (
    <div className="space-y-5">
      <Link
        href="/dashboard/integrations/local"
        className="text-sm text-blue-300"
      >
        ← Local integration
      </Link>
      <header>
        <h1 className="text-2xl font-semibold text-white">{dataset.name}</h1>
        <p className="mt-2 text-sm text-slate-400">
          {dataset._count.records} saved records · Key:{" "}
          {dataset.recordKey || "Whole response"}
        </p>
      </header>
      {dataset.records.map((record) => (
        <article
          key={record.id}
          className="rounded-xl border border-slate-800 bg-slate-900 p-4"
        >
          <h2 className="text-sm text-blue-300">{record.externalId}</h2>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs text-slate-300">
            {JSON.stringify(record.data, null, 2)}
          </pre>
        </article>
      ))}
      <div className="flex gap-4 text-sm text-blue-300">
        {page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}
        {page * 50 < dataset._count.records && (
          <Link href={`?page=${page + 1}`}>Next</Link>
        )}
      </div>
    </div>
  );
}
