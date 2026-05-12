"use client";

import { useEffect, useMemo, useState } from "react";
import * as mdi from "@mdi/js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icon } from "@/lib/icon";
import { createPromotion, getPromotions } from "@/src/app/actions/ordercloud";

const ACTIVE_ALL = "all";
const ACTIVE_OPTIONS = [
  { value: ACTIVE_ALL, label: "All status" },
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
] as const;

const PROMOTION_TYPE_OPTIONS = [
  { value: "FixedAmount", label: "Fixed Amount" },
  { value: "Percentage", label: "Percentage" },
] as const;

const CUSTOMER_GROUP_OPTIONS = [
  { id: "business", label: "Business" },
  { id: "guest", label: "Guest" },
  { id: "personal", label: "Personal" },
] as const;

function BlokLoader({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-neutral-fg" aria-live="polite">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-bg-active border-t-primary" />
      {label}
    </span>
  );
}

function getPromotionTypeLabel(promotion: any): string {
  return promotion?.xp?.PromotionType || "Unknown";
}

function getStatusColor(active?: boolean) {
  return active ? "success" : "danger";
}

function formatDate(value?: string) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [pendingSearchQuery, setPendingSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState(ACTIVE_ALL);
  const [pendingActiveFilter, setPendingActiveFilter] = useState(ACTIVE_ALL);

  const [createForm, setCreateForm] = useState({
    active: true,
    autoApply: false,
    canCombine: false,
    allowAllUserGroups: true,
    selectedUserGroups: [] as string[],
    name: "",
    code: "",
    type: "FixedAmount" as "FixedAmount" | "Percentage",
    amount: 0,
    priority: 1,
    startDate: "",
    expirationDate: "",
    messageEn: "",
  });

  async function loadPromotionList({
    pageOverride,
    activeOverride,
    withLoading = true,
  }: {
    pageOverride?: number;
    searchOverride?: string;
    activeOverride?: string;
    withLoading?: boolean;
  } = {}) {
    if (withLoading) {
      setIsLoading(true);
    }
    setError("");
    try {
      const res = await getPromotions(
        pageOverride ?? page,
        pageSize,
        (activeOverride ?? activeFilter) === ACTIVE_ALL ? undefined : (activeOverride ?? activeFilter),
      );
      if (!res.success) {
        setError(res.error || "Failed to fetch promotions");
        setPromotions([]);
        setTotalCount(0);
        return null;
      }
      setPromotions(res.data?.Items || []);
      setTotalCount(res.data?.Meta?.TotalCount || 0);
      return res.data?.Items || [];
    } finally {
      if (withLoading) {
        setIsLoading(false);
      }
    }
  }

  async function fetchPromotionList() {
    await loadPromotionList();
  }

  useEffect(() => {
    void fetchPromotionList();
  }, [page]);

  async function handleSearchSubmit() {
    setIsSearching(true);
    setSearchQuery(pendingSearchQuery);
    setPage(1);
    try {
      await loadPromotionList({
        pageOverride: 1,
        searchOverride: pendingSearchQuery,
        withLoading: false,
      });
    } finally {
      setIsSearching(false);
    }
  }

  async function handleFilterSubmit() {
    setIsFiltering(true);
    setActiveFilter(pendingActiveFilter);
    setPage(1);
    try {
      await loadPromotionList({
        pageOverride: 1,
        activeOverride: pendingActiveFilter,
        withLoading: false,
      });
    } finally {
      setIsFiltering(false);
    }
  }

  function resetFilters() {
    setSearchQuery("");
    setPendingSearchQuery("");
    setActiveFilter(ACTIVE_ALL);
    setPendingActiveFilter(ACTIVE_ALL);
    setPage(1);
  }

  function resetCreateForm() {
    setCreateError("");
    setCreateForm({
      active: true,
      autoApply: false,
      canCombine: false,
      allowAllUserGroups: true,
      selectedUserGroups: [],
      name: "",
      code: "",
      type: "FixedAmount",
      amount: 0,
      priority: 1,
      startDate: "",
      expirationDate: "",
      messageEn: "",
    });
  }

  async function handleCreatePromotion() {
    setCreateError("");
    if (!createForm.name.trim() || !createForm.code.trim()) {
      setCreateError("Name and Code are required.");
      return;
    }
    if (createForm.amount <= 0) {
      setCreateError("Amount must be greater than 0.");
      return;
    }
    if (createForm.type === "Percentage" && createForm.amount > 100) {
      setCreateError("Percentage value cannot be greater than 100.");
      return;
    }
    if (!createForm.allowAllUserGroups && createForm.selectedUserGroups.length === 0) {
      setCreateError("Select at least one customer group or allow all groups.");
      return;
    }

    setIsCreating(true);
    try {
      const res = await createPromotion({
        name: createForm.name,
        code: createForm.code,
        active: createForm.active,
        autoApply: createForm.autoApply,
        canCombine: createForm.canCombine,
        type: createForm.type,
        amount: createForm.amount,
        priority: createForm.priority,
        startDate: createForm.startDate || undefined,
        expirationDate: createForm.expirationDate || undefined,
        messageEn: createForm.messageEn,
        allowAllUserGroups: createForm.allowAllUserGroups,
        allowedUserGroupIds: createForm.allowAllUserGroups ? [] : [...createForm.selectedUserGroups],
        allowedUserGroupNames: createForm.allowAllUserGroups
          ? []
          : CUSTOMER_GROUP_OPTIONS.filter((option) => createForm.selectedUserGroups.includes(option.id)).map((option) => option.label),
      });

      if (!res.success) {
        setCreateError(res.error || "Failed to create promotion.");
        return;
      }

      setIsCreateOpen(false);
      resetCreateForm();
      setPage(1);
      await loadPromotionList({ pageOverride: 1 });
      setToast("Promotion created successfully.");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsCreating(false);
    }
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [pageSize, totalCount]);

  return (
    <div className="space-y-6">
      {toast ? (
        <div className="fixed right-4 top-4 z-[80]">
          <div className="rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-[0_14px_40px_rgba(15,23,42,0.18)]">
            {toast}
          </div>
        </div>
      ) : null}

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-body-text">Promotions</h1>
        <p className="text-subtle-text">Manage OrderCloud promotions.</p>
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
                placeholder="Search by name or code"
                value={pendingSearchQuery}
                onChange={(event) => setPendingSearchQuery(event.target.value)}
              />
            </div>
            <Button
              variant="outline"
              className="border-sidebar-border"
              onClick={handleSearchSubmit}
              disabled={isLoading || isSearching}
            >
              {isSearching ? <BlokLoader label="Searching..." /> : <>
                <Icon path={mdi.mdiDatabaseSearch} className="mr-2 h-4 w-4" />
                Search
              </>}
            </Button>
            <div className="md:ml-auto">
              <Button
                onClick={() => {
                  resetCreateForm();
                  setIsCreateOpen(true);
                }}
              >
                <Icon path={mdi.mdiPlus} className="mr-2 h-4 w-4" />
                Add New Promotion
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-6 lg:grid-cols-12">
            <div className="space-y-1 md:col-span-2 lg:col-span-3">
              <p className="text-xs text-subtle-text">Status</p>
              <select
                value={pendingActiveFilter}
                onChange={(event) => setPendingActiveFilter(event.target.value)}
                className="border-input focus:border-primary focus:ring-primary h-10 w-full rounded-md border bg-body-bg px-3 text-sm focus:ring-1 focus:outline-none"
              >
                {ACTIVE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-1 md:col-span-6 lg:col-span-2">
              <Button
                variant="outline"
                className="border-sidebar-border"
                onClick={handleFilterSubmit}
                disabled={isLoading || isFiltering}
              >
                {isFiltering ? <BlokLoader label="Filtering..." /> : <>
                  <Icon path={mdi.mdiFilterOutline} className="mr-2 h-4 w-4" />
                  Filter
                </>}
              </Button>
              <Button variant="ghost" onClick={resetFilters}>
                Clear
              </Button>
            </div>
          </div>

          <div className="text-sm text-subtle-text">
            Total {totalCount} | Showing {promotions.length} | Page {page}/{totalPages}
          </div>
        </CardContent>
      </Card>

      <Card className="border-sidebar-border">
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm text-left">
              <thead className="bg-muted">
                <tr className="border-b border-sidebar-border">
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Start Date</th>
                  <th className="px-4 py-3 font-semibold">Expiration Date</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center">
                      <BlokLoader label="Loading promotions..." />
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-destructive">
                      {error}
                    </td>
                  </tr>
                ) : promotions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-subtle-text">
                      No promotions found.
                    </td>
                  </tr>
                ) : (
                  promotions.map((promotion) => (
                    <tr key={promotion.ID} className="border-b border-sidebar-border/70">
                      <td className="px-4 py-3 font-medium">{promotion.Code || "N/A"}</td>
                      <td className="px-4 py-3">{promotion.Name || "N/A"}</td>
                      <td className="px-4 py-3">{getPromotionTypeLabel(promotion)}</td>
                      <td className="px-4 py-3">{formatDate(promotion.StartDate)}</td>
                      <td className="px-4 py-3">{formatDate(promotion.ExpirationDate)}</td>
                      <td className="px-4 py-3">
                        <Badge colorScheme={getStatusColor(Boolean(promotion.Active))}>
                          {promotion.Active ? "Active" : "Inactive"}
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
              Showing {promotions.length === 0 ? 0 : (page - 1) * pageSize + 1}-
              {Math.min(page * pageSize, totalCount)} of {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="border-sidebar-border"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1 || isLoading}
              >
                Previous
              </Button>
              <span className="text-subtle-text">Page {page} of {totalPages}</span>
              <Button
                variant="outline"
                className="border-sidebar-border"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages || isLoading}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="border-sidebar-border p-0 sm:max-w-6xl">
          <DialogHeader>
            <div className="border-b border-sidebar-border px-6 py-5">
              <DialogTitle className="text-xl font-semibold text-body-text">Create Promotion</DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-6 px-6 py-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-6">
                <section className="overflow-hidden rounded-2xl border border-sidebar-border">
                  <div className="border-b border-sidebar-border px-5 py-3">
                    <h2 className="font-semibold text-body-text">Basic Information</h2>
                  </div>
                  <div className="space-y-5 px-5 py-5">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <label className="flex items-center gap-3 rounded-xl border border-sidebar-border px-4 py-3 text-sm">
                        <input
                          type="checkbox"
                          checked={createForm.active}
                          onChange={(event) => setCreateForm((prev) => ({ ...prev, active: event.target.checked }))}
                          className="h-4 w-4 accent-primary"
                        />
                        <span>Active</span>
                      </label>
                      <label className="flex items-center gap-3 rounded-xl border border-sidebar-border px-4 py-3 text-sm">
                        <input
                          type="checkbox"
                          checked={createForm.autoApply}
                          onChange={(event) => setCreateForm((prev) => ({ ...prev, autoApply: event.target.checked }))}
                          className="h-4 w-4 accent-primary"
                        />
                        <span>Auto Apply</span>
                      </label>
                      <label className="flex items-center gap-3 rounded-xl border border-sidebar-border px-4 py-3 text-sm">
                        <input
                          type="checkbox"
                          checked={createForm.canCombine}
                          onChange={(event) => setCreateForm((prev) => ({ ...prev, canCombine: event.target.checked }))}
                          className="h-4 w-4 accent-primary"
                        />
                        <span>Can Combine</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          placeholder="Promotion name"
                          value={createForm.name}
                          onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Code</Label>
                        <Input
                          placeholder="PROMO2026"
                          value={createForm.code}
                          onChange={(event) => setCreateForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
                        />
                      </div>
                    </div>
                  </div>
                </section>
                <section className="overflow-hidden rounded-2xl border border-sidebar-border">
                  <div className="border-b border-sidebar-border px-5 py-3">
                    <h2 className="font-semibold text-body-text">Promotion Type</h2>
                  </div>
                  <div className="space-y-5 px-5 py-5">
                    <div className="space-y-3">
                      <Label>Type</Label>
                      <div className="grid grid-cols-1 gap-3">
                        {PROMOTION_TYPE_OPTIONS.map((option) => (
                          <label
                            key={option.value}
                            className="flex items-center gap-3 rounded-xl border border-sidebar-border px-4 py-3 text-sm"
                          >
                            <input
                              type="radio"
                              name="promotionType"
                              value={option.value}
                              checked={createForm.type === option.value}
                              onChange={() => setCreateForm((prev) => ({ ...prev, type: option.value }))}
                              className="h-4 w-4 accent-primary"
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>{createForm.type === "Percentage" ? "Percentage Value" : "Fixed Amount Value"}</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={createForm.amount}
                        onChange={(event) => setCreateForm((prev) => ({ ...prev, amount: Number(event.target.value) || 0 }))}
                      />
                      <p className="text-xs text-subtle-text">
                        {createForm.type === "Percentage"
                          ? "Enter the discount percent, for example 10 for 10%."
                          : "Enter the discount amount in store currency."}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Input
                        type="number"
                        min={1}
                        step="1"
                        value={createForm.priority}
                        onChange={(event) => setCreateForm((prev) => ({ ...prev, priority: Number(event.target.value) || 1 }))}
                      />
                    </div>
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <section className="overflow-hidden rounded-2xl border border-sidebar-border">
                  <div className="border-b border-sidebar-border px-5 py-3">
                    <h2 className="font-semibold text-body-text">Other Information</h2>
                  </div>
                  <div className="space-y-5 px-5 py-5">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label>Promotion Message (EN)</Label>
                        <textarea
                          value={createForm.messageEn}
                          onChange={(event) => setCreateForm((prev) => ({ ...prev, messageEn: event.target.value }))}
                          className="min-h-28 w-full rounded-md border border-input bg-body-bg px-3 py-2 text-sm text-body-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Start Date</Label>
                          <Input
                            type="date"
                            value={createForm.startDate}
                            onChange={(event) => setCreateForm((prev) => ({ ...prev, startDate: event.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Expiration Date</Label>
                          <Input
                            type="date"
                            value={createForm.expirationDate}
                            onChange={(event) => setCreateForm((prev) => ({ ...prev, expirationDate: event.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
            
          </div>

          {createError ? (
            <div className="mx-6 rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger-fg">
              {createError}
            </div>
          ) : null}

          <DialogFooter className="border-t border-sidebar-border px-6 py-4">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreatePromotion()} disabled={isCreating}>
              {isCreating ? "Saving..." : "Save Promotion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
