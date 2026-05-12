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

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setError("");

    // Build filters object
    const filters: any = {};
    
    // OrderCloud Users endpoint allows filtering by xp. 
    // E.g., xp.PersonalInformation.AccountType=B2B
    if (accountType) {
      // Some environments have legacy typo value "Bussiness".
      // Use an OR-filter so selecting "Business" still returns those records.
      if (accountType === "Business") {
        filters["xp.PersonalInformation.AccountType"] = "*Business*|*Bussiness*";
      } else {
        filters["xp.PersonalInformation.AccountType"] = `*${accountType}*`;
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

  const handleResetFilters = () => {
    setSearchQuery("");
    setPendingSearchQuery("");
    setAccountType("");
    setPendingAccountType("");
    setConfirmedEmail("");
    setPendingConfirmedEmail("");
    setStatus("");
    setPendingStatus("");
    setDateFrom("");
    setPendingDateFrom("");
    setDateTo("");
    setPendingDateTo("");
    setPage(1);
  };

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
                <option value="Personal">Personal</option>
                <option value="Business">Business</option>
              </select>
            </div>

            <div className="space-y-1 md:col-span-2 lg:col-span-2">
              <p className="text-xs text-subtle-text">Confirmed Email</p>
              <select
                value={pendingConfirmedEmail}
                onChange={(e) => setPendingConfirmedEmail(e.target.value)}
                className="border-input focus:border-primary focus:ring-primary h-10 w-full rounded-md border bg-body-bg px-3 text-sm focus:ring-1 focus:outline-none"
              >
                <option value="">Select status</option>
                <option value="true">True</option>
                <option value="false">False</option>
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
              <Button variant="ghost" onClick={handleResetFilters}>
                Clear
              </Button>
            </div>
          </div>

          <div className="text-sm text-subtle-text">
            Total {totalCount} | Showing {customers.length} | Page {page}
          </div>
        </CardContent>
      </Card>

      {/* Table Section */}
      <div className="bg-card border border-sidebar-border rounded-lg shadow-sm overflow-hidden">
        
        <div className="px-4 py-3 border-b border-sidebar-border flex items-center justify-between bg-muted/20">
          <h2 className="text-sm font-semibold text-body-text">Total {totalCount}</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-subtle-text uppercase bg-muted/50 border-b border-sidebar-border whitespace-nowrap">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Account Type</th>
                <th className="px-4 py-3 font-medium">Date of Birth</th>
                <th className="px-4 py-3 font-medium">Confirmed Email</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created Date</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Opt In</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sidebar-border">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-subtle-text">
                    <div className="flex items-center justify-center gap-2">
                      <Icon path={mdi.mdiLoading} className="animate-spin h-5 w-5" />
                      Loading customers...
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-destructive">
                    {error}
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-subtle-text">
                    No customers found. Try adjusting your filters.
                  </td>
                </tr>
              ) : (
                customers.map((user) => {
                  const dobMonth = user.xp?.PersonalInformation?.DOB?.Month;
                  const dobDay = user.xp?.PersonalInformation?.DOB?.Day;
                  const dobDisplay = (dobMonth && dobDay) ? `${String(dobDay).padStart(2, '0')}/${String(dobMonth).padStart(2, '0')}` : "N/A";
                  
                  const isConfirmed = user.xp?.PersonalInformation?.IsConfirmedEmail;
                  const isOptIn = user.xp?.PersonalInformation?.Marketing;
                  
                  return (
                    <tr key={user.ID} className="hover:bg-muted/30 transition-colors whitespace-nowrap">
                      <td className="px-4 py-3 font-mono text-xs">
                        <Link href={`/customers/${user.ID}`} className="text-primary hover:underline">
                          {user.ID}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/customers/${user.ID}`} className="text-primary hover:underline">
                          {`${user.FirstName || ""} ${user.LastName || ""}`.trim() || "N/A"}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{user.Email || "N/A"}</td>
                      <td className="px-4 py-3">{user.xp?.PersonalInformation?.AccountType || "N/A"}</td>
                      <td className="px-4 py-3">{dobDisplay}</td>
                      <td className="px-4 py-3">
                        <Badge colorScheme={isConfirmed ? "success" : "neutral"} className="text-[10px] px-2 py-0.5">
                          {isConfirmed ? "Yes" : "No"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge colorScheme={user.Active ? "success" : "danger"} className="text-[10px] px-2 py-0.5">
                          {user.Active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{formatDate(user.xp?.DateRegistered)}</td>
                      <td className="px-4 py-3">{user.xp?.PersonalInformation?.PhoneAreaCode ? `+${user.xp.PersonalInformation.PhoneAreaCode} ${user.Phone}` : (user.Phone || "N/A")}</td>
                      <td className="px-4 py-3">
                        <Badge colorScheme={isOptIn ? "primary" : "neutral"} className="text-[10px] px-2 py-0.5">
                          {isOptIn ? "Yes" : "No"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 border-t border-sidebar-border flex items-center justify-between bg-muted/20">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page === 1 || isLoading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-subtle-text">Page {page}</span>
            <Button 
              variant="outline" 
              size="sm"
              disabled={customers.length < pageSize || isLoading}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
        </div>

      </div>
    </div>
  );
}
