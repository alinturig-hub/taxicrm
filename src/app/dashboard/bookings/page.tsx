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
  },
];

const columns: DataTableColumn<Booking>[] = [
  {
    id: "id",
    header: "Booking ID",
    accessor: (booking) => (
      <span className="font-semibold text-white">{booking.id}</span>
    ),
    sortValue: (booking) => booking.id,
    sortable: true,
    hideable: false,
  },
  {
    id: "customer",
    header: "Customer",
    accessor: (booking) => booking.customer,
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
];

export default function BookingsPage() {
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshing, setRefreshing] = useState(false);

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
        bulkActions={
          <ActionButton variant="ghost" size="sm">
            Bulk Actions
          </ActionButton>
        }
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
  );
}
