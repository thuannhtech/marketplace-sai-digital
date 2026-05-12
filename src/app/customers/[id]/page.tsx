"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import * as mdi from "@mdi/js";
import { Icon } from "@/lib/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  createCustomerAddress,
  deleteCustomerAddress,
  getCustomerDetail,
  updateCustomer,
  updateCustomerAddress,
} from "@/src/app/actions/ordercloud";

function formatDateTime(dateString?: string) {
  if (!dateString) return "N/A";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function InfoRow({
  label,
  value,
  type = "text",
}: {
  label: string;
  value?: string | number | boolean | null;
  type?: "text" | "badge" | "checkbox" | "switch";
}) {
  if (type === "badge") {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
        <p className="text-xs font-semibold text-subtle-text uppercase tracking-wider">{label}</p>
        <div className="sm:col-span-2">
          <Badge colorScheme="neutral">{String(value ?? "N/A")}</Badge>
        </div>
      </div>
    );
  }

  if (type === "checkbox") {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
        <p className="text-xs font-semibold text-subtle-text uppercase tracking-wider">{label}</p>
        <div className="sm:col-span-2 flex items-center gap-3">
          <input
            type="checkbox"
            checked={Boolean(value)}
            disabled
            readOnly
            className="h-4 w-4 accent-primary"
            aria-label={label}
          />
          <span className="text-sm text-subtle-text">{value ? "Yes" : "No"}</span>
        </div>
      </div>
    );
  }

  if (type === "switch") {
    const checked = Boolean(value);
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
        <p className="text-xs font-semibold text-subtle-text uppercase tracking-wider">{label}</p>
        <div className="sm:col-span-2 flex items-center gap-3">
          <Switch checked={checked} disabled aria-label={label} />
          <span className="text-sm text-subtle-text">{checked ? "Yes" : "No"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
      <p className="text-xs font-semibold text-subtle-text uppercase tracking-wider">{label}</p>
      <div className="sm:col-span-2">
        <Input
          value={value === null || value === undefined ? "" : String(value)}
          readOnly
          className="h-9 bg-muted/50 cursor-default focus-visible:ring-0 focus-visible:border-sidebar-border"
        />
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group border border-sidebar-border rounded-md bg-body-bg" open={defaultOpen}>
      <summary className="flex cursor-pointer items-center justify-between bg-muted px-4 py-3 font-semibold text-body-text outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
        {title}
        <Icon
          path={mdi.mdiChevronDown}
          className="h-5 w-5 text-subtle-text transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="space-y-3 p-4 text-sm text-body-text">{children}</div>
    </details>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState({
    firstName: "",
    lastName: "",
    mobileAreaCode: "+614",
    mobile: "",
    companyName: "",
    street1: "",
    saveAs: "Home" as "Home" | "Business",
    useDefaultBilling: false,
    useDefaultShipping: false,
  });

  const [isUpdatingCustomer, setIsUpdatingCustomer] = useState(false);
  const [customerUpdateError, setCustomerUpdateError] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState({
    firstName: "",
    lastName: "",
    mobileNumber: "",
    confirmedEmail: false,
    active: true,
  });

  const fetchCustomer = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await getCustomerDetail(id);
      if (!res.success) {
        setError(res.error || "Failed to fetch customer detail");
        setData(null);
        return;
      }
      setData(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchCustomer();
  }, [fetchCustomer]);

  const customer = data?.customer;
  const groups: any[] = data?.groups || [];
  const addresses: any[] = data?.addresses || [];

  const accountType = customer?.xp?.PersonalInformation?.AccountType ?? "N/A";
  const confirmedEmail = customer?.xp?.PersonalInformation?.IsConfirmedEmail;
  const customerSince = customer?.xp?.DateRegistered;
  const createdIn = customer?.xp?.PurchasedFrom ?? customer?.xp?.CustomerCreatedIn ?? "N/A";

  const customerGroupText = useMemo(() => {
    if (!groups.length) return "N/A";
    return groups
      .map((g) => (g?.Name ? String(g.Name) : g?.ID ? String(g.ID) : "N/A"))
      .filter((v) => v && v !== "N/A")
      .join(", ") || "N/A";
  }, [groups]);

  // Initialize editable customer form once customer is loaded/changed.
  // Must stay above any conditional returns to keep hook order stable.
  useEffect(() => {
    if (!customer) return;
    setCustomerUpdateError(null);
    setCustomerForm({
      firstName: String(customer.FirstName || ""),
      lastName: String(customer.LastName || ""),
      mobileNumber: String(customer?.xp?.PersonalInformation?.MobileNumber || customer.Phone || "").trim(),
      confirmedEmail: Boolean(customer?.xp?.PersonalInformation?.IsConfirmedEmail),
      active: Boolean(customer.Active),
    });
  }, [customer?.ID]);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2 text-subtle-text">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-bg-active border-t-primary" />
        Loading customer details...
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => router.back()}>
          <Icon path={mdi.mdiArrowLeft} className="mr-2 h-4 w-4" />
          Back to Customers
        </Button>
        <div className="p-4 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
          {error || "Customer not found."}
        </div>
      </div>
    );
  }

  const dobMonth = customer?.xp?.PersonalInformation?.DOB?.Month;
  const dobDay = customer?.xp?.PersonalInformation?.DOB?.Day;
  const dobDisplay =
    dobMonth && dobDay ? `${String(dobDay).padStart(2, "0")}/${String(dobMonth).padStart(2, "0")}` : "N/A";

  function resetAddressForm() {
    setEditingAddressId(null);
    setAddressError(null);
    setAddressForm({
      firstName: "",
      lastName: "",
      mobileAreaCode: "+614",
      mobile: "",
      companyName: "",
      street1: "",
      saveAs: "Home",
      useDefaultBilling: false,
      useDefaultShipping: false,
    });
  }

  async function handleUpdateCustomer() {
    if (!id) return;
    setCustomerUpdateError(null);

    if (
      !customerForm.firstName.trim() ||
      !customerForm.lastName.trim() ||
      !customerForm.mobileNumber.trim()
    ) {
      setCustomerUpdateError("First Name, Last Name, and Mobile Number are required.");
      return;
    }

    setIsUpdatingCustomer(true);
    try {
      const res = await updateCustomer(id, {
        firstName: customerForm.firstName.trim(),
        lastName: customerForm.lastName.trim(),
        mobileNumber: customerForm.mobileNumber.trim(),
        confirmedEmail: Boolean(customerForm.confirmedEmail),
        active: Boolean(customerForm.active),
      });

      if (!res.success) {
        setCustomerUpdateError(res.error || "Failed to update customer.");
        return;
      }

      await fetchCustomer();
    } finally {
      setIsUpdatingCustomer(false);
    }
  }

  async function handleSaveAddress() {
    if (!id) return;
    setAddressError(null);

    if (
      !addressForm.firstName.trim() ||
      !addressForm.lastName.trim() ||
      !addressForm.mobileAreaCode.trim() ||
      !addressForm.mobile.trim() ||
      !addressForm.street1.trim()
    ) {
      setAddressError(
        "Please fill all required fields: First Name, Last Name, Mobile, and Address Line 1.",
      );
      return;
    }

    setIsSavingAddress(true);
    try {
      const basePayload = {
        firstName: addressForm.firstName.trim(),
        lastName: addressForm.lastName.trim(),
        mobileAreaCode: addressForm.mobileAreaCode.trim(),
        mobile: addressForm.mobile.trim() || undefined,
        companyName: addressForm.companyName.trim() || undefined,
        street1: addressForm.street1.trim(),
        saveAs: addressForm.saveAs,
        useDefaultBilling: addressForm.useDefaultBilling,
        useDefaultShipping: addressForm.useDefaultShipping,
      };

      const res = editingAddressId
        ? await updateCustomerAddress(id, editingAddressId, basePayload)
        : await createCustomerAddress(id, basePayload);

      if (!res.success) {
        setAddressError(res.error || "Failed to save address.");
        return;
      }

      setEditingAddressId(null);
      setIsAddressDialogOpen(false);
      await fetchCustomer();
    } finally {
      setIsSavingAddress(false);
    }
  }

  function openNewAddressDialog() {
    resetAddressForm();
    setIsAddressDialogOpen(true);
  }

  function openEditAddressDialog(addr: any) {
    const phone: string = String(addr?.Phone || "");
    const areaCodeFromXp = addr?.xp?.MobileAreaCode ? String(addr.xp.MobileAreaCode) : "";
    const fallbackArea = areaCodeFromXp || (phone.startsWith("+") ? phone.slice(0, 4) : "+614");
    const fallbackNumber =
      phone && phone.startsWith(fallbackArea) ? phone.slice(fallbackArea.length) : phone.replace(/^\+\d+/, "");

    setEditingAddressId(String(addr?.ID || ""));
    setAddressError(null);
    setAddressForm({
      firstName: String(addr?.FirstName || ""),
      lastName: String(addr?.LastName || ""),
      mobileAreaCode: fallbackArea,
      mobile: fallbackNumber,
      companyName: String(addr?.CompanyName || ""),
      street1: String(addr?.Street1 || ""),
      saveAs: (addr?.AddressName === "Business" ? "Business" : "Home") as "Home" | "Business",
      useDefaultBilling: Boolean(false),
      useDefaultShipping: Boolean(false),
    });
    setIsAddressDialogOpen(true);
  }

  async function handleDeleteAddress(addressId: string) {
    if (!id) return;
    if (!confirm("Are you sure you want to delete this address?")) return;
    const res = await deleteCustomerAddress(id, addressId);
    if (!res.success) {
      alert(res.error || "Failed to delete address.");
      return;
    }
    await fetchCustomer();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <Icon path={mdi.mdiArrowLeft} className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-body-text flex items-center gap-3">
            Customer Details
          </h1>
          <p className="text-subtle-text">
            {customer?.FirstName || customer?.LastName
              ? `${customer?.FirstName ?? ""} ${customer?.LastName ?? ""}`.trim()
              : customer?.Email}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button onClick={handleUpdateCustomer} disabled={isUpdatingCustomer}>
            {isUpdatingCustomer ? "Updating..." : "Update"}
          </Button>
          <Badge colorScheme={customerForm.active ? "success" : "danger"}>
            {customerForm.active ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>

      {customerUpdateError ? (
        <div className="rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger-fg">
          {customerUpdateError}
        </div>
      ) : null}

      <div className="space-y-4">
        <CollapsibleSection title="Basic Information" defaultOpen>
          <InfoRow label="ID" value={customer.ID} />
          <InfoRow label="Email" value={customer.Email} />
          <InfoRow label="Created Date" value={formatDateTime(customer.DateCreated)} />
          <InfoRow label="Customer Since" value={formatDateTime(customerSince)} />
          <InfoRow label="Customer Created In" value={createdIn} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
            <p className="text-xs font-semibold text-subtle-text uppercase tracking-wider">Confirmed Email</p>
            <div className="sm:col-span-2 flex items-center gap-3">
              <Switch
                checked={Boolean(customerForm.confirmedEmail)}
                onCheckedChange={(checked) => setCustomerForm((p) => ({ ...p, confirmedEmail: checked }))}
                aria-label="Confirmed Email"
              />
              <span className="text-sm text-subtle-text">
                {customerForm.confirmedEmail ? "Yes" : "No"}
              </span>
            </div>
          </div>

          <div className="border-t border-sidebar-border/70 pt-3" />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
            <p className="text-xs font-semibold text-subtle-text uppercase tracking-wider">Status</p>
            <div className="sm:col-span-2 flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="customerStatus"
                  value="Active"
                  checked={customerForm.active === true}
                  onChange={() => setCustomerForm((p) => ({ ...p, active: true }))}
                  className="h-4 w-4 accent-primary"
                />
                <span>Active</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="customerStatus"
                  value="Inactive"
                  checked={customerForm.active === false}
                  onChange={() => setCustomerForm((p) => ({ ...p, active: false }))}
                  className="h-4 w-4 accent-primary"
                />
                <span>Inactive</span>
              </label>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Account Type">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
            <p className="text-xs font-semibold text-subtle-text uppercase tracking-wider">Account Type</p>
            <div className="sm:col-span-2 flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="accountType"
                  value="Personal"
                  checked={accountType === "Personal"}
                  disabled
                  readOnly
                  className="h-4 w-4 accent-primary"
                />
                <span>Personal</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="accountType"
                  value="Business"
                  checked={accountType === "Business"}
                  disabled
                  readOnly
                  className="h-4 w-4 accent-primary"
                />
                <span>Business</span>
              </label>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Personal Information">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
            <p className="text-xs font-semibold text-subtle-text uppercase tracking-wider">
              First Name <span className="text-destructive">*</span>
            </p>
            <div className="sm:col-span-2">
              <Input
                value={customerForm.firstName}
                onChange={(e) => setCustomerForm((p) => ({ ...p, firstName: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
            <p className="text-xs font-semibold text-subtle-text uppercase tracking-wider">
              Last Name <span className="text-destructive">*</span>
            </p>
            <div className="sm:col-span-2">
              <Input
                value={customerForm.lastName}
                onChange={(e) => setCustomerForm((p) => ({ ...p, lastName: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
            <p className="text-xs font-semibold text-subtle-text uppercase tracking-wider">
              Mobile Number <span className="text-destructive">*</span>
            </p>
            <div className="sm:col-span-2">
              <Input
                value={customerForm.mobileNumber}
                onChange={(e) => setCustomerForm((p) => ({ ...p, mobileNumber: e.target.value }))}
              />
            </div>
          </div>
        </CollapsibleSection>
        <CollapsibleSection title={`Addresses (${addresses.length})`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-subtle-text">{addresses.length ? "" : "No addresses found."}</p>
            <Button onClick={openNewAddressDialog}>
              <Icon path={mdi.mdiPlus} className="mr-2 h-4 w-4" />
              Create New Address
            </Button>
          </div>

          {addresses.length ? (
            <div className="space-y-3">
              {addresses.map((addr) => (
                <div key={addr.ID} className="rounded-md border border-sidebar-border bg-muted/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-semibold text-body-text">
                        {[addr.FirstName, addr.LastName].filter(Boolean).join(" ") || "N/A"}
                      </p>
                      <p className="text-sm text-subtle-text">{addr.Phone || "N/A"}</p>
                      <p className="text-sm text-subtle-text">
                        {[addr.Street1, addr.City, addr.State, addr.Zip].filter(Boolean).join(", ") || "N/A"}
                      </p>
                      <p className="pt-2 text-sm font-medium text-body-text">{addr.AddressName || "Home Address"}</p>
                      <p className="font-mono text-[11px] text-subtle-text">{addr.ID}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditAddressDialog(addr)}>
                        <Icon path={mdi.mdiPencil} className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        colorScheme="danger"
                        onClick={() => handleDeleteAddress(String(addr.ID))}
                      >
                        <Icon path={mdi.mdiTrashCanOutline} className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CollapsibleSection>
      </div>

      <Dialog
        open={isAddressDialogOpen}
        onOpenChange={(open) => {
          setIsAddressDialogOpen(open);
          if (!open) {
            resetAddressForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAddressId ? "Edit customer address" : "Create or edit customer address"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                required
                value={addressForm.firstName}
                onChange={(e) => setAddressForm((p) => ({ ...p, firstName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                required
                value={addressForm.lastName}
                onChange={(e) => setAddressForm((p) => ({ ...p, lastName: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>
                Mobile <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  className="w-24"
                  required
                  value={addressForm.mobileAreaCode}
                  onChange={(e) => setAddressForm((p) => ({ ...p, mobileAreaCode: e.target.value }))}
                />
                <Input
                  className="flex-1"
                  required
                  value={addressForm.mobile}
                  onChange={(e) => setAddressForm((p) => ({ ...p, mobile: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={addressForm.companyName}
                onChange={(e) => setAddressForm((p) => ({ ...p, companyName: e.target.value }))}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>
                Street <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Address Search and Address Line 1"
                required
                value={addressForm.street1}
                onChange={(e) => setAddressForm((p) => ({ ...p, street1: e.target.value }))}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Save Address As</Label>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="saveAs"
                    value="Home"
                    checked={addressForm.saveAs === "Home"}
                    onChange={() => setAddressForm((p) => ({ ...p, saveAs: "Home" }))}
                    className="h-4 w-4 accent-primary"
                  />
                  <span>Home</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="saveAs"
                    value="Business"
                    checked={addressForm.saveAs === "Business"}
                    onChange={() => setAddressForm((p) => ({ ...p, saveAs: "Business" }))}
                    className="h-4 w-4 accent-primary"
                  />
                  <span>Business</span>
                </label>
              </div>
            </div>

            <div className="space-y-3 sm:col-span-2">
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={addressForm.useDefaultBilling}
                  onChange={(e) => setAddressForm((p) => ({ ...p, useDefaultBilling: e.target.checked }))}
                  className="h-4 w-4 accent-primary"
                />
                <span>Use as my default billing address</span>
              </label>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={addressForm.useDefaultShipping}
                  onChange={(e) => setAddressForm((p) => ({ ...p, useDefaultShipping: e.target.checked }))}
                  className="h-4 w-4 accent-primary"
                />
                <span>Use as my default shipping address</span>
              </label>
            </div>
          </div>

          {addressError ? (
            <div className="rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger-fg">
              {addressError}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddressDialogOpen(false)}
              disabled={isSavingAddress}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveAddress} disabled={isSavingAddress}>
              {isSavingAddress ? "Saving..." : "Save Address"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex justify-end">
        <Button variant="outline" onClick={fetchCustomer}>
          <Icon path={mdi.mdiRefresh} className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>
    </div>
  );
}

