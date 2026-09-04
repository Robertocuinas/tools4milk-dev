"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { getKnownTotal, hasNextPage } from "@/lib/pagination";

type PaginationProps = {
  page: number;
  pageSize: number;
  currentCount: number;
  totalItems?: number;
  hasNext?: boolean;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
};

export function Pagination({
  page,
  pageSize,
  currentCount,
  totalItems,
  hasNext,
  isLoading,
  onPageChange,
}: PaginationProps) {
  const knownTotal = getKnownTotal({ page, pageSize, currentCount, totalItems });
  const firstItem = currentCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = (page - 1) * pageSize + currentCount;
  const canPrev = page > 1 && !isLoading;
  const canNext =
    !isLoading &&
    (typeof hasNext === "boolean"
      ? hasNext
      : hasNextPage({ page, pageSize, currentCount, totalItems }));

  return (
    <nav
      className="flex flex-col gap-3 rounded-[14px] border border-app-border bg-white px-4 py-3 text-sm text-app-dim shadow-card sm:flex-row sm:items-center sm:justify-between"
      aria-label="Paginación"
    >
      <div aria-live="polite">
        {currentCount === 0 ? (
          <span>Sin resultados en esta página</span>
        ) : (
          <span>
            Mostrando <strong className="text-app-text">{firstItem}</strong>–
            <strong className="text-app-text">{lastItem}</strong>
            {typeof totalItems === "number" ? (
              <>
                {" "}
                de <strong className="text-app-text">{knownTotal}</strong>
              </>
            ) : null}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev}
          className="inline-flex min-h-9 items-center gap-2 rounded-[10px] border border-app-border bg-app-bg px-3 text-sm font-semibold text-app-text transition hover:border-brand/40 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </button>
        <span className="min-w-10 rounded-[10px] bg-app-bg px-3 py-2 text-center font-heading text-sm font-bold text-app-text">
          {page}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!canNext}
          className="inline-flex min-h-9 items-center gap-2 rounded-[10px] border border-app-border bg-app-bg px-3 text-sm font-semibold text-app-text transition hover:border-brand/40 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40"
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
