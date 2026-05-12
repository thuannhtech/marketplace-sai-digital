"use client";

import { startTransition, useEffect, useState, useMemo } from "react";
import * as mdi from "@mdi/js";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/lib/icon";
import { getIncomingOrders } from "@/src/app/actions/ordercloud";

const PAGE_SIZE = 10;
const STATUS_ALL = "all";
const STATUS_OPTIONS = [STATUS_ALL, "Open", "Completed", "Canceled"] as const;

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateString?: string) {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusColor(status?: string) {
  if (!status) return "neutral";
  const s = status.toLowerCase();
  if (s === "open") return "primary";
  if (s === "completed") return "success";
  if (s === "canceled" || s === "cancelled") return "danger";
  return "neutral";
}

function getDisplayStatus(order: any) {
  return order.Status.toLowerCase() || "Unknown";
}

function BlokLoader({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-neutral-fg" aria-live="polite">
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-bg-active border-t-primary"
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

export default function OrderListPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and Filter state
  const [keyword, setKeyword] = useState("");
  const [pendingKeyword, setPendingKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_ALL);
  const [pendingStatusFilter, setPendingStatusFilter] = useState<string>(STATUS_ALL);
  const [startDate, setStartDate] = useState("");
  const [pendingStartDate, setPendingStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pendingEndDate, setPendingEndDate] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [pendingMinPrice, setPendingMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [pendingMaxPrice, setPendingMaxPrice] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);

  async function fetchOrders() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getIncomingOrders();
      if (response.success) {
        setOrders(response.data || []);
      } else {
        setError(response.error || "Failed to fetch orders");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders();
  }, []);

  function handleSearchSubmit() {
    setIsSearching(true);
    startTransition(() => {
      setKeyword(pendingKeyword);
      setCurrentPage(1);
      setIsSearching(false);
    });
  }

  function handleFilterSubmit() {
    setIsFiltering(true);
    startTransition(() => {
      setStatusFilter(pendingStatusFilter);
      setStartDate(pendingStartDate);
      setEndDate(pendingEndDate);
      setMinPrice(pendingMinPrice);
      setMaxPrice(pendingMaxPrice);
      setCurrentPage(1);
      setIsFiltering(false);
    });
  }

  const visibleOrders = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return orders.filter((order) => {
      // Search by ID, First Name, Last Name, or Customer ID
      const matchesKeyword =
        !normalizedKeyword ||
        order.ID?.toLowerCase().includes(normalizedKeyword) ||
        order.FromUser?.FirstName?.toLowerCase().includes(normalizedKeyword) ||
        order.FromUser?.LastName?.toLowerCase().includes(normalizedKeyword) ||
        order.FromUser?.Username?.toLowerCase().includes(normalizedKeyword);

      const matchesStatus = statusFilter === STATUS_ALL || order.Status?.toLowerCase() === statusFilter.toLowerCase();

      // Date Range filter
      let matchesDate = true;
      const orderDateStr = order.DateSubmitted || order.DateCreated;
      if (orderDateStr) {
        const orderDate = new Date(orderDateStr).getTime();
        if (startDate) {
          const start = new Date(startDate).getTime();
          if (orderDate < start) matchesDate = false;
        }
        if (endDate) {
          // Add 1 day to include the whole end date
          const end = new Date(endDate).getTime() + 86400000;
          if (orderDate > end) matchesDate = false;
        }
      }

      // Total Price filter
      let matchesPrice = true;
      if (order.Total !== undefined) {
        const total = Number(order.Total);
        if (minPrice && total < Number(minPrice)) matchesPrice = false;
        if (maxPrice && total > Number(maxPrice)) matchesPrice = false;
      }

      return matchesKeyword && matchesStatus && matchesDate && matchesPrice;
    });
  }, [keyword, orders, statusFilter, startDate, endDate, minPrice, maxPrice]);

  const totalPages = Math.max(1, Math.ceil(visibleOrders.length / PAGE_SIZE));
  const pageStartIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedOrders = visibleOrders.slice(pageStartIndex, pageStartIndex + PAGE_SIZE);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, statusFilter, startDate, endDate, minPrice, maxPrice]);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-body-text">Incoming Orders</h1>
        <p className="text-subtle-text">View and manage your incoming orders from OrderCloud.</p>
      </section>

      <Card className="border-sidebar-border">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative w-full md:max-w-xs">
              <Icon
                path={mdi.mdiMagnify}
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-text"
              />
              <Input
                className="pl-9"
                placeholder="Search by order number or name"
                value={pendingKeyword}
                onChange={(event) => setPendingKeyword(event.target.value)}
              />
            </div>
            <Button
              variant="outline"
              className="border-sidebar-border"
              onClick={handleSearchSubmit}
              disabled={isLoading || isSearching}
            >
              {isSearching ? (
                <BlokLoader label="Searching..." />
              ) : (
                <>
                  <Icon path={mdi.mdiDatabaseSearch} className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-6 lg:grid-cols-12">
            <div className="space-y-1 md:col-span-2 lg:col-span-2">
              <p className="text-xs text-subtle-text">Status</p>
              <select
                className="border-input focus:border-primary focus:ring-primary h-10 w-full rounded-md border bg-body-bg px-3 text-sm capitalize focus:ring-1 focus:outline-none"
                value={pendingStatusFilter}
                onChange={(event) => setPendingStatusFilter(event.target.value)}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status === STATUS_ALL ? "All status" : status}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="space-y-1 md:col-span-2 lg:col-span-3">
              <p className="text-xs text-subtle-text">Date Range</p>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  className="h-10 flex-1 min-w-0 text-sm pr-12"
                  value={pendingStartDate}
                  onChange={(e) => setPendingStartDate(e.target.value)}
                />
                <span className="text-subtle-text">-</span>
                <Input
                  type="date"
                  className="h-10 flex-1 min-w-0 text-sm pr-12"
                  value={pendingEndDate}
                  onChange={(e) => setPendingEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1 md:col-span-2 lg:col-span-3">
              <p className="text-xs text-subtle-text">Total Paid</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  className="h-10 w-24 text-sm"
                  value={pendingMinPrice}
                  onChange={(e) => setPendingMinPrice(e.target.value)}
                />
                <span className="text-subtle-text">-</span>
                <Input
                  type="number"
                  placeholder="Max"
                  className="h-10 w-24 text-sm"
                  value={pendingMaxPrice}
                  onChange={(e) => setPendingMaxPrice(e.target.value)}
                />
                <Button
                variant="outline"
                className="border-sidebar-border"
                onClick={handleFilterSubmit}
                disabled={isLoading || isFiltering}
              >
                {isFiltering ? (
                  <BlokLoader label="Filtering..." />
                ) : (
                  <>
                    <Icon path={mdi.mdiFilterOutline} className="mr-2 h-4 w-4" />
                    Filter
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setKeyword("");
                  setPendingKeyword("");
                  setStatusFilter(STATUS_ALL);
                  setPendingStatusFilter(STATUS_ALL);
                  setStartDate("");
                  setPendingStartDate("");
                  setEndDate("");
                  setPendingEndDate("");
                  setMinPrice("");
                  setPendingMinPrice("");
                  setMaxPrice("");
                  setPendingMaxPrice("");
                }}
              >
                Clear
              </Button>
              </div>
            </div>
          </div>

          <div className="text-sm text-subtle-text">
            Total {orders.length} | Filtered {visibleOrders.length} | Page {currentPage}/{totalPages}
          </div>
        </CardContent>
      </Card>

      <Card className="border-sidebar-border">
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm text-left">
              <thead className="bg-muted">
                <tr className="border-b border-sidebar-border">
                  <th className="px-4 py-3 font-semibold">Order Number</th>
                  <th className="px-4 py-3 font-semibold">Submited Date</th>
                  <th className="px-4 py-3 font-semibold">First Name</th>
                  <th className="px-4 py-3 font-semibold">Last Name</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Total Paid</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td className="px-4 py-8 text-center" colSpan={9}>
                      <BlokLoader label="Loading orders..." />
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-red-500" colSpan={9}>
                      {error}
                    </td>
                  </tr>
                ) : paginatedOrders.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-subtle-text" colSpan={9}>
                      No incoming orders found.
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => (
                    <tr key={order.ID} className="border-b border-sidebar-border/70 hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/orders/${order.ID}`} className="text-primary hover:underline">
                          {order.ID}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-subtle-text">{formatDate(order.DateSubmitted || order.DateCreated)}</td>
                      <td className="px-4 py-3">{order.FromUser?.FirstName || "N/A"}</td>
                      <td className="px-4 py-3">{order.FromUser?.LastName || "N/A"}</td>
                      <td className="px-4 py-3">{order.FromUser?.Username || order.FromCompany?.Name || "N/A"}</td>
                      <td className="px-4 py-3 font-medium">{formatPrice(order.Total)}</td>
                      <td className="px-4 py-3">
                        <Badge colorScheme={getStatusColor(getDisplayStatus(order))}>
                          {getDisplayStatus(order)}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-sidebar-border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-subtle-text">
              Showing {visibleOrders.length === 0 ? 0 : pageStartIndex + 1}-
              {Math.min(pageStartIndex + PAGE_SIZE, visibleOrders.length)} of {visibleOrders.length}
            </p>
            <div className="flex items-center gap-2 overflow-x-auto">
              <Button
                variant="outline"
                className="border-sidebar-border"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-subtle-text">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                className="border-sidebar-border"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
