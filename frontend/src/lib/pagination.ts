export const DEFAULT_PAGE_SIZE = 24;

export type PageMeta = {
  page: number;
  pageSize: number;
  totalItems?: number;
  currentCount: number;
};

export function getSkip(page: number, pageSize: number) {
  return Math.max(0, (page - 1) * pageSize);
}

export function getKnownTotal(meta: PageMeta) {
  if (typeof meta.totalItems === "number") return meta.totalItems;
  return getSkip(meta.page, meta.pageSize) + meta.currentCount;
}

export function hasNextPage(meta: PageMeta) {
  if (typeof meta.totalItems === "number") {
    return meta.page * meta.pageSize < meta.totalItems;
  }
  return meta.currentCount >= meta.pageSize;
}
