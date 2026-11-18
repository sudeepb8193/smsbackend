export interface PaginationMeta {
  currentPage: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  pagination: PaginationMeta;
}

/**
 * Standardizes API pagination output across all SMS backend modules.
 * Strictly adheres to Phase 3 requirements while preserving backwards-compatibility.
 */
export function createPaginatedResponse<T>(
  items: T[],
  totalRecords: number,
  page: number = 1,
  limit: number = 10,
): PaginatedResult<T> {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
  const totalPages = safeLimit > 0 ? Math.ceil(totalRecords / safeLimit) : 1;

  const paginationMeta: PaginationMeta = {
    currentPage: safePage,
    pageSize: safeLimit,
    totalRecords,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPreviousPage: safePage > 1,
  };

  return {
    items,
    data: items, // Backwards-compatible alias for consumers expecting res.data
    total: totalRecords, // Backwards-compatible alias
    page: safePage, // Backwards-compatible alias
    limit: safeLimit, // Backwards-compatible alias
    totalPages, // Backwards-compatible alias
    pagination: paginationMeta, // Official Phase 3 Standardized Pagination Contract
  };
}

