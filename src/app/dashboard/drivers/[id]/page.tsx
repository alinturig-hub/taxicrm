import DriverProfile from "@/components/drivers/DriverProfile";

export const dynamic = "force-dynamic";

export default function DriverProfilePage({
  params,
}: {
  params: {
    id: string;
  };
}) {
  return <DriverProfile driverId={params.id} />;
}
