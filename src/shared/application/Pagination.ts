const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export interface PaginatedRequest {
  readonly page: number;
  readonly pageSize: number;
}

export interface PaginatedResponse<T> {
  readonly items: ReadonlyArray<T>;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export function createPaginatedRequest(page?: number, pageSize?: number): PaginatedRequest {
  let normalizedPage = page !== undefined ? page : DEFAULT_PAGE;
  if (normalizedPage < 1) {
    normalizedPage = DEFAULT_PAGE;
  }

  let normalizedPageSize = pageSize !== undefined ? pageSize : DEFAULT_PAGE_SIZE;
  if (normalizedPageSize < 1) {
    normalizedPageSize = DEFAULT_PAGE_SIZE;
  }
  if (normalizedPageSize > MAX_PAGE_SIZE) {
    normalizedPageSize = MAX_PAGE_SIZE;
  }

  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
  };
}

export function createPaginatedResponse<T>(
  items: ReadonlyArray<T>,
  total: number,
  request: PaginatedRequest,
): PaginatedResponse<T> {
  const totalPages = total === 0 ? 0 : Math.ceil(total / request.pageSize);

  return {
    items,
    total,
    page: request.page,
    pageSize: request.pageSize,
    totalPages,
  };
}
