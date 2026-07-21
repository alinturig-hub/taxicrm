"use client";

import {
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type SortDirection = "asc" | "desc";

export type DataTableColumn<T> = {
  id: string;
  header: string;
  accessor?: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | Date | null | undefined;
  sortable?: boolean;
  hideable?: boolean;
  align?: "left" | "center" | "right";
  width?: string;
  className?: string;
};

type DataTableDensity = "compact" | "comfortable";

type DataTableProps<T> = {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  selectable?: boolean;
  selectedRowIds?: string[];
  onSelectedRowIdsChange?: (rowIds: string[]) => void;
  rowActions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  defaultDensity?: DataTableDensity;
  stickyHeader?: boolean;
};

function compareValues(
  first: string | number | Date | null | undefined,
  second: string | number | Date | null | undefined,
) {
  if (first == null && second == null) {
    return 0;
  }

  if (first == null) {
    return 1;
  }

  if (second == null) {
    return -1;
  }

  const firstValue = first instanceof Date ? first.getTime() : first;
  const secondValue = second instanceof Date ? second.getTime() : second;

  if (
    typeof firstValue === "number" &&
    typeof secondValue === "number"
  ) {
    return firstValue - secondValue;
  }

  return String(firstValue).localeCompare(String(secondValue), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function LoadingRows({
  columnCount,
  compact,
}: {
  columnCount: number;
  compact: boolean;
}) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, rowIndex) => (
        <tr
          key={rowIndex}
          className="border-b border-slate-800 last:border-b-0"
        >
          {Array.from({ length: columnCount }).map((__, columnIndex) => (
            <td
              key={columnIndex}
              className={compact ? "px-4 py-3" : "px-4 py-4"}
            >
              <div className="h-4 animate-pulse rounded bg-slate-800" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function DataTable<T>({
  data,
  columns,
  getRowId,
  loading = false,
  emptyTitle = "No records found",
  emptyDescription = "There is currently no data to display.",
  selectable = false,
  selectedRowIds,
  onSelectedRowIdsChange,
  rowActions,
  onRowClick,
  defaultDensity = "comfortable",
  stickyHeader = true,
}: DataTableProps<T>) {
  const [internalSelectedRowIds, setInternalSelectedRowIds] = useState<string[]>(
    [],
  );
  const [sortColumnId, setSortColumnId] = useState<string | null>(null);
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("asc");
  const [density, setDensity] =
    useState<DataTableDensity>(defaultDensity);
  const [hiddenColumnIds, setHiddenColumnIds] = useState<string[]>([]);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);

  const selectedIds = selectedRowIds ?? internalSelectedRowIds;

  const updateSelectedRows = (rowIds: string[]) => {
    if (onSelectedRowIdsChange) {
      onSelectedRowIdsChange(rowIds);
      return;
    }

    setInternalSelectedRowIds(rowIds);
  };

  const visibleColumns = useMemo(
    () =>
      columns.filter(
        (column) => !hiddenColumnIds.includes(column.id),
      ),
    [columns, hiddenColumnIds],
  );

  const sortedData = useMemo(() => {
    if (!sortColumnId) {
      return data;
    }

    const column = columns.find(
      (item) => item.id === sortColumnId,
    );

    if (!column?.sortValue) {
      return data;
    }

    return [...data].sort((firstRow, secondRow) => {
      const result = compareValues(
        column.sortValue?.(firstRow),
        column.sortValue?.(secondRow),
      );

      return sortDirection === "asc" ? result : -result;
    });
  }, [columns, data, sortColumnId, sortDirection]);

  const currentPageRowIds = sortedData.map(getRowId);
  const selectedCurrentPageRows = currentPageRowIds.filter((id) =>
    selectedIds.includes(id),
  );

  const allCurrentRowsSelected =
    currentPageRowIds.length > 0 &&
    selectedCurrentPageRows.length === currentPageRowIds.length;

  const someCurrentRowsSelected =
    selectedCurrentPageRows.length > 0 && !allCurrentRowsSelected;

  const toggleAllRows = () => {
    if (allCurrentRowsSelected) {
      updateSelectedRows(
        selectedIds.filter(
          (id) => !currentPageRowIds.includes(id),
        ),
      );
      return;
    }

    updateSelectedRows(
      Array.from(new Set([...selectedIds, ...currentPageRowIds])),
    );
  };

  const toggleRow = (rowId: string) => {
    if (selectedIds.includes(rowId)) {
      updateSelectedRows(
        selectedIds.filter((id) => id !== rowId),
      );
      return;
    }

    updateSelectedRows([...selectedIds, rowId]);
  };

  const handleSort = (column: DataTableColumn<T>) => {
    if (!column.sortable || !column.sortValue) {
      return;
    }

    if (sortColumnId === column.id) {
      setSortDirection((current) =>
        current === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortColumnId(column.id);
    setSortDirection("asc");
  };

  const toggleColumn = (columnId: string) => {
    setHiddenColumnIds((current) =>
      current.includes(columnId)
        ? current.filter((id) => id !== columnId)
        : [...current, columnId],
    );
  };

  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  const compact = density === "compact";
  const totalColumnCount =
    visibleColumns.length +
    (selectable ? 1 : 0) +
    (rowActions ? 1 : 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-400">
          <span className="font-semibold text-white">
            {data.length}
          </span>{" "}
          {data.length === 1 ? "record" : "records"}

          {selectedIds.length > 0 ? (
            <span className="ml-2 text-blue-400">
              · {selectedIds.length} selected
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-700 bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => setDensity("compact")}
              className={[
                "rounded-md px-3 py-1.5 text-xs font-medium transition",
                density === "compact"
                  ? "bg-slate-700 text-white"
                  : "text-slate-500 hover:text-white",
              ].join(" ")}
            >
              Compact
            </button>

            <button
              type="button"
              onClick={() => setDensity("comfortable")}
              className={[
                "rounded-md px-3 py-1.5 text-xs font-medium transition",
                density === "comfortable"
                  ? "bg-slate-700 text-white"
                  : "text-slate-500 hover:text-white",
              ].join(" ")}
            >
              Comfortable
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setColumnMenuOpen((current) => !current)
              }
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
              aria-expanded={columnMenuOpen}
            >
              Columns
            </button>

            {columnMenuOpen ? (
              <div className="absolute right-0 top-full z-30 mt-2 min-w-56 rounded-xl border border-slate-700 bg-slate-950 p-2 shadow-2xl">
                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Visible columns
                </p>

                <div className="max-h-72 overflow-y-auto">
                  {columns.map((column) => {
                    const isVisible =
                      !hiddenColumnIds.includes(column.id);
                    const cannotHide =
                      column.hideable === false ||
                      (isVisible && visibleColumns.length === 1);

                    return (
                      <label
                        key={column.id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
                      >
                        <input
                          type="checkbox"
                          checked={isVisible}
                          disabled={cannotHide}
                          onChange={() => toggleColumn(column.id)}
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-600"
                        />

                        <span>{column.header}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead
            className={[
              "z-10 bg-slate-950",
              stickyHeader ? "sticky top-0" : "",
            ].join(" ")}
          >
            <tr className="border-b border-slate-800">
              {selectable ? (
                <th className="w-12 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allCurrentRowsSelected}
                    ref={(element) => {
                      if (element) {
                        element.indeterminate =
                          someCurrentRowsSelected;
                      }
                    }}
                    onChange={toggleAllRows}
                    aria-label="Select all rows"
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-600"
                  />
                </th>
              ) : null}

              {visibleColumns.map((column) => {
                const activeSort =
                  sortColumnId === column.id;
                const alignment =
                  column.align ?? "left";

                return (
                  <th
                    key={column.id}
                    scope="col"
                    style={{ width: column.width }}
                    className={[
                      "whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500",
                      alignClass[alignment],
                      column.sortable && column.sortValue
                        ? "cursor-pointer select-none hover:text-slate-300"
                        : "",
                    ].join(" ")}
                    onClick={() => handleSort(column)}
                  >
                    <span
                      className={[
                        "inline-flex items-center gap-2",
                        alignment === "right"
                          ? "justify-end"
                          : alignment === "center"
                            ? "justify-center"
                            : "justify-start",
                      ].join(" ")}
                    >
                      {column.header}

                      {column.sortable && column.sortValue ? (
                        <span
                          className={
                            activeSort
                              ? "text-blue-400"
                              : "text-slate-700"
                          }
                        >
                          {activeSort
                            ? sortDirection === "asc"
                              ? "↑"
                              : "↓"
                            : "↕"}
                        </span>
                      ) : null}
                    </span>
                  </th>
                );
              })}

              {rowActions ? (
                <th className="w-20 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <LoadingRows
                columnCount={totalColumnCount}
                compact={compact}
              />
            ) : null}

            {!loading && sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={totalColumnCount}
                  className="px-6 py-16 text-center"
                >
                  <div className="mx-auto flex max-w-md flex-col items-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-xl text-slate-400">
                      ◫
                    </div>

                    <h3 className="mt-4 text-base font-semibold text-white">
                      {emptyTitle}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {emptyDescription}
                    </p>
                  </div>
                </td>
              </tr>
            ) : null}

            {!loading
              ? sortedData.map((row) => {
                  const rowId = getRowId(row);
                  const selected =
                    selectedIds.includes(rowId);

                  return (
                    <tr
                      key={rowId}
                      onClick={() => onRowClick?.(row)}
                      className={[
                        "border-b border-slate-800 transition last:border-b-0",
                        selected
                          ? "bg-blue-500/5"
                          : "hover:bg-slate-800/50",
                        onRowClick
                          ? "cursor-pointer"
                          : "",
                      ].join(" ")}
                    >
                      {selectable ? (
                        <td
                          className={
                            compact
                              ? "px-4 py-3"
                              : "px-4 py-4"
                          }
                          onClick={(event) =>
                            event.stopPropagation()
                          }
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleRow(rowId)}
                            aria-label={`Select row ${rowId}`}
                            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-600"
                          />
                        </td>
                      ) : null}

                      {visibleColumns.map((column) => {
                        const alignment =
                          column.align ?? "left";

                        return (
                          <td
                            key={column.id}
                            className={[
                              "whitespace-nowrap px-4 text-sm text-slate-300",
                              compact ? "py-3" : "py-4",
                              alignClass[alignment],
                              column.className ?? "",
                            ].join(" ")}
                          >
                            {column.accessor
                              ? column.accessor(row)
                              : null}
                          </td>
                        );
                      })}

                      {rowActions ? (
                        <td
                          className={[
                            "px-4 text-right",
                            compact ? "py-3" : "py-4",
                          ].join(" ")}
                          onClick={(event) =>
                            event.stopPropagation()
                          }
                        >
                          {rowActions(row)}
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
