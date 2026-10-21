"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Icon } from "@/lib/icon";
import * as mdi from "@mdi/js";
import {
  AdminUserItem,
  CreateAdminUserPayload,
  UpdateAdminUserPayload,
} from "@/src/lib/auth/auth-types";
import {
  ALL_ORDERCLOUD_ROLES,
  ROLE_CATEGORIES,
  ROLE_PRESETS,
  getUserPresetNames,
  RolePreset,
} from "@/src/lib/auth/roles-config";
import {
  getAdminUsersAction,
  createAdminUserAction,
  updateAdminUserAction,
  deleteAdminUserAction,
  getUserSecurityProfileRolesAction,
} from "@/src/app/actions/admin-users";
import { useAuth } from "@/src/hooks/use-auth";

export default function AdminUsersPage() {
  const { isSuperAdmin, user: currentUser } = useAuth();

  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Create User Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createModalError, setCreateModalError] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createForm, setCreateForm] = useState<CreateAdminUserPayload>({
    Username: "",
    Password: "",
    FirstName: "",
    LastName: "",
    Email: "",
    Active: true,
    Roles: [],
  });

  // Update User Modal state
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateModalError, setUpdateModalError] = useState("");
  const [updateForm, setUpdateForm] = useState<UpdateAdminUserPayload>({
    ID: "",
    Username: "",
    Password: "",
    FirstName: "",
    LastName: "",
    Email: "",
    Active: true,
    Roles: [],
  });

  // Delete User Modal state
  const [pendingDeleteUser, setPendingDeleteUser] = useState<AdminUserItem | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState("");

  // Role filtering states (for advanced 77 roles directory)
  const [roleSearch, setRoleSearch] = useState("");
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>("All");
  const [showAdvancedRoles, setShowAdvancedRoles] = useState(false);

  // Load Admin Users from /v1/adminusers
  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const res = await getAdminUsersAction();
      if (res.success && res.users) {
        setUsers(res.users);
      } else {
        setErrorMessage(res.error || "Failed to load Admin Users list.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred while fetching data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Filter users by search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.Username?.toLowerCase().includes(q) ||
        u.FirstName?.toLowerCase().includes(q) ||
        u.LastName?.toLowerCase().includes(q) ||
        u.Email?.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const handleOpenUpdateModal = async (u: AdminUserItem) => {
    setUpdateModalError("");
    setErrorMessage("");
    setSuccessMessage("");
    setRoleSearch("");
    setSelectedCategoryTab("All");
    setShowAdvancedRoles(false);

    const mergedRoles = Array.from(new Set([
      ...(u.Roles || []),
      ...(u.xp?.Roles || []),
    ]));

    setUpdateForm({
      ID: u.ID,
      Username: u.Username,
      Password: "",
      FirstName: u.FirstName || "",
      LastName: u.LastName || "",
      Email: u.Email || "",
      Active: u.Active,
      Roles: mergedRoles,
      xp: u.xp,
    });
    setIsUpdateOpen(true);
  };

  // Check if a preset is active strictly by its xpRole
  const isPresetActive = (preset: RolePreset, roles: string[]) => {
    return roles.includes(preset.xpRole);
  };

  // Toggle a role preset for Create or Update form
  const handleTogglePreset = (preset: RolePreset, target: "create" | "update") => {
    const rolesToRemove = [preset.xpRole, ...preset.roles];
    const rolesToAdd = [preset.xpRole, ...preset.roles];

    if (target === "create") {
      const active = isPresetActive(preset, createForm.Roles);
      if (active) {
        setCreateForm((prev) => ({
          ...prev,
          Roles: prev.Roles.filter((r) => !rolesToRemove.includes(r)),
        }));
      } else {
        if (preset.id === "super_admin") {
          setCreateForm((prev) => ({ ...prev, Roles: ["SUPPER_ADMIN", "FullAccess"] }));
        } else {
          setCreateForm((prev) => {
            const next = prev.Roles.filter((r) => r !== "SUPPER_ADMIN" && r !== "FullAccess");
            return {
              ...prev,
              Roles: Array.from(new Set([...next, ...rolesToAdd])),
            };
          });
        }
      }
    } else {
      const active = isPresetActive(preset, updateForm.Roles);
      if (active) {
        setUpdateForm((prev) => ({
          ...prev,
          Roles: prev.Roles.filter((r) => !rolesToRemove.includes(r)),
        }));
      } else {
        if (preset.id === "super_admin") {
          setUpdateForm((prev) => ({ ...prev, Roles: ["SUPPER_ADMIN", "FullAccess"] }));
        } else {
          setUpdateForm((prev) => {
            const next = prev.Roles.filter((r) => r !== "SUPPER_ADMIN" && r !== "FullAccess");
            return {
              ...prev,
              Roles: Array.from(new Set([...next, ...rolesToAdd])),
            };
          });
        }
      }
    }
  };

  // Toggle individual role in Update modal
  const handleToggleUpdateRole = (role: string) => {
    setUpdateForm((prev) => {
      const roles = prev.Roles.includes(role)
        ? prev.Roles.filter((r) => r !== role)
        : [...prev.Roles, role];
      return { ...prev, Roles: roles };
    });
  };

  // Quick select: All Readers
  const handleSelectAllReaders = () => {
    const readerRoles = ALL_ORDERCLOUD_ROLES.filter((r) => r.endsWith("Reader") || r === "Shopper");
    setUpdateForm((prev) => ({
      ...prev,
      Roles: Array.from(new Set([...prev.Roles.filter((r) => r !== "FullAccess"), ...readerRoles])),
    }));
  };

  // Quick select: All Admins (Writers)
  const handleSelectAllAdmins = () => {
    const adminRoles = ALL_ORDERCLOUD_ROLES.filter((r) => r.endsWith("Admin"));
    setUpdateForm((prev) => ({
      ...prev,
      Roles: Array.from(new Set([...prev.Roles.filter((r) => r !== "FullAccess"), ...adminRoles])),
    }));
  };

  // Clear all roles in Update modal
  const handleClearAllUpdateRoles = () => {
    setUpdateForm((prev) => ({ ...prev, Roles: [] }));
  };

  // Open confirmation modal to delete an Admin User
  const handleOpenDeleteConfirm = (u: AdminUserItem) => {
    if (currentUser?.username && u.Username === currentUser.username) {
      setErrorMessage("You cannot delete your own account.");
      return;
    }
    setDeleteModalError("");
    setPendingDeleteUser(u);
    setIsDeleteConfirmOpen(true);
  };

  // Confirm delete Admin User from OrderCloud
  const handleConfirmDelete = async () => {
    if (!pendingDeleteUser) return;
    setIsDeleting(true);
    setDeleteModalError("");
    try {
      const res = await deleteAdminUserAction(pendingDeleteUser.ID);
      if (res.success) {
        setIsDeleteConfirmOpen(false);
        setPendingDeleteUser(null);
        setSuccessMessage(`Admin user @${pendingDeleteUser.Username} was deleted successfully.`);
        setTimeout(() => setSuccessMessage(""), 4000);
        await loadUsers();
      } else {
        setDeleteModalError(res.error || "Failed to delete user.");
      }
    } catch (err: any) {
      setDeleteModalError(err.message || "An unexpected error occurred while deleting user.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Submit Update Admin User
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateModalError("");
    if (!updateForm.FirstName || !updateForm.LastName || !updateForm.Email) {
      setUpdateModalError("Please fill out all required fields.");
      return;
    }

    setIsUpdating(true);

    try {
      const res = await updateAdminUserAction(updateForm);
      if (!res.success) {
        setUpdateModalError(res.error || "Failed to update Admin User.");
        setIsUpdating(false);
        return;
      }

      setSuccessMessage(`Admin User @${updateForm.Username} updated successfully!`);
      setTimeout(() => setSuccessMessage(""), 4000);

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.ID === updateForm.ID
            ? {
              ...u,
              FirstName: updateForm.FirstName,
              LastName: updateForm.LastName,
              Email: updateForm.Email,
              Active: updateForm.Active,
              Roles: updateForm.Roles,
            }
            : u
        )
      );
      setIsUpdateOpen(false);
    } catch (err: any) {
      setUpdateModalError(err.message || "An error occurred while updating user.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Create new Admin User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateModalError("");
    if (
      !createForm.Username.trim() ||
      !createForm.FirstName.trim() ||
      !createForm.LastName.trim() ||
      !createForm.Email.trim() ||
      !createForm.Password.trim()
    ) {
      setCreateModalError("Please fill out all required fields, including Password.");
      return;
    }

    setIsCreating(true);

    try {
      const res = await createAdminUserAction(createForm);
      if (!res.success) {
        setCreateModalError(res.error || "Failed to create Admin User.");
        setIsCreating(false);
        return;
      }

      setSuccessMessage(`Admin User @${createForm.Username} created successfully!`);
      setTimeout(() => setSuccessMessage(""), 4000);

      setIsCreateOpen(false);
      setCreateForm({
        Username: "",
        Password: "",
        FirstName: "",
        LastName: "",
        Email: "",
        Active: true,
        Roles: [],
      });
      loadUsers();
    } catch (err: any) {
      setCreateModalError(err.message || "An error occurred while creating user.");
    } finally {
      setIsCreating(false);
    }
  };

  // Filter 77 roles by search query and category tab
  const displayedRoles = useMemo(() => {
    let pool: readonly string[] = ALL_ORDERCLOUD_ROLES;

    if (selectedCategoryTab !== "All") {
      const cat = ROLE_CATEGORIES.find((c) => c.name === selectedCategoryTab);
      pool = cat ? cat.roles : ALL_ORDERCLOUD_ROLES;
    }

    if (roleSearch.trim()) {
      const q = roleSearch.toLowerCase();
      pool = pool.filter((r) => r.toLowerCase().includes(q));
    }

    return pool;
  }, [selectedCategoryTab, roleSearch]);

  // Group presets by category
  const groupedPresets = useMemo(() => {
    const categories: Array<{
      category: string;
      icon: string;
      presets: RolePreset[];
    }> = [
        {
          category: "Customers",
          icon: mdi.mdiAccountGroupOutline,
          presets: ROLE_PRESETS.filter((p) => p.category === "Customers"),
        },
        {
          category: "Products",
          icon: mdi.mdiPackageVariantClosed,
          presets: ROLE_PRESETS.filter((p) => p.category === "Products"),
        },
        {
          category: "Orders",
          icon: mdi.mdiClipboardListOutline,
          presets: ROLE_PRESETS.filter((p) => p.category === "Orders"),
        },
        {
          category: "Promotions",
          icon: mdi.mdiTicketPercentOutline,
          presets: ROLE_PRESETS.filter((p) => p.category === "Promotions"),
        },
        {
          category: "Tax / GST",
          icon: mdi.mdiReceiptTextOutline,
          presets: ROLE_PRESETS.filter((p) => p.category === "Tax / GST"),
        },
        {
          category: "Super Admin",
          icon: mdi.mdiCrownOutline,
          presets: ROLE_PRESETS.filter((p) => p.category === "Super Admin"),
        },
      ];
    return categories;
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 font-heading">
              Admin Users & Role Management
            </h1>
            <Badge className="bg-purple-600 text-white font-medium">Super Admin</Badge>
          </div>
        </div>

        <Button
          onClick={() => {
            setShowCreatePassword(false);
            setCreateModalError("");
            setCreateForm({
              Username: "",
              Password: "",
              FirstName: "",
              LastName: "",
              Email: "",
              Active: true,
              Roles: [],
            });
            setIsCreateOpen(true);
          }}
          className="gap-2 shrink-0 shadow-sm cursor-pointer"
        >
          <Icon path={mdi.mdiAccountPlus} className="h-4 w-4" />
          Create Admin User
        </Button>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-4 text-success text-sm animate-in fade-in">
          <Icon path={mdi.mdiCheckCircleOutline} className="h-5 w-5 shrink-0" />
          <p className="font-medium">{successMessage}</p>
        </div>
      )}

      {/* Error Notification */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 p-4 text-danger text-sm animate-in fade-in">
          <Icon path={mdi.mdiAlertCircleOutline} className="h-5 w-5 shrink-0" />
          <p className="font-medium">{errorMessage}</p>
        </div>
      )}

      {/* Users Table Card */}
      <Card className="border border-border/80 shadow-sm bg-surface">
        <CardHeader className="p-4 sm:p-6 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-semibold text-neutral-900">
                Admin Users List ({filteredUsers.length})
              </CardTitle>
              <CardDescription className="text-xs text-subtle-text">
                Administrative users filtered
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-72">
              <Icon
                path={mdi.mdiMagnify}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-subtle-text"
              />
              <Input
                placeholder="Search by username, name, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-subtle-text">
              <Icon path={mdi.mdiLoading} className="h-8 w-8 animate-spin mx-auto text-primary mb-2" />
              <p className="text-sm">Loading Admin Users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-subtle-text">
              <Icon path={mdi.mdiAccountOffOutline} className="h-10 w-10 mx-auto text-neutral-400 mb-2" />
              <p className="text-sm">No Admin Users found matching your search.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-neutral-50/75 text-xs text-subtle-text font-semibold uppercase tracking-wider">
                    <th className="px-6 py-3.5">Admin User</th>
                    <th className="px-6 py-3.5">Email</th>
                    <th className="px-6 py-3.5">Active</th>
                    <th className="px-6 py-3.5">Assigned Roles & Presets</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map((u) => {
                    const presetNames = getUserPresetNames(u.Roles, u.xp?.Roles);
                    const roleCount = u.Roles?.length || 0;
                    const isSuper =
                      u.Roles?.includes("FullAccess") ||
                      u.Roles?.includes("ADMIN_GLOBAL") ||
                      u.xp?.Roles?.includes("ADMIN_GLOBAL");

                    return (
                      <tr key={u.ID} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                              {u.FirstName ? u.FirstName[0].toUpperCase() : u.Username[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-neutral-900 flex items-center gap-2">
                                <span>{u.FirstName && u.LastName ? `${u.FirstName} ${u.LastName}` : u.Username}</span>
                                {isSuper && (
                                  <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] font-semibold py-0">
                                    Super Admin
                                  </Badge>
                                )}
                                {u.xp?.Country && (
                                  <Badge colorScheme="primary" className="text-[10px] py-0 font-medium">
                                    {u.xp.Country}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-subtle-text">@{u.Username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-neutral-600">{u.Email || "—"}</td>
                        <td className="px-6 py-4">
                          {u.Active ? (
                            <Badge colorScheme="success" className="font-medium">
                              Active
                            </Badge>
                          ) : (
                            <Badge colorScheme="neutral" className="text-neutral-500 font-medium">
                              Inactive
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 flex-wrap max-w-md">
                            {presetNames.map((name) => {
                              const isEditor = name.includes("Editor");
                              const isApprover = name.includes("Approver");
                              const isSuperPreset = name === "Super Admin";

                              return (
                                <span
                                  key={name}
                                  className={`text-xs px-2.5 py-0.5 rounded-full font-medium border flex items-center gap-1 ${isSuperPreset
                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                    : isEditor
                                      ? "bg-primary/10 text-primary border-primary/20 font-semibold"
                                      : isApprover
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold"
                                        : "bg-sky-50 text-sky-700 border-sky-200"
                                    }`}
                                >
                                  {isSuperPreset && <Icon path={mdi.mdiCrownOutline} className="h-3 w-3" />}
                                  {isEditor && <Icon path={mdi.mdiPencilOutline} className="h-3 w-3" />}
                                  {isApprover && <Icon path={mdi.mdiClipboardCheckOutline} className="h-3 w-3" />}
                                  {!isEditor && !isSuperPreset && !isApprover && <Icon path={mdi.mdiEyeOutline} className="h-3 w-3" />}
                                  {name}
                                </span>
                              );
                            })}

                            {presetNames.length === 0 && roleCount > 0 && (
                              <Badge colorScheme="neutral" className="text-xs font-medium">
                                Custom ({roleCount} roles)
                              </Badge>
                            )}

                            {roleCount === 0 && (
                              <span className="text-xs text-subtle-text italic">No roles assigned</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenUpdateModal(u)}
                              className="gap-1.5 h-8 text-xs font-medium cursor-pointer"
                            >
                              <Icon path={mdi.mdiPencilOutline} className="h-3.5 w-3.5 text-primary" />
                              Update
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={currentUser?.username === u.Username}
                              onClick={() => handleOpenDeleteConfirm(u)}
                              className="gap-1.5 h-8 text-xs font-medium cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 disabled:opacity-40 disabled:cursor-not-allowed"
                              title={currentUser?.username === u.Username ? "You cannot delete your own account" : "Delete user"}
                            >
                              <Icon path={mdi.mdiTrashCanOutline} className="h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL: UPDATE ADMIN USER (Includes User Info, Active Status & Roles) */}
      <Dialog open={isUpdateOpen} onOpenChange={setIsUpdateOpen}>
        <DialogContent className="w-[96vw] max-w-6xl xl:max-w-7xl h-[88vh] max-h-[900px] flex flex-col p-0 overflow-hidden bg-white rounded-xl shadow-2xl">
          {/* Header */}
          <DialogHeader className="p-6 pb-4 border-b border-border shrink-0 bg-neutral-50/60">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {updateForm.FirstName ? updateForm.FirstName[0].toUpperCase() : updateForm.Username[0]?.toUpperCase()}
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2 text-neutral-900">
                    Update Admin User: @{updateForm.Username}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-subtle-text mt-0.5">
                    Modify profile details, active status, and page permissions
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-3 sm:text-right">
                <div className="flex flex-col items-end">
                  <span className="text-xs text-subtle-text">Active Permissions:</span>
                  <Badge className="bg-primary text-white font-mono text-xs px-2.5 py-0.5 mt-0.5">
                    {updateForm.Roles.length} / {ALL_ORDERCLOUD_ROLES.length} roles
                  </Badge>
                </div>
              </div>
            </div>

            {/* Active Presets Summary */}
            <div className="flex items-center gap-1.5 flex-wrap pt-3">
              <span className="text-xs font-semibold text-neutral-600 mr-1">Active Presets:</span>
              {getUserPresetNames(updateForm.Roles).length > 0 ? (
                getUserPresetNames(updateForm.Roles).map((name) => (
                  <Badge
                    key={name}
                    colorScheme={name.includes("Editor") ? "primary" : name === "Super Admin" ? "primary" : "neutral"}
                    className="text-xs font-medium"
                  >
                    {name}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-subtle-text italic">
                  {updateForm.Roles.length > 0 ? "Custom permission combination" : "No permissions selected"}
                </span>
              )}
            </div>
          </DialogHeader>

          {/* Body Form */}
          <form onSubmit={handleUpdateUser} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Modal Error Alert */}
              {updateModalError && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900 text-xs shadow-xs animate-in fade-in">
                  <Icon path={mdi.mdiAlertCircle} className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="font-semibold text-rose-800 text-sm">Failed to update user</p>
                    <p className="text-rose-700 leading-relaxed font-medium">{updateModalError}</p>
                    {updateModalError.toLowerCase().includes("password") && (
                      <div className="mt-2.5 p-3 rounded-lg bg-white/90 border border-rose-200 text-neutral-700 text-xs space-y-1">
                        <p className="font-semibold text-neutral-800">Password Security Requirements:</p>
                        <ul className="list-disc list-inside space-y-0.5 text-neutral-600">
                          <li>At least 8 characters in length</li>
                          <li>Contains at least 1 uppercase letter (A-Z) and 1 lowercase letter (a-z)</li>
                          <li>Contains at least 1 number (0-9) or special character (!@#$%^&*)</li>
                        </ul>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setUpdateModalError("")}
                    className="text-rose-400 hover:text-rose-700 p-1 cursor-pointer"
                  >
                    <Icon path={mdi.mdiClose} className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* SECTION 1: USER ACCOUNT INFORMATION & STATUS */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 border-b border-border pb-1.5 flex items-center gap-1.5">
                  <Icon path={mdi.mdiAccountOutline} className="h-4 w-4 text-primary" />
                  Account Information & Status
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700" htmlFor="update-first-name">
                      First Name <span className="text-danger">*</span>
                    </label>
                    <Input
                      id="update-first-name"
                      placeholder="e.g. Alex"
                      value={updateForm.FirstName}
                      onChange={(e) => setUpdateForm({ ...updateForm, FirstName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700" htmlFor="update-last-name">
                      Last Name <span className="text-danger">*</span>
                    </label>
                    <Input
                      id="update-last-name"
                      placeholder="e.g. Morgan"
                      value={updateForm.LastName}
                      onChange={(e) => setUpdateForm({ ...updateForm, LastName: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700" htmlFor="update-username">
                      Username (Immutable)
                    </label>
                    <Input
                      id="update-username"
                      value={updateForm.Username}
                      disabled
                      className="bg-neutral-100 text-neutral-500 cursor-not-allowed font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700" htmlFor="update-email">
                      Email Address <span className="text-danger">*</span>
                    </label>
                    <Input
                      id="update-email"
                      type="email"
                      placeholder="alex.admin@example.com"
                      value={updateForm.Email}
                      onChange={(e) => setUpdateForm({ ...updateForm, Email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  {/* Active Account Switch */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700" htmlFor="update-active">
                      Active Account
                    </label>
                    <div className="flex items-center justify-between p-2.5 px-3.5 rounded-lg border border-border bg-neutral-50/70 hover:bg-neutral-100/70 transition-colors h-[38px]">
                      <label htmlFor="update-active" className="flex items-center gap-2 cursor-pointer flex-1 select-none">
                        {updateForm.Active ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500">
                            <span className="h-2 w-2 rounded-full bg-neutral-400"></span>
                            Inactive
                          </span>
                        )}
                      </label>
                      <Switch
                        id="update-active"
                        checked={Boolean(updateForm.Active)}
                        onCheckedChange={(checked) => setUpdateForm((prev) => ({ ...prev, Active: checked }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: PAGE-LEVEL ROLE PRESETS */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                      <Icon path={mdi.mdiShieldCheckOutline} className="h-4 w-4 text-primary" />
                      Role Presets by Page & Module
                    </h3>
                    <p className="text-xs text-subtle-text mt-0.5">
                      Toggle read-only or full editor permissions for each main section
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
                  {groupedPresets.map((group) => (
                    <div
                      key={group.category}
                      className="p-4 rounded-xl border border-border bg-neutral-50/50 flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                        <Icon path={group.icon} className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-bold text-xs uppercase tracking-wider text-neutral-800">
                          {group.category}
                        </span>
                      </div>

                      <div className="space-y-2 flex-1">
                        {group.presets.map((preset) => {
                          const active = isPresetActive(preset, updateForm.Roles);
                          const isEditor = preset.type === "admin";
                          const isApprover = preset.type === "approver";
                          const isSuper = preset.id === "super_admin";

                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => handleTogglePreset(preset, "update")}
                              className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all cursor-pointer flex flex-col gap-1 ${active
                                ? isSuper
                                  ? "border-purple-500 bg-purple-50 text-purple-900 ring-2 ring-purple-200 font-semibold shadow-xs"
                                  : isEditor
                                    ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20 font-semibold shadow-xs"
                                    : isApprover
                                      ? "border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-200 font-semibold shadow-xs"
                                      : "border-sky-500 bg-sky-50 text-sky-900 ring-2 ring-sky-200 font-semibold shadow-xs"
                                : "border-border bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
                                }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold flex items-center gap-1.5 truncate">
                                  {isSuper && (
                                    <Icon path={mdi.mdiCrownOutline} className="h-3.5 w-3.5 text-amber-500" />
                                  )}
                                  {!isSuper && isEditor && (
                                    <Icon path={mdi.mdiPencilOutline} className="h-3.5 w-3.5 text-primary" />
                                  )}
                                  {!isSuper && isApprover && (
                                    <Icon path={mdi.mdiClipboardCheckOutline} className="h-3.5 w-3.5 text-emerald-600" />
                                  )}
                                  {!isSuper && !isEditor && !isApprover && (
                                    <Icon path={mdi.mdiEyeOutline} className="h-3.5 w-3.5 text-sky-600" />
                                  )}
                                  <span className="truncate">{preset.name}</span>
                                </span>
                                <div
                                  className={`h-4 w-4 rounded flex items-center justify-center shrink-0 border ${active
                                    ? "bg-primary border-primary text-white"
                                    : "border-neutral-300 bg-white"
                                    }`}
                                >
                                  {active && <Icon path={mdi.mdiCheck} className="h-3 w-3" />}
                                </div>
                              </div>
                              <span className="text-[10px] text-subtle-text line-clamp-2">
                                {preset.description}
                              </span>
                              <span className="text-[10px] font-mono text-neutral-400 mt-0.5">
                                {preset.roles.length} roles
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>


            </div>

            {/* Footer */}
            <DialogFooter className="p-5 px-6 border-t border-border flex items-center justify-between gap-4 bg-neutral-50/70 shrink-0">
              <div className="text-xs text-subtle-text">
                User: <strong className="text-neutral-900 font-semibold">@{updateForm.Username}</strong> ({updateForm.Roles.length} roles)
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsUpdateOpen(false)}
                  disabled={isUpdating}
                  className="cursor-pointer px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isUpdating}
                  className="gap-2 cursor-pointer shadow-sm px-5"
                >
                  {isUpdating ? (
                    <>
                      <Icon path={mdi.mdiLoading} className="h-4 w-4 animate-spin" />
                      Saving Changes...
                    </>
                  ) : (
                    <>
                      <Icon path={mdi.mdiContentSaveCheckOutline} className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: CREATE ADMIN USER */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="w-[94vw] max-w-4xl p-0 overflow-hidden flex flex-col max-h-[92vh] bg-white rounded-xl shadow-2xl">
          <DialogHeader className="p-6 pb-4 border-b border-border bg-neutral-50/60 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Icon path={mdi.mdiAccountPlusOutline} className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-neutral-900">
                  Create New Admin User
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1 max-h-[calc(92vh-140px)]">
              {/* Modal Error Alert */}
              {createModalError && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900 text-xs shadow-xs animate-in fade-in">
                  <Icon path={mdi.mdiAlertCircle} className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="font-semibold text-rose-800 text-sm">Failed to create user</p>
                    <p className="text-rose-700 leading-relaxed font-medium">{createModalError}</p>
                    {createModalError.toLowerCase().includes("password") && (
                      <div className="mt-2.5 p-3 rounded-lg bg-white/90 border border-rose-200 text-neutral-700 text-xs space-y-1">
                        <p className="font-semibold text-neutral-800">Password Security Requirements:</p>
                        <ul className="list-disc list-inside space-y-0.5 text-neutral-600">
                          <li>At least 8 characters in length</li>
                          <li>Contains at least 1 uppercase letter (A-Z) and 1 lowercase letter (a-z)</li>
                          <li>Contains at least 1 number (0-9) or special character (!@#$%^&*)</li>
                        </ul>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreateModalError("")}
                    className="text-rose-400 hover:text-rose-700 p-1 cursor-pointer"
                  >
                    <Icon path={mdi.mdiClose} className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Account Details */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 border-b border-border pb-1.5">
                  User Account Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700" htmlFor="new-first-name">
                      First Name <span className="text-danger">*</span>
                    </label>
                    <Input
                      id="new-first-name"
                      placeholder="e.g. Alex"
                      value={createForm.FirstName}
                      onChange={(e) => setCreateForm({ ...createForm, FirstName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700" htmlFor="new-last-name">
                      Last Name <span className="text-danger">*</span>
                    </label>
                    <Input
                      id="new-last-name"
                      placeholder="e.g. Morgan"
                      value={createForm.LastName}
                      onChange={(e) => setCreateForm({ ...createForm, LastName: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700" htmlFor="new-username">
                      Username <span className="text-danger">*</span>
                    </label>
                    <Input
                      id="new-username"
                      placeholder="e.g. alex_admin"
                      value={createForm.Username}
                      onChange={(e) => setCreateForm({ ...createForm, Username: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700" htmlFor="new-email">
                      Email Address <span className="text-danger">*</span>
                    </label>
                    <Input
                      id="new-email"
                      type="email"
                      placeholder="alex.admin@example.com"
                      value={createForm.Email}
                      onChange={(e) => setCreateForm({ ...createForm, Email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  {/* Password with toggle - MANDATORY */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700" htmlFor="new-password">
                      Password <span className="text-danger font-bold">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showCreatePassword ? "text" : "password"}
                        placeholder="Enter password..."
                        value={createForm.Password}
                        onChange={(e) => setCreateForm({ ...createForm, Password: e.target.value })}
                        className="pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCreatePassword(!showCreatePassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-800 transition-colors cursor-pointer"
                        tabIndex={-1}
                      >
                        <Icon
                          path={showCreatePassword ? mdi.mdiEyeOffOutline : mdi.mdiEyeOutline}
                          className="h-4 w-4"
                        />
                      </button>
                    </div>
                    <p className="text-[11px] text-subtle-text">
                      Password is required for creating this user account.
                    </p>
                  </div>

                  {/* Active Account Switch */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700" htmlFor="new-active">
                      Active Account
                    </label>
                    <div className="flex items-center justify-between p-2.5 px-3.5 rounded-lg border border-border bg-neutral-50/70 hover:bg-neutral-100/70 transition-colors h-[38px]">
                      <label htmlFor="new-active" className="flex items-center gap-2 cursor-pointer flex-1 select-none">
                        {createForm.Active ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500">
                            <span className="h-2 w-2 rounded-full bg-neutral-400"></span>
                            Inactive
                          </span>
                        )}
                      </label>
                      <Switch
                        id="new-active"
                        checked={Boolean(createForm.Active)}
                        onCheckedChange={(checked) => setCreateForm((prev) => ({ ...prev, Active: checked }))}
                      />
                    </div>
                    <p className="text-[11px] text-subtle-text">
                      {createForm.Active ? "User can sign in immediately" : "User sign in will be disabled"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Page Role Presets */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-border pb-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Assign Page Permissions (Role Presets)
                  </h3>
                  <span className="text-[11px] text-subtle-text">
                    {createForm.Roles.length} roles selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {ROLE_PRESETS.map((preset) => {
                    const active = isPresetActive(preset, createForm.Roles);
                    const isEditor = preset.type === "admin";
                    const isApprover = preset.type === "approver";
                    const isSuper = preset.id === "super_admin";

                    return (
                      <div
                        key={preset.id}
                        onClick={() => handleTogglePreset(preset, "create")}
                        className={`p-3 rounded-lg border text-xs cursor-pointer select-none transition-all flex flex-col justify-between ${active
                          ? isSuper
                            ? "border-purple-500 bg-purple-50 text-purple-900 ring-2 ring-purple-200 shadow-xs"
                            : isEditor
                              ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20 shadow-xs"
                              : isApprover
                                ? "border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-200 shadow-xs"
                                : "border-sky-500 bg-sky-50 text-sky-900 ring-2 ring-sky-200 shadow-xs"
                          : "border-border hover:border-neutral-300 hover:bg-neutral-50 bg-white"
                          }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-neutral-900 flex items-center gap-1.5 truncate">
                            {isSuper && <Icon path={mdi.mdiCrownOutline} className="h-3.5 w-3.5 text-amber-500" />}
                            {!isSuper && isEditor && (
                              <Icon path={mdi.mdiPencilOutline} className="h-3.5 w-3.5 text-primary" />
                            )}
                            {!isSuper && isApprover && (
                              <Icon path={mdi.mdiClipboardCheckOutline} className="h-3.5 w-3.5 text-emerald-600" />
                            )}
                            {!isSuper && !isEditor && !isApprover && (
                              <Icon path={mdi.mdiEyeOutline} className="h-3.5 w-3.5 text-sky-600" />
                            )}
                            <span className="truncate">{preset.name}</span>
                          </span>
                          <div
                            className={`h-4 w-4 rounded flex items-center justify-center shrink-0 border ${active ? "bg-primary border-primary text-white" : "border-neutral-300 bg-white"
                              }`}
                          >
                            {active && <Icon path={mdi.mdiCheck} className="h-3 w-3" />}
                          </div>
                        </div>
                        <p className="text-[11px] text-subtle-text mt-1 line-clamp-2">
                          {preset.description}
                        </p>
                        <span className="text-[10px] text-neutral-400 font-mono mt-1">
                          {preset.roles.length} roles
                        </span>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[11px] text-subtle-text mt-1">
                  You can click multiple presets (e.g. Customer Editor + Order Read Only) or fine-tune permissions anytime via &ldquo;Update&rdquo;.
                </p>
              </div>
            </div>

            {/* Footer */}
            <DialogFooter className="p-5 px-6 border-t border-border flex items-center justify-end gap-3 bg-neutral-50/70 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="cursor-pointer px-4"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating} className="cursor-pointer gap-2 shadow-sm px-5">
                {isCreating ? (
                  <>
                    <Icon path={mdi.mdiLoading} className="h-4 w-4 animate-spin" />
                    Creating User...
                  </>
                ) : (
                  <>
                    <Icon path={mdi.mdiAccountPlus} className="h-4 w-4" />
                    Create Admin User
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: DELETE ADMIN USER CONFIRMATION */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md bg-white p-6 rounded-2xl shadow-2xl border border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-neutral-900 flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <Icon path={mdi.mdiAlertCircleOutline} className="h-5 w-5" />
              </div>
              Delete Admin User
            </DialogTitle>
            <DialogDescription className="mt-3 text-sm text-subtle-text leading-relaxed">
              Are you sure you want to delete admin user{" "}
              <span className="font-semibold text-neutral-900">@{pendingDeleteUser?.Username}</span>
              {pendingDeleteUser?.FirstName ? ` (${pendingDeleteUser.FirstName} ${pendingDeleteUser.LastName || ""})` : ""}?
              {" "}This action permanently removes the user from OrderCloud and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteModalError && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed">
              {deleteModalError}
            </div>
          )}

          <DialogFooter className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
              disabled={isDeleting}
              className="px-4 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              colorScheme="danger"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white px-5 cursor-pointer gap-2"
            >
              {isDeleting ? (
                <>
                  <Icon path={mdi.mdiLoading} className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Icon path={mdi.mdiTrashCanOutline} className="h-4 w-4" />
                  Delete User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
