import { redirect } from "next/navigation";

export default function AddWebhookPage() {
  redirect("/dashboard/integrations/autocab/webhooks/new");
}
