"use client";

import { useMemo, useState } from "react";

import ActionButton from "@/components/ui/ActionButton";
import DataTable, {
  type DataTableColumn,
} from "@/components/ui/DataTable";
import KpiCard from "@/components/ui/KpiCard";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import TablePagination from "@/components/ui/TablePagination";
import TableToolbar from "@/components/ui/TableToolbar";
import WorkspacePanel, {
  type WorkspaceTab,
} from "@/components/workspace/WorkspacePanel";

type BookingStatus =
  | "created"
  | "on-hold"
  | "dispatched"
  | "accepted"
  | "arrived"
  | "on-board"
  | "completed"
  | "cancelled"
  | "rejected"
  | "no-show";

type Booking = {
  id: string;
  customer: string;
  phone: string;
  status: BookingStatus;
  source: string;
  payment: string;
  price: number;
  bookedAt: string;
  pickup: string;
  destination: string;
  driver: string | null;
  vehicle: string | null;
  passengers: number;
  notes: string;
};

const bookings: Booking[] = [
  {
    id: "13082246",
    customer: "David",
    phone: "+447840403660",
    status: "dispatched",
    source: "Operator Web",
    payment: "Cash",
    price: 13.2,
    bookedAt: "21 Jul 2026, 10:01",
    pickup: "Plymouth Railway Station",
    destination: "Crownhill, Plymouth",
    driver: "Michael Turner",
    vehicle: "Toyota Prius · WR59 HGF",
    passengers: 2,
    notes: "Customer requested a call when the driver arrives.",
  },
  {
    id: "13082245",
    customer: "Lane Peter",
    phone: "+447984867655",
    status: "dispatched",
    source: "Operator Web",
    payment: "Account",
    price: 10.2,
    bookedAt: "21 Jul 2026, 10:00",
    pickup: "Derriford Hospital",
    destination: "Plymouth City Centre",
    driver: "James Wilson",
    vehicle: "Mercedes V-Class · SE13 TEA",
    passengers: 1,
    notes: "Corporate account booking.",
  },
  {
    id: "13082243",
    customer: "Shirley",
    phone: "+447749685431",
    status: "dispatched",
    source: "Operator Web",
    payment: "Cash",
    price: 6.8,
    bookedAt: "21 Jul 2026, 09:59",
    pickup: "Mutley Plain",
    destination: "Drake Circus",
    driver: "Robert Evans",
    vehicle: "Ford Galaxy · LK72 ABC",
    passengers: 1,
    notes: "",
  },
  {
    id: "13082242",
    customer: "Iola Nelson",
    phone: "+447977533621",
    status: "created",
    source: "Operator Web",
    payment: "Account",
    price: 7.2,
    bookedAt: "21 Jul 2026, 09:58",
    pickup: "Plymstock",
    destination: "Plymouth Hoe",
    driver: null,
    vehicle: null,
    passengers: 2,
    notes: "Waiting for driver allocation.",
  },
  {
    id: "13082241",
    customer: "Iola Nelson",
    phone: "+447977533621",
    status: "created",
    source: "Operator Web",
    payment: "Account",
    price: 6.5,
    bookedAt: "21 Jul 2026, 09:58",
    pickup: "Plymouth Hoe",
    destination: "Royal William Yard",
    driver: null,
    vehicle: null,
    passengers: 2,
    notes: "Return journey.",
  },
  {
    id: "13082240",
    customer: "Mrs Elliot",
    phone: "+447864274259",
    status: "created",
    source: "Mobile App",
    payment: "Cash",
    price: 13.5,
    bookedAt: "21 Jul 2026, 09:57",
    pickup: "Plymouth Airport",
    destination: "Barbican, Plymouth",
    driver: null,
    vehicle: null,
    passengers: 3,
    notes: "Customer has two large suitcases.",
  },
  {
    id: "13082239",
    customer: "Liam",
    phone: "+447885605338",
    status: "created",
    source: "Operator Web",
    payment: "Cash",
    price: 7.9,
    bookedAt: "21 Jul 2026, 09:57",
    pickup: "North Hill",
    destination: "Plymouth Railway Station",
    driver: null,
    vehicle: null,
    passengers: 1,
    notes: "",
  },
  {
    id: "13082238",
    customer: "Georgina Midwinter",
    phone: "+447540855379",
    status: "created",
    source: "Operator Web",
    payment: "Account",
    price: 9.57,
    bookedAt: "21 Jul 2026, 09:57",
    pickup: "Devonport",
    destination: "Derriford Hospital",
    driver: null,
    vehicle: null,
    passengers: 1,
    notes: "Hospital appointment.",
  },
  {
    id: "13082237",
    customer: "Grace Levine",
    phone: "+447858826402",
    status: "dispatched",
    source: "Mobile App",
    payment: "Cash",
    price: 12.9,
    bookedAt: "21 Jul 2026, 09:56",
    pickup: "Royal William Yard",
    destination: "Derriford Hospital",
    driver: "Daniel Brown",
    vehicle: "Toyota Prius · PL21 TAX",
    passengers: 2,
    notes: "",
  },
  {
    id: "13082236",
    customer: "Georgina",
    phone: "+447493240470",
    status: "created",
    source: "Operator Web",
    payment: "Cash",
    price: 6,
    bookedAt: "21 Jul 2026, 09:56",
    pickup: "Stonehouse",
    destination: "Barbican",
    driver: null,
    vehicle: null,
    passengers: 1,
    notes: "",
  },
  {
    id: "13082235",
    customer: "Chelsea Batt",
    phone: "+447513643663",
    status: "cancelled",
    source: "Mobile App",
    payment: "Cash",
    price: 11,
    bookedAt: "21 Jul 2026, 09:55",
    pickup: "Plympton",
    destination: "Plymouth City Centre",
    driver: null,
    vehicle: null,
    passengers: 2,
    notes: "Cancelled by customer.",
  },
  {
    id: "13082234",
    customer: "Richard Babcock",
    phone: "+44752305782",
    status: "created",
    source: "Operator Web",
    payment: "Account",
    price: 10.8,
    bookedAt: "21 Jul 2026, 09:55",
    pickup: "Saltash",
    destination: "Plymouth Railway Station",
    driver: null,
    vehicle: null,
    passengers: 1,
    notes: "Priority corporate customer.",
  },
];

const workspaceTabs: WorkspaceTab[] = [
  {
    id: "overview",
    label: "Overview",
  },
  {
    id: "timeline",
    label: "Timeline",
  },
  {
    id: "notes",
    label: "Notes",
  },
];

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-sm font-medium text-slate-200">
        {value}
      </p>
    </div>
  );
}

export default function BookingsPage() {
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [selectedBooking, setSelectedBooking] =
    useState<Booking | null>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState("overview");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshing, setRefreshing] = useState(false);

  const openBookingWorkspace = (booking: Booking) => {
    setSelectedBooking(booking);
    setActiveWorkspaceTab("overview");
  };

  const columns = useMemo<DataTableColumn<Booking>[]>(
    () => [
      {
        id: "id",
        header: "Booking ID",
        accessor: (booking) => (
          <button
            type="button"
            onClick={() => openBookingWorkspace(booking)}
            className="font-semibold text-blue-400 transition hover:text-blue-300 hover:underline"
          >
            {booking.id}
          </button>
        ),
        sortValue: (booking) => booking.id,
        sortable: true,
        hideable: false,
      },
      {
        id: "customer",
        header: "Customer",
        accessor: (booking) => (
          <button
            type="button"
            onClick={() => openBookingWorkspace(booking)}
            className="text-left font-medium text-slate-200 transition hover:text-white"
          >
            {booking.customer}
          </button>
        ),
        sortValue: (booking) => booking.customer,
        sortable: true,
      },
      {
        id: "phone",
        header: "Phone",
        accessor: (booking) => booking.phone,
        sortValue: (booking) => booking.phone,
        sortable: true,
      },
      {
        id: "status",
        header: "Status",
        accessor: (booking) => (
          <StatusBadge status={booking.status} />
        ),
        sortValue: (booking) => booking.status,
        sortable: true,
      },
      {
        id: "source",
        header: "Source",
        accessor: (booking) => booking.source,
        sortValue: (booking) => booking.source,
        sortable: true,
      },
      {
        id: "payment",
        header: "Payment",
        accessor: (booking) => booking.payment,
        sortValue: (booking) => booking.payment,
        sortable: true,
      },
      {
        id: "price",
        header: "Price",
        accessor: (booking) => `£${booking.price.toFixed(2)}`,
        sortValue: (booking) => booking.price,
        sortable: true,
        align: "right",
      },
      {
        id: "bookedAt",
        header: "Booked At",
        accessor: (booking) => booking.bookedAt,
        sortValue: (booking) => booking.bookedAt,
        sortable: true,
      },
    ],
    [],
  );

  const filteredBookings = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return bookings.filter((booking) => {
      const matchesSearch =
        !normalizedSearch ||
        booking.id.toLowerCase().includes(normalizedSearch) ||
        booking.customer.toLowerCase().includes(normalizedSearch) ||
        booking.phone.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" || booking.status === statusFilter;

      const matchesSource =
        sourceFilter === "all" || booking.source === sourceFilter;

      const matchesPayment =
        paymentFilter === "all" || booking.payment === paymentFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSource &&
        matchesPayment
      );
    });
  }, [paymentFilter, searchValue, sourceFilter, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredBookings.length / pageSize),
  );

  const paginatedBookings = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;

    return filteredBookings.slice(start, start + pageSize);
  }, [filteredBookings, page, pageSize, totalPages]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setRefreshing(false);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
  };

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Bookings"
          description="Monitor live bookings, status changes and operational activity from Autocab."
          actions={
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Live
              </div>

              <ActionButton icon="+">
                New Booking
              </ActionButton>
            </div>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <KpiCard
            title="Live Bookings"
            value="248"
            description="Current operational bookings"
            trend={{ value: "12 today", direction: "up" }}
          />

          <KpiCard
            title="Waiting Dispatch"
            value="18"
            description="Bookings waiting for allocation"
            trend={{ value: "3 urgent", direction: "down" }}
          />

          <KpiCard
            title="Drivers Online"
            value="64"
            description="Available and working"
            trend={{ value: "6 more", direction: "up" }}
          />

          <KpiCard
            title="Revenue Today"
            value="£8,420"
            description="Completed booking revenue"
            trend={{ value: "8.4%", direction: "up" }}
          />

          <KpiCard
            title="Average Wait"
            value="6m 42s"
            description="Current passenger waiting time"
            trend={{ value: "38s", direction: "down" }}
          />

          <KpiCard
            title="Jobs Delayed"
            value="7"
            description="Bookings outside target"
            trend={{ value: "2 fewer", direction: "up" }}
          />
        </div>

        <TableToolbar
          searchValue={searchValue}
          onSearchChange={(value) => {
            setSearchValue(value);
            setPage(1);
          }}
          searchPlaceholder="Search booking ID, customer or phone..."
          selectedCount={selectedRowIds.length}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onExport={() => undefined}
          filters={
            <>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                className="h-11 rounded-xl border border-slate-800 bg-slate-950 px-4 text-sm text-slate-300 outline-none transition focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="created">Created</option>
                <option value="on-hold">On Hold</option>
                <option value="dispatched">Dispatched</option>
                <option value="accepted">Accepted</option>
                <option value="arrived">Arrived</option>
                <option value="on-board">Passenger On Board</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="rejected">Rejected</option>
                <option value="no-show">No Show</option>
              </select>

              <select
                value={sourceFilter}
                onChange={(event) => {
                  setSourceFilter(event.target.value);
                  setPage(1);
                }}
                className="h-11 rounded-xl border border-slate-800 bg-slate-950 px-4 text-sm text-slate-300 outline-none transition focus:border-blue-500"
              >
                <option value="all">All Sources</option>
                <option value="Operator Web">Operator Web</option>
                <option value="Mobile App">Mobile App</option>
              </select>

              <select
                value={paymentFilter}
                onChange={(event) => {
                  setPaymentFilter(event.target.value);
                  setPage(1);
                }}
                className="h-11 rounded-xl border border-slate-800 bg-slate-950 px-4 text-sm text-slate-300 outline-none transition focus:border-blue-500"
              >
                <option value="all">All Payments</option>
                <option value="Cash">Cash</option>
                <option value="Account">Account</option>
              </select>
            </>
          }
        />

        <DataTable
          data={paginatedBookings}
          columns={columns}
          getRowId={(booking) => booking.id}
          selectable
          selectedRowIds={selectedRowIds}
          onSelectedRowIdsChange={setSelectedRowIds}
          emptyTitle="No bookings found"
          emptyDescription="Try changing the search term or active filters."
          rowActions={(booking) => (
            <ActionButton
              variant="ghost"
              size="sm"
              aria-label={`View booking ${booking.id}`}
              onClick={() => openBookingWorkspace(booking)}
            >
              View
            </ActionButton>
          )}
        />

        <TablePagination
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredBookings.length}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>

      <WorkspacePanel
        open={selectedBooking !== null}
        title={
          selectedBooking
            ? `Booking #${selectedBooking.id}`
            : "Booking"
        }
        subtitle={
          selectedBooking
            ? `${selectedBooking.customer} · ${selectedBooking.bookedAt}`
            : undefined
        }
        status={
          selectedBooking ? (
            <StatusBadge status={selectedBooking.status} />
          ) : undefined
        }
        tabs={workspaceTabs}
        activeTab={activeWorkspaceTab}
        onTabChange={setActiveWorkspaceTab}
        onClose={() => setSelectedBooking(null)}
        footer={
          selectedBooking ? (
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <ActionButton
                variant="ghost"
                onClick={() => setSelectedBooking(null)}
              >
                Close
              </ActionButton>

              <ActionButton>
                Open Full Booking
              </ActionButton>
            </div>
          ) : null
        }
      >
        {selectedBooking && activeWorkspaceTab === "overview" ? (
          <div className="space-y-6">
            <section>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400">
                Journey
              </h3>

              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex gap-3">
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-emerald-400" />

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Pickup
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-200">
                        {selectedBooking.pickup}
                      </p>
                    </div>
                  </div>

                  <div className="ml-[5px] my-2 h-8 w-px bg-slate-700" />

                  <div className="flex gap-3">
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-blue-400" />

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Destination
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-200">
                        {selectedBooking.destination}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400">
                Booking Details
              </h3>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <DetailItem
                  label="Customer"
                  value={selectedBooking.customer}
                />

                <DetailItem
                  label="Phone"
                  value={selectedBooking.phone}
                />

                <DetailItem
                  label="Payment"
                  value={selectedBooking.payment}
                />

                <DetailItem
                  label="Price"
                  value={`£${selectedBooking.price.toFixed(2)}`}
                />

                <DetailItem
                  label="Source"
                  value={selectedBooking.source}
                />

                <DetailItem
                  label="Passengers"
                  value={String(selectedBooking.passengers)}
                />
              </div>
            </section>

            <section>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400">
                Allocation
              </h3>

              <div className="mt-3 grid gap-3">
                <DetailItem
                  label="Driver"
                  value={selectedBooking.driver ?? "Not allocated"}
                />

                <DetailItem
                  label="Vehicle"
                  value={selectedBooking.vehicle ?? "Not allocated"}
                />
              </div>
            </section>
          </div>
        ) : null}

        {selectedBooking && activeWorkspaceTab === "timeline" ? (
          <div className="space-y-6">
            <div className="relative pl-8">
              <div className="absolute bottom-0 left-[7px] top-2 w-px bg-slate-800" />

              <div className="relative pb-8">
                <span className="absolute -left-8 top-1 h-4 w-4 rounded-full border-4 border-slate-950 bg-blue-500" />

                <p className="text-sm font-semibold text-white">
                  Booking created
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Created through {selectedBooking.source}
                </p>

                <p className="mt-2 text-xs text-slate-600">
                  {selectedBooking.bookedAt}
                </p>
              </div>

              {selectedBooking.driver ? (
                <div className="relative pb-8">
                  <span className="absolute -left-8 top-1 h-4 w-4 rounded-full border-4 border-slate-950 bg-amber-500" />

                  <p className="text-sm font-semibold text-white">
                    Driver allocated
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    {selectedBooking.driver}
                  </p>

                  <p className="mt-2 text-xs text-slate-600">
                    Awaiting live Autocab event
                  </p>
                </div>
              ) : null}

              <div className="relative">
                <span className="absolute -left-8 top-1 h-4 w-4 rounded-full border-4 border-slate-950 bg-slate-600" />

                <p className="text-sm font-semibold text-white">
                  Current status
                </p>

                <div className="mt-2">
                  <StatusBadge status={selectedBooking.status} />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {selectedBooking && activeWorkspaceTab === "notes" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <p className="text-sm leading-6 text-slate-300">
                {selectedBooking.notes || "No notes added to this booking."}
              </p>
            </div>

            <textarea
              rows={5}
              placeholder="Add an operational note..."
              className="w-full resize-none rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
            />

            <div className="flex justify-end">
              <ActionButton>
                Add Note
              </ActionButton>
            </div>
          </div>
        ) : null}
      </WorkspacePanel>
    </>
  );
}
