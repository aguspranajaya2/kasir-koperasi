import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import type { Product } from "../features/cart/cartSlice";

const readCsrfCookie = (): string | undefined => {
  const item = document.cookie.split("; ").find((value) => value.startsWith("koperasi_csrf="));
  return item ? decodeURIComponent(item.slice("koperasi_csrf=".length)) : undefined;
};

export interface Paginated<T> { items: T[]; page?: number; limit?: number; total?: number }
export interface Category { _id: string; name: string; slug: string }
export interface ProductCodePreview { sku: string; barcode: string }
export interface InventoryProduct extends Product { categoryId?: string; cost: number }
export interface CooperativeMember {
  _id: string; memberNo: string; name: string; phone?: string; email?: string;
  savings: { mandatory: number; voluntary: number }; points: number;
}
export interface ManagedUser {
  _id: string; name: string; email: string; role: SessionUser["role"]; active: boolean;
  lastLoginAt?: string; createdAt?: string;
}
export interface MemberLedgerEntry {
  _id: string; type: string; amount: number; balanceAfter: number; note?: string; createdAt: string;
}
export interface CashMovementEntry {
  _id: string; type: "opening" | "cash_in" | "cash_out" | "closing"; amount: number; note?: string;
  createdAt: string; cashierId: { name: string } | string;
}
export interface AuditEntry {
  _id: string; action: string; entity: string; entityId: string; metadata: Record<string, unknown>;
  createdAt: string; actorId: { name: string; email: string } | string;
}
export interface TransactionReceipt {
  _id: string;
  receiptNo: string;
  items: Array<{ name: string; qty: number; unitPrice: number; lineTotal: number }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  createdAt: string;
}
export interface SessionUser { id?: string; _id?: string; name: string; email: string; role: "admin" | "cashier" | "board" }
export interface SalesReport {
  from: string;
  to: string;
  summary: { orders: number; revenue: number; itemCost: number; grossProfit: number; tax: number; discount: number };
  daily: Array<{ _id: string; orders: number; revenue: number }>;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
  credentials: "include",
  prepareHeaders: (headers) => {
    const csrf = readCsrfCookie();
    if (csrf) headers.set("x-csrf-token", csrf);
    return headers;
  }
});

let refreshInFlight: Promise<boolean> | null = null;
const baseQueryWithRefresh: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, apiContext, extraOptions) => {
  let result = await rawBaseQuery(args, apiContext, extraOptions);
  if (result.error?.status === 401 && apiContext.endpoint !== "login") {
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        const refreshed = await rawBaseQuery({ url: "/auth/refresh", method: "POST" }, apiContext, extraOptions);
        return !refreshed.error;
      })().finally(() => { refreshInFlight = null; });
    }
    if (await refreshInFlight) result = await rawBaseQuery(args, apiContext, extraOptions);
  }
  return result;
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithRefresh,
  tagTypes: ["Products", "Members", "Categories", "Users", "Operations", "Transactions", "Session"],
  endpoints: (build) => ({
    getMe: build.query<{ user: SessionUser }, void>({ query: () => "/auth/me", providesTags: ["Session"] }),
    getCheckoutConfig: build.query<{ taxRateBps: number }, void>({ query: () => "/config/checkout" }),
    login: build.mutation<{ user: SessionUser }, { email: string; password: string }>({
      query: (body) => ({ url: "/auth/login", method: "POST", body }), invalidatesTags: ["Session"]
    }),
    logout: build.mutation<void, void>({ query: () => ({ url: "/auth/logout", method: "POST" }), invalidatesTags: ["Session"] }),
    getProducts: build.query<Paginated<Product>, { q?: string; limit?: number }>({
      query: (params) => ({ url: "/products", params: { ...params, page: 1 } }), providesTags: ["Products"]
    }),
    getInventoryProducts: build.query<Paginated<InventoryProduct>, { q?: string; limit?: number }>({
      query: (params) => ({ url: "/products", params: { ...params, page: 1 } }), providesTags: ["Products"]
    }),
    getNextProductCode: build.query<ProductCodePreview, void>({ query: () => "/products/next-code", providesTags: ["Products"] }),
    createProduct: build.mutation<{ item: InventoryProduct }, Omit<InventoryProduct, "_id" | "lowStock" | "active" | "version" | "createdAt" | "updatedAt" | "sku" | "barcode"> & { sku?: string; barcode?: string }>({
      query: (body) => ({ url: "/products", method: "POST", body }), invalidatesTags: ["Products"]
    }),
    updateProduct: build.mutation<{ item: InventoryProduct }, { id: string; changes: Partial<Omit<InventoryProduct, "_id">> }>({
      query: ({ id, changes }) => ({ url: `/products/${id}`, method: "PATCH", body: changes }), invalidatesTags: ["Products"]
    }),
    archiveProduct: build.mutation<void, string>({
      query: (id) => ({ url: `/products/${id}`, method: "DELETE" }), invalidatesTags: ["Products"]
    }),
    adjustStock: build.mutation<{ item: InventoryProduct }, { id: string; delta: number; reason: string }>({
      query: ({ id, ...body }) => ({ url: `/products/${id}/stock-adjustments`, method: "POST", body }), invalidatesTags: ["Products"]
    }),
    getCategories: build.query<Paginated<Category>, void>({ query: () => "/categories", providesTags: ["Categories"] }),
    createCategory: build.mutation<{ item: Category }, { name: string; slug: string }>({
      query: (body) => ({ url: "/categories", method: "POST", body }), invalidatesTags: ["Categories"]
    }),
    updateCategory: build.mutation<{ item: Category }, { id: string; name: string; slug: string }>({
      query: ({ id, ...body }) => ({ url: `/categories/${id}`, method: "PATCH", body }), invalidatesTags: ["Categories"]
    }),
    archiveCategory: build.mutation<void, string>({
      query: (id) => ({ url: `/categories/${id}`, method: "DELETE" }), invalidatesTags: ["Categories"]
    }),
    getLowStock: build.query<Paginated<Pick<Product, "_id" | "sku" | "name" | "stock" | "lowStockThreshold">>, void>({ query: () => "/products/low-stock", providesTags: ["Products"] }),
    getMembers: build.query<Paginated<CooperativeMember>, { q?: string; limit?: number }>({
      query: (params) => ({ url: "/members", params }), providesTags: ["Members"]
    }),
    getNextMemberNumber: build.query<{ memberNo: string }, void>({ query: () => "/members/next-number", providesTags: ["Members"] }),
    createMember: build.mutation<{ item: CooperativeMember }, { memberNo?: string; name: string; phone?: string; email?: string }>({
      query: (body) => ({ url: "/members", method: "POST", body }), invalidatesTags: ["Members"]
    }),
    updateMember: build.mutation<{ item: CooperativeMember }, { id: string; changes: Partial<Pick<CooperativeMember, "name" | "phone" | "email">> }>({
      query: ({ id, changes }) => ({ url: `/members/${id}`, method: "PATCH", body: changes }), invalidatesTags: ["Members"]
    }),
    archiveMember: build.mutation<void, string>({
      query: (id) => ({ url: `/members/${id}`, method: "DELETE" }), invalidatesTags: ["Members"]
    }),
    depositSavings: build.mutation<{ item: CooperativeMember }, { id: string; type: "mandatory" | "voluntary"; amount: number; note?: string }>({
      query: ({ id, ...body }) => ({ url: `/members/${id}/savings-deposits`, method: "POST", body }), invalidatesTags: ["Members"]
    }),
    getMemberLedger: build.query<Paginated<MemberLedgerEntry>, string>({
      query: (id) => `/members/${id}/ledger`, providesTags: ["Members"]
    }),
    getUsers: build.query<Paginated<ManagedUser>, void>({ query: () => "/users", providesTags: ["Users"] }),
    createUser: build.mutation<{ item: ManagedUser }, { name: string; email: string; password: string; role: SessionUser["role"] }>({
      query: (body) => ({ url: "/users", method: "POST", body }), invalidatesTags: ["Users"]
    }),
    updateUser: build.mutation<{ item: ManagedUser }, { id: string; changes: { name?: string; password?: string; role?: SessionUser["role"]; active?: boolean } }>({
      query: ({ id, changes }) => ({ url: `/users/${id}`, method: "PATCH", body: changes }), invalidatesTags: ["Users", "Session"]
    }),
    getSalesReport: build.query<SalesReport, { from: string; to: string }>({
      query: (params) => ({ url: "/reports/sales", params })
    }),
    getCashMovements: build.query<Paginated<CashMovementEntry>, void>({ query: () => "/reports/cash-movements", providesTags: ["Operations"] }),
    getAuditLogs: build.query<Paginated<AuditEntry>, void>({ query: () => "/reports/audit-logs", providesTags: ["Operations"] }),
    createCashMovement: build.mutation<{ item: CashMovementEntry }, { type: CashMovementEntry["type"]; amount: number; note?: string }>({
      query: (body) => ({ url: "/cash-movements", method: "POST", body }), invalidatesTags: ["Operations"]
    }),
    checkout: build.mutation<{ item: TransactionReceipt }, {
      idempotencyKey: string;
      items: Array<{ productId: string; qty: number }>;
      paymentMethod: "cash" | "member_balance";
      paidAmount: number;
      memberId?: string;
      discount: number;
    }>({ query: (body) => ({ url: "/transactions/checkout", method: "POST", body }), invalidatesTags: ["Products", "Members", "Transactions"] })
  })
});

export const {
  useGetMeQuery, useLoginMutation, useLogoutMutation,
  useGetCheckoutConfigQuery, useGetProductsQuery, useGetLowStockQuery, useGetMembersQuery, useCheckoutMutation, useGetSalesReportQuery,
  useGetInventoryProductsQuery, useGetNextProductCodeQuery, useCreateProductMutation, useUpdateProductMutation, useArchiveProductMutation, useAdjustStockMutation,
  useGetCategoriesQuery, useCreateCategoryMutation, useUpdateCategoryMutation, useArchiveCategoryMutation,
  useGetNextMemberNumberQuery, useCreateMemberMutation, useUpdateMemberMutation, useArchiveMemberMutation, useDepositSavingsMutation, useGetMemberLedgerQuery,
  useGetUsersQuery, useCreateUserMutation, useUpdateUserMutation, useGetCashMovementsQuery, useGetAuditLogsQuery, useCreateCashMovementMutation
} = api;
