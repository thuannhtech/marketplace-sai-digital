"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@/lib/icon";
import * as mdi from "@mdi/js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [accountType, setAccountType] = useState("");
  const [confirmedEmail, setConfirmedEmail] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Reset to first page
    fetchCustomers();
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setAccountType("");
    setConfirmedEmail("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
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

      {/* Filters */}
      <div className="bg-card border border-sidebar-border rounded-lg p-4 space-y-4 shadow-sm">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 items-end">
          
          <div className="space-y-2 xl:col-span-2">
            <label className="text-xs font-semibold text-subtle-text uppercase tracking-wider">Search</label>
            <Input 
              placeholder="Search by name, email..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-body-bg border-sidebar-border text-body-text h-10"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-subtle-text uppercase tracking-wider">Account Type</label>
            <select 
              value={accountType} 
              onChange={(e) => setAccountType(e.target.value)}
              className="flex h-10 w-full items-center justify-between whitespace-nowrap rounded-md border border-sidebar-border bg-body-bg px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring text-body-text"
            >
              <option value="">Select account type</option>
              <option value="Personal">Personal</option>
              <option value="Business">Business</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-subtle-text uppercase tracking-wider">Confirmed Email</label>
            <select 
              value={confirmedEmail} 
              onChange={(e) => setConfirmedEmail(e.target.value)}
              className="flex h-10 w-full items-center justify-between whitespace-nowrap rounded-md border border-sidebar-border bg-body-bg px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring text-body-text"
            >
              <option value="">Select status</option>
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-subtle-text uppercase tracking-wider">Status</label>
            <select 
              value={status} 
              onChange={(e) => setStatus(e.target.value)}
              className="flex h-10 w-full items-center justify-between whitespace-nowrap rounded-md border border-sidebar-border bg-body-bg px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring text-body-text"
            >
              <option value="">Select status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="space-y-2 xl:col-span-2">
            <label className="text-xs font-semibold text-subtle-text uppercase tracking-wider">Created Date</label>
            <div className="flex items-center gap-2">
              <Input 
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-body-bg border-sidebar-border text-body-text h-10"
              />
              <span className="text-subtle-text">-</span>
              <Input 
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-body-bg border-sidebar-border text-body-text h-10"
              />
            </div>
          </div>

          <div className="flex gap-2 xl:col-span-1">
             <Button type="submit" variant="default" className="w-full bg-primary hover:bg-primary/90 h-10">Filter</Button>
             <Button type="button" variant="outline" onClick={handleResetFilters} title="Reset Filters" className="h-10 px-3">
                <Icon path={mdi.mdiRefresh} size={0.8} />
             </Button>
          </div>

        </form>
      </div>

      {/* Table Section */}
      <div className="bg-card border border-sidebar-border rounded-lg shadow-sm overflow-hidden">
        
        <div className="px-4 py-3 border-b border-sidebar-border flex items-center justify-between bg-muted/20">
          <h2 className="text-sm font-semibold text-body-text">Total {totalCount}</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-subtle-text uppercase bg-muted/50 border-b border-sidebar-border whitespace-nowrap">
              <tr>
                <th className="px-4 py-3 font-medium">Action</th>
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
                      <td className="px-4 py-3">
                        <Link href={`/customers/${user.ID}`} className="text-primary hover:underline font-medium">
                          View
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{user.ID}</td>
                      <td className="px-4 py-3 font-medium">{`${user.FirstName || ''} ${user.LastName || ''}`.trim() || 'N/A'}</td>
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
