"use client";
import { useCallback, useState } from "react";
import CustomerPredictionsDashboard from "@/components/customers/CustomerPredictionsDashboard";
import CustomerProfileDrawer from "@/components/customers/CustomerProfileDrawer";
export default function CustomerOpportunities() {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const close = useCallback(() => setCustomerId(null), []);
  return (
    <>
      <CustomerPredictionsDashboard onOpenCustomer={setCustomerId} />
      {customerId && (
        <CustomerProfileDrawer customerId={customerId} onClose={close} />
      )}
    </>
  );
}
