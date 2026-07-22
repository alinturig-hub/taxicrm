"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import ActionButton from "@/components/ui/ActionButton";
import DataTable, {
  type DataTableColumn,
} from "@/components/ui/DataTable";
import KpiCard from "@/components/ui/KpiCard";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import TablePagination from "@/components/ui/TablePagination";
import TableToolbar from "@/components/ui/TableToolbar";
import BookingWorkspace from "@/components/bookings/BookingWorkspace";
import type { BookingWorkspaceData } from "@/components/bookings/types";
import WorkspacePanel, {
  type WorkspaceTab,
} from "@/components/workspace/WorkspacePanel";


type BookingsApiResponse = {
  success: boolean;
  total: number;
  bookings: BookingWorkspaceData[];
  error?: string;
  message?: string;
};

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

export default function BookingsPage() {
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [selectedBooking, setSelectedBooking] =
    useState<BookingWorkspaceData | null>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState("overview");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingsData, setBookingsData] = useState<BookingWorkspaceData[]>([]);



  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/bookings", {
        cache: "no-store",
      });

      const payload =
        (await response.json()) as BookingsApiResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.message ??
            payload.error ??
            "Failed to load bookings.",
        );
      }

      setBookingsData(payload.bookings);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load bookings.",
      );
      setBookingsData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const openBookingWorkspace = (booking: BookingWorkspaceData) => {
    setSelectedBooking(booking);
    setActiveWorkspaceTab("overview");
  };

  const columns = useMemo<DataTableColumn<BookingWorkspaceData>[]>(
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
            {booking.customerName ?? '—'}
          </button>
        ),
        sortValue: (booking) => booking.customerName ?? '—',
        sortable: true,
      },
      {
        id: "phone",
        header: "Phone",
        accessor: (booking) => booking.telephoneNumber ?? '—',
        sortValue: (booking) => booking.telephoneNumber ?? '—',
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
        accessor: (booking) => booking.bookingSource,
        sortValue: (booking) => booking.bookingSource,
        sortable: true,
      },
      {
        id: "payment",
        header: "Payment",
        accessor: (booking) => booking.paymentType,
        sortValue: (booking) => booking.paymentType,
        sortable: true,
      },
      {
        id: "price",
        header: "Price",
        accessor: (booking) => `£${((booking.price ?? 0) ?? 0).toFixed(2)}`,
        sortValue: (booking) => (booking.price ?? 0),
        sortable: true,
        align: "right",
      },
      {
        id: "bookedAt",
        header: "Booked At",
        accessor: (booking) => (booking.bookedAtTime ?? '—'),
        sortValue: (booking) => (booking.bookedAtTime ?? '—'),
        sortable: true,
      },
    ],
    [],
  );

  const activeBookings = bookingsData;

  const bookingStats = useMemo(() => {
    const live = activeBookings.length;

    const waitingDispatch = activeBookings.filter(
      (b) => b.status === "created" || b.status === "on-hold",
    ).length;

    const completed = activeBookings.filter(
      (b) => b.status === "completed",
    );

    const revenueToday = completed.reduce(
      (sum, b) => sum + (b.price ?? 0),
      0,
    );

    const delayed = activeBookings.filter(
      (b) => b.status === "warning",
    ).length;

    return {
      live,
      waitingDispatch,
      revenueToday,
      delayed,
    };
  }, [activeBookings]);


  const filteredBookings = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return activeBookings.filter((booking) => {
      const matchesSearch =
        !normalizedSearch ||
        booking.id.toLowerCase().includes(normalizedSearch) ||
        (booking.customerName ?? '').toLowerCase().includes(normalizedSearch) ||
        (booking.telephoneNumber ?? '').toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" || booking.status === statusFilter;

      const matchesSource =
        sourceFilter === "all" || booking.bookingSource === sourceFilter;

      const matchesPayment =
        paymentFilter === "all" || booking.paymentType === paymentFilter;


  return (
        matchesSearch &&
        matchesStatus &&
        matchesSource &&
        matchesPayment
      );
    });
  }, [activeBookings, paymentFilter, searchValue, sourceFilter, statusFilter]);

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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        Loading bookings...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-500">
        {error}
      </div>
    );
  }

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
            value={bookingStats.live.toString()}
            description="Current operational bookings"
            trend={{ value: "12 today", direction: "up" }}
          />

          <KpiCard
            title="Waiting Dispatch"
            value={bookingStats.waitingDispatch.toString()}
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
            value={`£${bookingStats.revenueToday.toFixed(2)}`}
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
            value={bookingStats.delayed.toString()}
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
            ? `${selectedBooking.customerName ?? 'Unknown Customer'} · ${selectedBooking.bookedAtTime ?? 'Unknown Date'}`
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
          <BookingWorkspace booking={selectedBooking} />
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
                  Created through {(selectedBooking.bookingSource ?? 'Unknown Source')}
                </p>

                <p className="mt-2 text-xs text-slate-600">
                  {(selectedBooking.bookedAtTime ?? '—')}
                </p>
              </div>

              

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
                {selectedBooking.officeNote || "No notes added to this booking."}
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
