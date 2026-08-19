"use client";

import { formatDateTime } from "@/lib/date";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

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

type RejectionRankingEntry = {
  rank: number;
  driverId: string;
  callsign: string | null;
  driverName: string;
  rejectedJobs: number;
  estimatedLostRevenue: number;
};

type RejectionRankingResponse = {
  success: boolean;
  totalRejections: number;
  attributedRejections: number;
  attributionPercent: number;
  ranking: RejectionRankingEntry[];
  error?: string;
  message?: string;
};

type BookingDetailsApiResponse = {
  success: boolean;
  booking?: BookingWorkspaceData;
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
  const pathname = usePathname();
  const [bookingView, setBookingView] = useState<
    "live" | "history" | "exceptions" | "saved"
  >("live");
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cardFilter, setCardFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
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
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [rejectionRanking, setRejectionRanking] =
    useState<RejectionRankingResponse | null>(null);
  const [rejectionRankingLoading, setRejectionRankingLoading] =
    useState(false);
  const [rejectionRankingError, setRejectionRankingError] =
    useState<string | null>(null);

  const buildBookingsUrl = useCallback(() => {
    const params = new URLSearchParams();

    if (fromDate) {
      params.set("from", fromDate);
    }

    if (toDate) {
      params.set("to", toDate);
    }

    const query = params.toString();

    return query
      ? `/api/bookings?${query}`
      : "/api/bookings";
  }, [fromDate, toDate]);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(buildBookingsUrl(), {
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
  }, [buildBookingsUrl]);

  useEffect(() => {
    if (bookingView !== "exceptions") {
      return;
    }

    let cancelled = false;

    const loadRejectionRanking = async () => {
      setRejectionRankingLoading(true);
      setRejectionRankingError(null);

      try {
        const params = new URLSearchParams();

        if (fromDate) {
          params.set("from", fromDate);
        }

        if (toDate) {
          params.set("to", toDate);
        }

        const query = params.toString();

        const response = await fetch(
          query
            ? `/api/bookings/rejections/ranking?${query}`
            : "/api/bookings/rejections/ranking",
          {
            cache: "no-store",
          },
        );

        const payload =
          (await response.json()) as RejectionRankingResponse;

        if (!response.ok || !payload.success) {
          throw new Error(
            payload.message ??
              payload.error ??
              "Failed to load rejection ranking.",
          );
        }

        if (!cancelled) {
          setRejectionRanking(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setRejectionRanking(null);
          setRejectionRankingError(
            error instanceof Error
              ? error.message
              : "Failed to load rejection ranking.",
          );
        }
      } finally {
        if (!cancelled) {
          setRejectionRankingLoading(false);
        }
      }
    };

    void loadRejectionRanking();

    return () => {
      cancelled = true;
    };
  }, [bookingView, fromDate, toDate]);

  useEffect(() => {
    setPage(1);
    void loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let refreshTimer: number | null = null;

    const refreshSilently = async () => {
      try {
        const response = await fetch(buildBookingsUrl(), {
          cache: "no-store",
        });

        const payload =
          (await response.json()) as BookingsApiResponse;

        if (
          response.ok &&
          payload.success
        ) {
          setBookingsData(payload.bookings);
        }
      } catch {
        // Keep the currently displayed data if a realtime refresh fails.
      }
    };

    const scheduleRefresh = () => {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        void refreshSilently();
        refreshTimer = null;
      }, 300);
    };

    const protocol =
      window.location.protocol === "https:"
        ? "wss:"
        : "ws:";

    try {
      socket = new WebSocket(
        `${protocol}//${window.location.host}/ws/fleet`,
      );

      socket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(
            String(event.data),
          ) as {
            type?: string;
          };

          if (
            message.type ===
            "dashboard.metrics.updated"
          ) {
            scheduleRefresh();
          }
        } catch {
          // Ignore malformed realtime messages.
        }
      });
    } catch {
      socket = null;
    }

    const fallbackInterval =
      window.setInterval(() => {
        void refreshSilently();
      }, 30_000);

    return () => {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }

      window.clearInterval(
        fallbackInterval,
      );

      socket?.close();
    };
  }, [buildBookingsUrl]);

  useEffect(() => {
    const routeStatus = pathname.split("/").filter(Boolean).at(-1);

    const validStatuses = new Set([
      "created",
      "on-hold",
      "dispatched",
      "accepted",
      "arrived",
      "on-board",
      "completed",
      "cancelled",
      "rejected",
      "no-show",
    ]);

    if (routeStatus && validStatuses.has(routeStatus)) {
      setStatusFilter(routeStatus);
      setPage(1);
      return;
    }

    setStatusFilter("all");
  }, [pathname]);

  const openBookingWorkspace = async (
    booking: BookingWorkspaceData | string,
  ) => {
    const bookingId =
      typeof booking === "string" ? booking : booking.id;

    if (typeof booking !== "string") {
      setSelectedBooking(booking);
    }

    setActiveWorkspaceTab("overview");
    setWorkspaceLoading(true);
    setWorkspaceError(null);

    try {
      const response = await fetch(
        `/api/bookings/${encodeURIComponent(bookingId)}`,
        {
          cache: "no-store",
        },
      );

      const payload =
        (await response.json()) as BookingDetailsApiResponse;

      if (!response.ok || !payload.success || !payload.booking) {
        throw new Error(
          payload.message ??
            payload.error ??
            "Failed to load booking details.",
        );
      }

      setSelectedBooking(payload.booking);
    } catch (err) {
      setWorkspaceError(
        err instanceof Error
          ? err.message
          : "Failed to load booking details.",
      );
    } finally {
      setWorkspaceLoading(false);
    }
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
            {booking.externalId}
          </button>
        ),
        sortValue: (booking) => booking.externalId,
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
        id: "journey",
        header: "Journey",
        accessor: (booking) => (
          <div className="max-w-[320px] space-y-1">
            <p className="truncate text-sm font-medium text-slate-200">
              {booking.pickup?.address ?? "Pickup unavailable"}
            </p>
            <p className="truncate text-xs text-slate-500">
              → {booking.destination?.address ?? "Destination unavailable"}
            </p>
          </div>
        ),
        sortValue: (booking) => booking.pickup?.address ?? "",
        sortable: true,
      },
      {
        id: "driver",
        header: "Driver",
        accessor: (booking) => {
          const fullName = [
            booking.driverForename,
            booking.driverSurname,
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-200">
                {booking.driverCallSign
                  ? `#${booking.driverCallSign}`
                  : "Unassigned"}
              </p>
              {fullName ? (
                <p className="text-xs text-slate-500">
                  {fullName}
                </p>
              ) : null}
            </div>
          );
        },
        sortValue: (booking) =>
          booking.driverCallSign ??
          booking.driverSurname ??
          "",
        sortable: true,
      },
      {
        id: "vehicle",
        header: "Vehicle",
        accessor: (booking) => (
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-200">
              {booking.vehicleCallSign
                ? `#${booking.vehicleCallSign}`
                : "Unassigned"}
            </p>
            {booking.vehicleRegistration ? (
              <p className="text-xs text-slate-500">
                {booking.vehicleRegistration}
              </p>
            ) : null}
          </div>
        ),
        sortValue: (booking) =>
          booking.vehicleCallSign ??
          booking.vehicleRegistration ??
          "",
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
        accessor: (booking) => `£${Number(booking.price ?? 0).toFixed(2)}`,
        sortValue: (booking) => (booking.price ?? 0),
        sortable: true,
        align: "right",
      },
      {
        id: "bookedAt",
        header: "Booked At",
        accessor: (booking) => formatDateTime(booking.bookedAtTime),
        sortValue: (booking) => (booking.bookedAtTime ?? ''),
        sortable: true,
      },
    ],
    [],
  );

  const activeBookings = bookingsData;



  const bookingStats = useMemo(() => {
    const now = new Date();

    const terminalStatuses = new Set([
      "COMPLETED",
      "CANCELLED",
      "REJECTED",
      "NO_FARE",
    ]);

    const live = activeBookings.filter(
      (booking) =>
        !terminalStatuses.has(booking.status.toUpperCase()),
    ).length;

    const waitingDispatch = activeBookings.filter((booking) => {
      const status = booking.status.toUpperCase();

      return status === "CREATED" || status === "ACTIVE";
    }).length;

    const countStatus = (targetStatus: string) =>
      activeBookings.filter(
        (booking) =>
          booking.status.toUpperCase() === targetStatus,
      ).length;

    const dispatched = countStatus("DISPATCHED");
    const accepted = countStatus("ACCEPTED");
    const arrived = countStatus("ARRIVED");
    const passengerOnBoard = countStatus("POB");

    const completedToday = activeBookings.filter(
      (booking) => booking.status.toUpperCase() === "COMPLETED",
    );

    const cancelledBookings = activeBookings.filter(
      (booking) => booking.status.toUpperCase() === "CANCELLED",
    );

    const noFareBookings = activeBookings.filter(
      (booking) => booking.status.toUpperCase() === "NO_FARE",
    );

    const getEstimatedRevenue = (
      booking: BookingWorkspaceData,
    ) => {
      const candidates = [
        booking.price,
        booking.estimatedPrice,
        booking.fare,
      ];

      for (const candidate of candidates) {
        const numericValue = Number(candidate);

        if (
          Number.isFinite(numericValue) &&
          numericValue > 0
        ) {
          return numericValue;
        }
      }

      return 0;
    };

    const cancelledLostRevenue = cancelledBookings.reduce(
      (sum, booking) => sum + getEstimatedRevenue(booking),
      0,
    );

    const noFareLostRevenue = noFareBookings.reduce(
      (sum, booking) => sum + getEstimatedRevenue(booking),
      0,
    );

    const cancelledToday = cancelledBookings.length;
    const noFareToday = noFareBookings.length;

    const revenueToday = completedToday.reduce(
      (sum, booking) => {
        const value =
          booking.price ??
          booking.fare ??
          0;

        const numericValue = Number(value);

        return (
          sum +
          (Number.isFinite(numericValue)
            ? numericValue
            : 0)
        );
      },
      0,
    );

    const averageJobValue =
      completedToday.length > 0
        ? revenueToday / completedToday.length
        : 0;

    const delayed = activeBookings.filter((booking) => {
      const status = booking.status.toUpperCase();

      if (
        terminalStatuses.has(status) ||
        !booking.pickupDueTime
      ) {
        return false;
      }

      return new Date(booking.pickupDueTime).getTime() < now.getTime();
    }).length;

    const atRisk = activeBookings.filter((booking) => {
      const status = booking.status.toUpperCase();

      if (
        status !== "CREATED" &&
        status !== "ACTIVE"
      ) {
        return false;
      }

      if (!booking.pickupDueTime) {
        return false;
      }

      const minutesUntilPickup =
        (new Date(booking.pickupDueTime).getTime() -
          now.getTime()) /
        60_000;

      return (
        minutesUntilPickup >= 0 &&
        minutesUntilPickup <= 15
      );
    }).length;

    return {
      live,
      waitingDispatch,
      dispatched,
      accepted,
      arrived,
      passengerOnBoard,
      runningLate: delayed,
      atRisk,
      completedToday: completedToday.length,
      cancelledToday,
      noFareToday,
      cancelledLostRevenue,
      noFareLostRevenue,
      revenueToday,
      averageJobValue,
      delayed,
    };
  }, [activeBookings]);


  const sourceOptions = useMemo(() => {
    return [
      "all",
      ...Array.from(
        new Set(
          activeBookings
            .map((booking) => booking.bookingSource)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    ];
  }, [activeBookings]);

  const paymentOptions = useMemo(() => {
    return [
      "all",
      ...Array.from(
        new Set(
          activeBookings
            .map((booking) => booking.paymentType)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    ];
  }, [activeBookings]);


  const applyCardFilter = (filter: string) => {
    setStatusFilter("all");
    setCardFilter((current) =>
      current === filter ? "all" : filter,
    );
    setPage(1);
  };

  const filteredBookings = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    const statusPriority: Record<string, number> = {
      CREATED: 1,
      DISPATCHED: 2,
      ACCEPTED: 3,
      ARRIVED: 4,
      POB: 5,
      COMPLETED: 6,
      CANCELLED: 7,
      REJECTED: 8,
      NO_FARE: 9,
    };

    return activeBookings
      .filter((booking) => {
        const matchesSearch =
          !normalizedSearch ||
          booking.externalId.toLowerCase().includes(normalizedSearch) ||
          (booking.customerName ?? "")
            .toLowerCase()
            .includes(normalizedSearch) ||
          (booking.telephoneNumber ?? "")
            .toLowerCase()
            .includes(normalizedSearch) ||
          (booking.driverCallSign ?? "")
            .toLowerCase()
            .includes(normalizedSearch) ||
          (booking.driverForename ?? "")
            .toLowerCase()
            .includes(normalizedSearch) ||
          (booking.driverSurname ?? "")
            .toLowerCase()
            .includes(normalizedSearch) ||
          (booking.vehicleCallSign ?? "")
            .toLowerCase()
            .includes(normalizedSearch) ||
          (booking.vehicleRegistration ?? "")
            .toLowerCase()
            .includes(normalizedSearch);

        const normalizedStatus = booking.status.toUpperCase();

        const matchesStatus =
          statusFilter === "all" ||
          normalizedStatus === statusFilter.toUpperCase();

        const pickupDueTime = booking.pickupDueTime
          ? new Date(booking.pickupDueTime).getTime()
          : null;

        const now = Date.now();

        const matchesCardFilter = (() => {
          if (cardFilter === "all") {
            return true;
          }

          if (cardFilter === "WAITING_DISPATCH") {
            return (
              normalizedStatus === "CREATED" ||
              normalizedStatus === "ACTIVE"
            );
          }

          if (cardFilter === "RUNNING_LATE") {
            return (
              ![
                "COMPLETED",
                "CANCELLED",
                "REJECTED",
                "NO_FARE",
              ].includes(normalizedStatus) &&
              pickupDueTime !== null &&
              pickupDueTime < now
            );
          }

          if (cardFilter === "AT_RISK") {
            if (
              normalizedStatus !== "CREATED" &&
              normalizedStatus !== "ACTIVE"
            ) {
              return false;
            }

            if (pickupDueTime === null) {
              return false;
            }

            const minutesUntilPickup =
              (pickupDueTime - now) / 60_000;

            return (
              minutesUntilPickup >= 0 &&
              minutesUntilPickup <= 15
            );
          }

          return normalizedStatus === cardFilter;
        })();

        const matchesSource =
          sourceFilter === "all" ||
          booking.bookingSource === sourceFilter;

        const matchesPayment =
          paymentFilter === "all" ||
          booking.paymentType === paymentFilter;

        const bookingDate = booking.bookedAtTime
          ? new Date(booking.bookedAtTime)
          : null;

        const fromBoundary = fromDate
          ? new Date(`${fromDate}T00:00:00`)
          : null;

        const toBoundary = toDate
          ? new Date(`${toDate}T23:59:59.999`)
          : null;

        const matchesFrom =
          !fromBoundary ||
          (bookingDate !== null && bookingDate >= fromBoundary);

        const matchesTo =
          !toBoundary ||
          (bookingDate !== null && bookingDate <= toBoundary);

        return (
          matchesSearch &&
          matchesStatus &&
          matchesCardFilter &&
          matchesSource &&
          matchesPayment &&
          matchesFrom &&
          matchesTo
        );
      })
      .sort((firstBooking, secondBooking) => {
        const firstStatus = firstBooking.status.toUpperCase();
        const secondStatus = secondBooking.status.toUpperCase();

        const priorityDifference =
          (statusPriority[firstStatus] ?? 999) -
          (statusPriority[secondStatus] ?? 999);

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        const firstTime = firstBooking.bookedAtTime
          ? new Date(firstBooking.bookedAtTime).getTime()
          : 0;

        const secondTime = secondBooking.bookedAtTime
          ? new Date(secondBooking.bookedAtTime).getTime()
          : 0;

        return secondTime - firstTime;
      });
  }, [
    activeBookings,
    cardFilter,
    fromDate,
    paymentFilter,
    searchValue,
    sourceFilter,
    statusFilter,
    toDate,
  ]);

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

    try {
      await loadBookings();
    } finally {
      setRefreshing(false);
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchValue("");
    setFromDate("");
    setToDate("");
    setStatusFilter("all");
    setCardFilter("all");
    setSourceFilter("all");
    setPaymentFilter("all");
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

            </div>
          }
        />

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-2">
          {[
            { id: "live", label: "Live Operations" },
            { id: "history", label: "Booking History" },
            { id: "exceptions", label: "Exceptions" },
            { id: "saved", label: "Saved Views" },
          ].map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => {
                setBookingView(
                  view.id as
                    | "live"
                    | "history"
                    | "exceptions"
                    | "saved",
                );
                setStatusFilter("all");
                setCardFilter("all");

                if (view.id === "live") {
                  setFromDate("");
                  setToDate("");
                  setSourceFilter("all");
                  setPaymentFilter("all");
                }

                setPage(1);
              }}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                bookingView === view.id
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>

        {bookingView === "live" ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Waiting Dispatch"
              onClick={() => applyCardFilter("WAITING_DISPATCH")}
              active={cardFilter === "WAITING_DISPATCH"}
              value={bookingStats.waitingDispatch.toString()}
              description="Created or active bookings"
            />
            <KpiCard
              title="Dispatched"
              onClick={() => applyCardFilter("DISPATCHED")}
              active={cardFilter === "DISPATCHED"}
              value={bookingStats.dispatched.toString()}
              description="Sent to a driver"
            />
            <KpiCard
              title="Driver Accepted"
              onClick={() => applyCardFilter("ACCEPTED")}
              active={cardFilter === "ACCEPTED"}
              value={bookingStats.accepted.toString()}
              description="Accepted by a driver"
            />
            <KpiCard
              title="Arrived"
              onClick={() => applyCardFilter("ARRIVED")}
              active={cardFilter === "ARRIVED"}
              value={bookingStats.arrived.toString()}
              description="Driver at pickup"
            />
            <KpiCard
              title="Passenger On Board"
              onClick={() => applyCardFilter("POB")}
              active={cardFilter === "POB"}
              value={bookingStats.passengerOnBoard.toString()}
              description="Active passenger journeys"
            />
            <KpiCard
              title="Running Late"
              onClick={() => applyCardFilter("RUNNING_LATE")}
              active={cardFilter === "RUNNING_LATE"}
              value={bookingStats.runningLate.toString()}
              description="Pickup time has passed"
            />
            <KpiCard
              title="At Risk"
              onClick={() => applyCardFilter("AT_RISK")}
              active={cardFilter === "AT_RISK"}
              value={bookingStats.atRisk.toString()}
              description="Unassigned and due within 15 minutes"
            />
          </div>
        ) : null}

        {bookingView === "history" ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <KpiCard
              title="Total Bookings"
              onClick={() => applyCardFilter("all")}
              active={cardFilter === "all"}
              value={activeBookings.length.toString()}
              description="Bookings in selected period"
            />
            <KpiCard
              title="Completed"
              onClick={() => applyCardFilter("COMPLETED")}
              active={cardFilter === "COMPLETED"}
              value={bookingStats.completedToday.toString()}
              description="Completed in selected period"
            />
            <KpiCard
              title="Cancelled"
              onClick={() => applyCardFilter("CANCELLED")}
              active={cardFilter === "CANCELLED"}
              value={bookingStats.cancelledToday.toString()}
              description={`Estimated lost revenue: £${bookingStats.cancelledLostRevenue.toFixed(2)}`}
            />
            <KpiCard
              title="Rejected"
              onClick={() => applyCardFilter("REJECTED")}
              active={cardFilter === "REJECTED"}
              value={
                activeBookings
                  .filter(
                    (booking) =>
                      booking.status.toUpperCase() === "REJECTED",
                  )
                  .length.toString()
              }
              description="Rejected in selected period"
            />
            <KpiCard
              title="No Fare"
              onClick={() => applyCardFilter("NO_FARE")}
              active={cardFilter === "NO_FARE"}
              value={bookingStats.noFareToday.toString()}
              description={`Estimated lost revenue: £${bookingStats.noFareLostRevenue.toFixed(2)}`}
            />
            <KpiCard
              title="Revenue"
              onClick={() => applyCardFilter("COMPLETED")}
              active={cardFilter === "COMPLETED"}
              value={`£${Number(bookingStats.revenueToday).toFixed(2)}`}
              description="Revenue from completed bookings"
            />
          </div>
        ) : null}

        {bookingView === "exceptions" ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="No Fare"
              onClick={() => applyCardFilter("NO_FARE")}
              active={cardFilter === "NO_FARE"}
              value={bookingStats.noFareToday.toString()}
              description={`Estimated lost revenue: £${bookingStats.noFareLostRevenue.toFixed(2)}`}
            />
            <KpiCard
              title="Cancelled"
              onClick={() => applyCardFilter("CANCELLED")}
              active={cardFilter === "CANCELLED"}
              value={bookingStats.cancelledToday.toString()}
              description={`Estimated lost revenue: £${bookingStats.cancelledLostRevenue.toFixed(2)}`}
            />
            <KpiCard
              title="Rejected"
              onClick={() => applyCardFilter("REJECTED")}
              active={cardFilter === "REJECTED"}
              value={
                activeBookings
                  .filter(
                    (booking) =>
                      booking.status.toUpperCase() === "REJECTED",
                  )
                  .length.toString()
              }
              description="Rejected bookings to review"
            />
            <KpiCard
              title="Stuck or Late"
              onClick={() => applyCardFilter("RUNNING_LATE")}
              active={cardFilter === "RUNNING_LATE"}
              value={bookingStats.runningLate.toString()}
              description="Operational exceptions"
            />
          </div>
        ) : null}

        {bookingView === "exceptions" ? (
          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
            <div className="flex flex-col gap-3 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Rejected Driver Ranking
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Derived from the last driver assignment before each rejection.
                </p>
              </div>

              {rejectionRanking ? (
                <div className="text-xs text-slate-400">
                  {rejectionRanking.attributedRejections.toLocaleString("en-GB")}
                  {" of "}
                  {rejectionRanking.totalRejections.toLocaleString("en-GB")}
                  {" attributed · "}
                  {rejectionRanking.attributionPercent.toFixed(2)}
                  %
                </div>
              ) : null}
            </div>

            {rejectionRankingLoading ? (
              <div className="p-8 text-center text-sm text-slate-400">
                Loading rejection ranking...
              </div>
            ) : null}

            {!rejectionRankingLoading && rejectionRankingError ? (
              <div className="p-8 text-center text-sm text-red-400">
                {rejectionRankingError}
              </div>
            ) : null}

            {!rejectionRankingLoading &&
            !rejectionRankingError &&
            rejectionRanking ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left">
                  <thead className="border-b border-slate-800 bg-slate-950/60 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Rank</th>
                      <th className="px-5 py-3">Callsign</th>
                      <th className="px-5 py-3">Driver</th>
                      <th className="px-5 py-3 text-right">
                        Rejected Jobs
                      </th>
                      <th className="px-5 py-3 text-right">
                        Estimated Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {rejectionRanking.ranking
                      .slice(0, 20)
                      .map((driver) => (
                        <tr
                          key={driver.driverId}
                          className="transition hover:bg-slate-800/50"
                        >
                          <td className="px-5 py-4 text-sm font-semibold text-slate-300">
                            #{driver.rank}
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold text-blue-400">
                            {driver.callsign
                              ? `#${driver.callsign}`
                              : "—"}
                          </td>
                          <td className="px-5 py-4 text-sm text-white">
                            {driver.driverName}
                          </td>
                          <td className="px-5 py-4 text-right text-sm font-semibold text-white">
                            {driver.rejectedJobs.toLocaleString("en-GB")}
                          </td>
                          <td className="px-5 py-4 text-right text-sm text-slate-300">
                            £
                            {driver.estimatedLostRevenue.toLocaleString(
                              "en-GB",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        ) : null}

        {bookingView === "saved" ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-8">
            <h2 className="text-lg font-semibold text-white">
              Saved Views
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Save frequently used combinations of booking filters for quick access.
            </p>
          </div>
        ) : null}

        {bookingView !== "saved" ? (
          <>
        <TableToolbar
          searchValue={searchValue}
          onSearchChange={(value) => {
            setSearchValue(value);
            setPage(1);
          }}
          searchPlaceholder="Search booking, customer, phone, driver or vehicle..."
          selectedCount={selectedRowIds.length}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onExport={() => undefined}
          filters={
            <>
              {bookingView !== "live" ? (
                <>
              <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3">
                <span className="text-xs font-semibold text-slate-500">
                  From
                </span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => {
                    setFromDate(event.target.value);
                    setPage(1);
                  }}
                  className="min-w-[132px] bg-transparent text-sm text-slate-300 outline-none [color-scheme:dark]"
                />
              </label>

              <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3">
                <span className="text-xs font-semibold text-slate-500">
                  To
                </span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(event) => {
                    setToDate(event.target.value);
                    setPage(1);
                  }}
                  className="min-w-[132px] bg-transparent text-sm text-slate-300 outline-none [color-scheme:dark]"
                />
              </label>
                </>
              ) : null}

              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setCardFilter("all");
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
                <option value="POB">Passenger On Board</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="rejected">Rejected</option>
                <option value="NO_FARE">No Fare</option>
              </select>

              {bookingView !== "live" ? (
                <>
              <select
                value={sourceFilter}
                onChange={(event) => {
                  setSourceFilter(event.target.value);
                  setPage(1);
                }}
                className="h-11 rounded-xl border border-slate-800 bg-slate-950 px-4 text-sm text-slate-300 outline-none transition focus:border-blue-500"
              >
                {sourceOptions.map((source) => (
                  <option key={source} value={source}>
                    {source === "all" ? "All Sources" : source}
                  </option>
                ))}
              </select>

              <select
                value={paymentFilter}
                onChange={(event) => {
                  setPaymentFilter(event.target.value);
                  setPage(1);
                }}
                className="h-11 rounded-xl border border-slate-800 bg-slate-950 px-4 text-sm text-slate-300 outline-none transition focus:border-blue-500"
              >
                {paymentOptions.map((payment) => (
                  <option key={payment} value={payment}>
                    {payment === "all" ? "All Payments" : payment}
                  </option>
                ))}
              </select>
                </>
              ) : null}
<button
                type="button"
                onClick={handleResetFilters}
                className="h-11 rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
              >
                Reset
              </button>
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
              aria-label={`View Autocab booking ${booking.externalId}`}
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
          </>
        ) : null}
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
            ? `${selectedBooking.customerName ?? 'Unknown Customer'} · ${formatDateTime(selectedBooking.bookedAtTime)}`
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
        onClose={() => {
          setSelectedBooking(null);
          setWorkspaceError(null);
          setWorkspaceLoading(false);
        }}
        footer={
          selectedBooking ? (
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <ActionButton
                variant="ghost"
                onClick={() => {
                  setSelectedBooking(null);
                  setWorkspaceError(null);
                  setWorkspaceLoading(false);
                }}
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
        {workspaceLoading ? (
          <div className="flex min-h-48 items-center justify-center">
            <p className="text-sm text-slate-400">
              Loading booking details...
            </p>
          </div>
        ) : null}

        {!workspaceLoading && workspaceError ? (
          <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-4">
            <p className="text-sm font-medium text-red-300">
              {workspaceError}
            </p>
          </div>
        ) : null}

        {!workspaceLoading &&
        !workspaceError &&
        selectedBooking &&
        activeWorkspaceTab === "overview" ? (
          <BookingWorkspace
            booking={selectedBooking}
            onOpenBooking={openBookingWorkspace}
          />
        ) : null}
{!workspaceLoading &&
        !workspaceError &&
        selectedBooking &&
        activeWorkspaceTab === "timeline" ? (
          <div className="space-y-6">
            {selectedBooking.timeline.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
                No timeline events available.
              </div>
            ) : (
              <div className="relative pl-8">
                <div className="absolute bottom-0 left-[7px] top-2 w-px bg-slate-800" />

                {selectedBooking.timeline.map((event, index) => (
                  <div
                    key={event.id}
                    className={
                      index === selectedBooking.timeline.length - 1
                        ? "relative"
                        : "relative pb-8"
                    }
                  >
                    <span className="absolute -left-8 top-1 h-4 w-4 rounded-full border-4 border-slate-950 bg-blue-500" />

                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {event.title}
                        </p>

                        {event.description ? (
                          <p className="mt-1 text-sm text-slate-400">
                            {event.description}
                          </p>
                        ) : null}

                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                          <span>{event.source}</span>
                          <span>•</span>
                          <span>{event.eventType}</span>
                        </div>
                      </div>

                      <div className="text-right text-xs text-slate-500 whitespace-nowrap">
                        {new Date(event.occurredAt).toLocaleString("en-GB")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
