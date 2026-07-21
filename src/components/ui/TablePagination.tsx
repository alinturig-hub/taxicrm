"use client";

type TablePaginationProps = {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export default function TablePagination({
  page,
  totalPages,
  pageSize,
  totalItems,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const safeTotalPages = Math.max(totalPages, 1);
  const safePage = Math.min(Math.max(page, 1), safeTotalPages);

  const startItem =
    totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;

  const endItem = Math.min(safePage * pageSize, totalItems);

  const visiblePages = Array.from(
    { length: safeTotalPages },
    (_, index) => index + 1,
  ).filter(
    (pageNumber) =>
      pageNumber === 1 ||
      pageNumber === safeTotalPages ||
      Math.abs(pageNumber - safePage) <= 1,
  );

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
        <span>
          Showing{" "}
          <strong className="font-semibold text-white">
            {startItem}
          </strong>{" "}
          to{" "}
          <strong className="font-semibold text-white">
            {endItem}
          </strong>{" "}
          of{" "}
          <strong className="font-semibold text-white">
            {totalItems}
          </strong>
        </span>

        <label className="flex items-center gap-2">
          <span className="text-slate-500">Rows</span>

          <select
            value={pageSize}
            onChange={(event) =>
              onPageSizeChange(Number(event.target.value))
            }
            className="h-9 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-300 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="h-9 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>

        <div className="flex items-center gap-1">
          {visiblePages.map((pageNumber, index) => {
            const previousPage = visiblePages[index - 1];
            const showGap =
              previousPage && pageNumber - previousPage > 1;

            return (
              <div
                key={pageNumber}
                className="flex items-center gap-1"
              >
                {showGap ? (
                  <span className="px-2 text-slate-600">…</span>
                ) : null}

                <button
                  type="button"
                  onClick={() => onPageChange(pageNumber)}
                  className={[
                    "h-9 min-w-9 rounded-lg border px-3 text-sm font-medium transition",
                    pageNumber === safePage
                      ? "border-blue-500 bg-blue-600 text-white"
                      : "border-slate-700 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-white",
                  ].join(" ")}
                >
                  {pageNumber}
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= safeTotalPages}
          className="h-9 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
