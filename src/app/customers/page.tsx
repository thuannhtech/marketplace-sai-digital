"use client";

import { startTransition, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@/lib/icon";
import * as mdi from "@mdi/js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { getCustomers } from "@/src/app/actions/ordercloud";

function formatDate(dateStr?: string) {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(d);
  } catch {
    return dateStr;
  }
}

function normalizeAccountTypeLabel(value: unknown) {
  if (value === 0 || value === "0") return "Personal";
  if (value === 1 || value === "1") return "Business";
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "personal") return "Personal";
    if (normalized === "business" || normalized === "bussiness") return "Business";
  }
  return "N/A";
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingSearchQuery, setPendingSearchQuery] = useState("");
  const [accountType, setAccountType] = useState("");
  const [pendingAccountType, setPendingAccountType] = useState("");
  const [confirmedEmail, setConfirmedEmail] = useState("");
  const [pendingConfirmedEmail, setPendingConfirmedEmail] = useState("");
  const [status, setStatus] = useState("");
  const [pendingStatus, setPendingStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [pendingDateFrom, setPendingDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pendingDateTo, setPendingDateTo] = useState("");
  
  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [isSearching, setIsSearching] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setError("");

    // Build filters object
    const filters: any = {};
    
    // AccountType is stored as 0 = Personal, 1 = Business.
    // Keep business tolerant of older string values still present in some records.
    if (accountType) {
      if (accountType === "1") {
        filters["xp.PersonalInformation.AccountType"] = "1|*Business*|*Bussiness*";
      } else {
        filters["xp.PersonalInformation.AccountType"] = accountType;
      }
    }
    
    if (confirmedEmail) {
      // confirmedEmail could be "true" or "false"
      filters["xp.PersonalInformation.IsConfirmedEmail"] = confirmedEmail;
    }

    if (status) {
      filters["Active"] = status === "Active" ? "true" : "false";
    }

    if (dateFrom && dateTo) {
      filters["xp.DateRegistered"] = `>${dateFrom}T00:00:00Z|<${dateTo}T23:59:59Z`;
    } else if (dateFrom) {
      filters["xp.DateRegistered"] = `>${dateFrom}T00:00:00Z`;
    } else if (dateTo) {
      filters["xp.DateRegistered"] = `<${dateTo}T23:59:59Z`;
    }

    const res = await getCustomers(page, pageSize, searchQuery, filters);
    
    if (res.success) {
      setCustomers(res.data?.Items || []);
      setTotalCount(res.data?.Meta?.TotalCount || 0);
    } else {
      setError(res.error || "Failed to fetch customers");
      setCustomers([]);
    }
    
    setIsLoading(false);
  }, [page, pageSize, searchQuery, accountType, confirmedEmail, status, dateFrom, dateTo]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  function handleSearchSubmit() {
    setIsSearching(true);
    startTransition(() => {
      setSearchQuery(pendingSearchQuery);
      setPage(1);
      setIsSearching(false);
    });
  }

  function handleFilterSubmit() {
    setIsFiltering(true);
    startTransition(() => {
      setAccountType(pendingAccountType);
      setConfirmedEmail(pendingConfirmedEmail);
      setStatus(pendingStatus);
      setDateFrom(pendingDateFrom);
      setDateTo(pendingDateTo);
      setPage(1);
      setIsFiltering(false);
    });
  }

  // Helper effect to refetch when page changes, if we want auto-fetch on pagination
  useEffect(() => {
    // Only fetch if not first render to avoid double fetch, but since we have a button, we can just trigger it.
    // Actually, it's safer to just let the button trigger it or include page in dependencies of a dedicated effect.
    // We already included `fetchCustomers` in an effect above which depends on `page`, so it will auto-fetch when `page` changes!
  }, [page]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-body-text">Customers</h1>
        <p className="text-subtle-text">Manage your buyers and accounts.</p>
      </div>

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
                placeholder="Search by name or email"
                value={pendingSearchQuery}
                onChange={(e) => setPendingSearchQuery(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              className="border-sidebar-border"
              onClick={handleSearchSubmit}
              disabled={isLoading || isSearching}
            >
              {isSearching ? (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-neutral-fg">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-bg-active border-t-primary" />
                  Searching...
                </span>
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
              <p className="text-xs text-subtle-text">Account Type</p>
              <select
                value={pendingAccountType}
                onChange={(e) => setPendingAccountType(e.target.value)}
                className="border-input focus:border-primary focus:ring-primary h-10 w-full rounded-md border bg-body-bg px-3 text-sm focus:ring-1 focus:outline-none"
              >
                <option value="">Select account type</option>
                <option value="0">Personal</option>
                <option value="1">Business</option>
              </select>
            </div>

            <div className="space-y-1 md:col-span-2 lg:col-span-2">
              <p className="text-xs text-subtle-text">Status</p>
              <select
                value={pendingStatus}
                onChange={(e) => setPendingStatus(e.target.value)}
                className="border-input focus:border-primary focus:ring-primary h-10 w-full rounded-md border bg-body-bg px-3 text-sm focus:ring-1 focus:outline-none"
              >
                <option value="">Select status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="space-y-1 md:col-span-2 lg:col-span-4">
              <p className="text-xs text-subtle-text">Created Date</p>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={pendingDateFrom}
                  onChange={(e) => setPendingDateFrom(e.target.value)}
                  className="h-10 flex-1 min-w-0 text-sm pr-12"
                />
                <span className="text-subtle-text">-</span>
                <Input
                  type="date"
                  value={pendingDateTo}
                  onChange={(e) => setPendingDateTo(e.target.value)}
                  className="h-10 flex-1 min-w-0 text-sm pr-12"
                />
              </div>
            </div>

            <div className="flex items-end gap-1 md:col-span-6 lg:col-span-2">
              <Button
                variant="outline"
                className="border-sidebar-border"
                onClick={handleFilterSubmit}
                disabled={isLoading || isFiltering}
              >
                {isFiltering ? (
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-neutral-fg">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-bg-active border-t-primary" />
                    Filtering...
                  </span>
                ) : (
                  <>
                    <Icon path={mdi.mdiFilterOutline} className="mr-2 h-4 w-4" />
                    Filter
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="text-sm text-subtle-text">
            Total {totalCount} | Showing {customers.length} | Page {page}
          </div>
        </CardContent>
      </Card>

      <Card className="border-sidebar-border">
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm text-left">
              <thead className="bg-muted">
                <tr className="border-b border-sidebar-border">
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">First Name</th>
                  <th className="px-4 py-3 font-semibold">Last Name</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Account Type</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Created Date</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-subtle-text" colSpan={9}>
                      <div className="flex items-center justify-center gap-2">
                        <Icon path={mdi.mdiLoading} className="h-5 w-5 animate-spin" />
                        Loading customers...
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-red-500" colSpan={9}>
                      {error}
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-subtle-text" colSpan={9}>
                      No customers found. Try adjusting your filters.
                    </td>
                  </tr>
                ) : (
                  customers.map((user) => {
                    const dobMonth = user.xp?.PersonalInformation?.DOB?.Month;
                    const dobDay = user.xp?.PersonalInformation?.DOB?.Day;
                    const dobDisplay =
                      dobMonth && dobDay ? `${String(dobDay).padStart(2, "0")}/${String(dobMonth).padStart(2, "0")}` : "N/A";
                    const isConfirmed = user.xp?.PersonalInformation?.IsConfirmedEmail;

                    return (
                      <tr key={user.ID} className="border-b border-sidebar-border/70 hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/customers/${user.ID}`} className="text-primary hover:underline">
                            {user.ID}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{user.FirstName || "N/A"}</td>
                        <td className="px-4 py-3">{user.LastName || "N/A"}</td>
                        <td className="px-4 py-3">{user.Email || "N/A"}</td>
                        <td className="px-4 py-3">
                          {normalizeAccountTypeLabel(user.xp?.AccountType)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge colorScheme={user.Active ? "success" : "danger"} className="text-[10px] px-2 py-0.5">
                            {user.Active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-subtle-text">{formatDate(user.DateCreated)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-sidebar-border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-subtle-text">
              Showing {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalCount)} of {totalCount}
            </p>
            <div className="flex items-center gap-2 overflow-x-auto">
              <Button
                variant="outline"
                className="border-sidebar-border"
                disabled={page === 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-subtle-text">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                className="border-sidebar-border"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
