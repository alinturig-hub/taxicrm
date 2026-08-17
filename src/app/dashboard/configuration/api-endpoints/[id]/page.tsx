import ApiEndpointRecordsViewer from "@/components/configuration/ApiEndpointRecordsViewer";

export default async function ApiEndpointRecordsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <ApiEndpointRecordsViewer
      endpointId={id}
    />
  );
}
