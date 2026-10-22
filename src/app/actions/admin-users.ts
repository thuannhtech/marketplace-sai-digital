"use server";

import {
  AdminUserItem,
  CreateAdminUserPayload,
  UpdateAdminUserPayload,
  SecurityProfileSummary,
} from "@/src/lib/auth/auth-types";
import { ROLE_PRESETS, ALL_ORDERCLOUD_ROLES } from "@/src/lib/auth/roles-config";
import { getOrderCloudToken } from "@/src/app/actions/ordercloud";

function getBaseApiUrl(): string {
  return (
    process.env.ORDERCLOUD_BASE_API_URL ||
    process.env.NEXT_PUBLIC_ORDERCLOUD_BASE_API_URL ||
    "https://japaneast-sandbox.ordercloud.io"
  );
}

/**
 * Fetch all Security Profiles directly from /v1/securityprofiles
 * and extract all distinct roles configured in these profiles.
 */
export async function getSecurityProfilesAction(): Promise<{
  success: boolean;
  profiles?: SecurityProfileSummary[];
  allRoles?: string[];
  error?: string;
}> {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) {
      return { success: false, error: "Failed to authenticate with OrderCloud Admin." };
    }

    const baseApiUrl = getBaseApiUrl();
    const { Configuration, SecurityProfiles, Tokens } = await import("ordercloud-javascript-sdk");
    Configuration.Set({ baseApiUrl });
    Tokens.SetAccessToken(auth.token);

    console.log("Fetching security profiles from:", `${baseApiUrl}/v1/securityprofiles`);

    const res = await SecurityProfiles.List({ pageSize: 100 });
    const profiles: SecurityProfileSummary[] = (res.Items || []).map((p) => ({
      ID: p.ID!,
      Name: p.Name || p.ID!,
      Roles: p.Roles || [],
      CustomRoles: p.CustomRoles || [],
    }));

    // Extract all unique roles from all security profiles in /securityprofiles
    const rolesSet = new Set<string>();
    profiles.forEach((p) => {
      (p.Roles || []).forEach((r) => rolesSet.add(r));
    });

    const allRoles = Array.from(rolesSet);

    return {
      success: true,
      profiles,
      allRoles,
    };
  } catch (err: any) {
    console.error("Get Security Profiles Error:", err);
    return {
      success: false,
      error: err.message || "Failed to fetch Security Profiles from /v1/securityprofiles.",
    };
  }
}

/**
 * Fetch all Admin Users directly from /v1/adminusers filtered by xp.Country = SitecoreAI
 */
export async function getAdminUsersAction(): Promise<{
  success: boolean;
  users?: AdminUserItem[];
  error?: string;
}> {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) {
      return { success: false, error: "Failed to authenticate with OrderCloud Admin." };
    }

    const baseApiUrl = getBaseApiUrl();
    const { Configuration, SecurityProfiles, Tokens } = await import("ordercloud-javascript-sdk");
    Configuration.Set({ baseApiUrl });
    Tokens.SetAccessToken(auth.token);

    console.log("Fetching admin users from:", `${baseApiUrl}/v1/adminusers?xp.Country=SitecoreAI&pageSize=100`);

    // 1. Direct call to /v1/adminusers with filter xp.Country=SitecoreAI
    const response = await fetch(`${baseApiUrl}/v1/adminusers?xp.Country=SitecoreAI&pageSize=100`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg =
        data.Errors?.[0]?.Message ||
        data.error_description ||
        data.error ||
        "Failed to fetch admin users from OrderCloud.";
      return { success: false, error: errorMsg };
    }

    // Filter to ensure only users with xp.Country === "SitecoreAI"
    const rawUsers: any[] = (data.Items || []).filter(
      (u: any) => u.xp?.Country === "SitecoreAI"
    );

    // 2. Fetch all Security Profile assignments and all Security Profiles in parallel
    let assignments: any[] = [];
    const profilesCache = new Map<string, string[]>();

    try {
      const [assignmentRes, profilesRes] = await Promise.all([
        SecurityProfiles.ListAssignments({ pageSize: 100 }).catch(() => ({ Items: [] })),
        SecurityProfiles.List({ pageSize: 100 }).catch(() => ({ Items: [] })),
      ]);
      assignments = assignmentRes.Items || [];
      (profilesRes.Items || []).forEach((p) => {
        if (p.ID && p.Roles) {
          profilesCache.set(p.ID, p.Roles);
        }
      });
    } catch (e) {
      console.warn("Could not list security profiles or assignments:", e);
    }

    const usersWithRoles: AdminUserItem[] = await Promise.all(
      rawUsers.map(async (u) => {
        const userAssignments = assignments.filter((a) => a.UserID === u.ID);
        let userRoles: string[] = [];
        const profileId = userAssignments[0]?.SecurityProfileID;

        for (const ua of userAssignments) {
          const pId = ua.SecurityProfileID;
          if (pId) {
            if (profilesCache.has(pId)) {
              userRoles.push(...(profilesCache.get(pId) || []));
            } else {
              try {
                const profile = await SecurityProfiles.Get(pId);
                const pRoles = profile.Roles || [];
                profilesCache.set(pId, pRoles);
                userRoles.push(...pRoles);
              } catch {
                userRoles = [];
              }
            }
          }
        }
        userRoles = Array.from(new Set(userRoles));

        // Merge roles from Security Profile with xp.Roles
        const xpRoles: string[] = Array.isArray(u.xp?.Roles) ? u.xp.Roles : [];
        const combinedRoles = Array.from(new Set([...userRoles, ...xpRoles]));

        return {
          ID: u.ID!,
          Username: u.Username!,
          FirstName: u.FirstName,
          LastName: u.LastName,
          Email: u.Email,
          Active: !!u.Active,
          DateCreated: u.DateCreated,
          Roles: combinedRoles,
          SecurityProfileID: profileId,
          xp: u.xp,
        };
      })
    );

    return { success: true, users: usersWithRoles };
  } catch (err: any) {
    console.error("Get Admin Users Error:", err);
    return {
      success: false,
      error: err.message || "Failed to load Admin Users list.",
    };
  }
}

/**
 * Create a new Admin User at /v1/adminusers with xp.Country = SitecoreAI and assign initial roles
 */
export async function createAdminUserAction(payload: CreateAdminUserPayload): Promise<{
  success: boolean;
  user?: AdminUserItem;
  error?: string;
}> {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) {
      return { success: false, error: "Failed to authenticate with OrderCloud Admin." };
    }

    const baseApiUrl = getBaseApiUrl();
    const { Configuration, AdminUsers, SecurityProfiles, Tokens } = await import("ordercloud-javascript-sdk");
    Configuration.Set({ baseApiUrl });
    Tokens.SetAccessToken(auth.token);

    console.log("Creating new admin user with xp.Country=SitecoreAI at:", `${baseApiUrl}/v1/adminusers`);

    if (!payload.Password || !payload.Password.trim()) {
      return { success: false, error: "Password is required for creating a new Admin User." };
    }

    // 1. Resolve custom xp.Roles: strictly honor explicit preset xpRoles from payload.Roles
    const presetXpRoles = new Set(ROLE_PRESETS.map((p) => p.xpRole));
    let xpRoles: string[] = (Array.isArray(payload.xp?.Roles) ? payload.xp!.Roles! : []).filter(
      (r) => !presetXpRoles.has(r)
    );
    if (payload.Roles && payload.Roles.length > 0) {
      ROLE_PRESETS.forEach((preset) => {
        if (payload.Roles.includes(preset.xpRole)) {
          xpRoles.push(preset.xpRole);
        }
      });
      xpRoles = Array.from(new Set(xpRoles));
    }

    // 2. Create Admin User with xp.Country = "SitecoreAI" and xp.Roles
    const newUser = await AdminUsers.Create({
      Username: payload.Username.trim(),
      Password: payload.Password.trim(),
      FirstName: payload.FirstName.trim(),
      LastName: payload.LastName.trim(),
      Email: payload.Email.trim(),
      Active: payload.Active,
      xp: {
        ...(payload.xp || {}),
        Country: payload.xp?.Country || "SitecoreAI",
        Roles: xpRoles,
      },
    });

    // 3. Assign matching Security Profile in OrderCloud if available
    for (const xpRole of xpRoles) {
      try {
        await SecurityProfiles.SaveAssignment({
          SecurityProfileID: xpRole,
          UserID: newUser.ID!,
        });
      } catch {
        // Continue if profile ID does not exist as SecurityProfile in OrderCloud
      }
    }

    if (payload.Roles && payload.Roles.length > 0 && newUser.ID) {
      try {
        const standardRoles = payload.Roles.filter((r) =>
          (ALL_ORDERCLOUD_ROLES as readonly string[]).includes(r) || r === "FullAccess"
        );
        if (standardRoles.length > 0) {
          const profileId = `sp_admin_${newUser.ID.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}`;
          await SecurityProfiles.Save(profileId, {
            ID: profileId,
            Name: `Role Profile for ${newUser.Username}`,
            Roles: standardRoles as any,
          });

          await SecurityProfiles.SaveAssignment({
            SecurityProfileID: profileId,
            UserID: newUser.ID,
          });
        }
      } catch (spErr) {
        console.warn("Could not save custom profile:", spErr);
      }
    }

    return {
      success: true,
      user: {
        ID: newUser.ID!,
        Username: newUser.Username!,
        FirstName: newUser.FirstName,
        LastName: newUser.LastName,
        Email: newUser.Email,
        Active: !!newUser.Active,
        Roles: payload.Roles || [],
        SecurityProfileID: payload.SecurityProfileID,
        xp: newUser.xp,
      },
    };
  } catch (err: any) {
    console.error("Create Admin User Error:", err);
    let msg = err.message || "Failed to create Admin User.";
    if (err.errors?.Errors?.[0]?.Message) {
      msg = err.errors.Errors[0].Message;
    }
    return { success: false, error: msg };
  }
}

/**
 * Fetch current assigned roles for a specific Admin User
 */
export async function getUserSecurityProfileRolesAction(userId: string): Promise<{
  success: boolean;
  roles?: string[];
  error?: string;
}> {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) {
      return { success: false, error: "Failed to authenticate with OrderCloud Admin." };
    }

    const baseApiUrl = getBaseApiUrl();
    const { Configuration, SecurityProfiles, Tokens } = await import("ordercloud-javascript-sdk");
    Configuration.Set({ baseApiUrl });
    Tokens.SetAccessToken(auth.token);

    const assignments = await SecurityProfiles.ListAssignments({ userID: userId });
    if (!assignments.Items || assignments.Items.length === 0) {
      return { success: true, roles: [] };
    }

    const profileId = assignments.Items[0].SecurityProfileID;
    if (!profileId) {
      return { success: true, roles: [] };
    }

    const profile = await SecurityProfiles.Get(profileId);
    return { success: true, roles: profile.Roles || [] };
  } catch (err: any) {
    console.error("Get User Roles Error:", err);
    return { success: false, error: err.message || "Failed to fetch user roles." };
  }
}

/**
 * Assign roles to an Admin User by creating/updating a Security Profile or assigning an existing profile.
 * Also patches Admin User with xp.Country = "SitecoreAI".
 */
export async function assignRolesToAdminUserAction(
  userId: string,
  roles: string[],
  securityProfileId?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) {
      return { success: false, error: "Failed to authenticate with OrderCloud Admin." };
    }

    const baseApiUrl = getBaseApiUrl();
    const { Configuration, AdminUsers, SecurityProfiles, Tokens } = await import("ordercloud-javascript-sdk");
    Configuration.Set({ baseApiUrl });
    Tokens.SetAccessToken(auth.token);

    if (securityProfileId && (!roles || roles.length === 0)) {
      // 1. Assign existing Security Profile directly
      await SecurityProfiles.SaveAssignment({
        SecurityProfileID: securityProfileId,
        UserID: userId,
      });
    } else {
      // 2. Save Security Profile with selected roles and assign it
      const sanitizedUserId = userId.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
      const profileId = securityProfileId || `sp_admin_${sanitizedUserId}`;

      await SecurityProfiles.Save(profileId, {
        ID: profileId,
        Name: `Role Profile for ${userId}`,
        Roles: roles as any,
      });

      await SecurityProfiles.SaveAssignment({
        SecurityProfileID: profileId,
        UserID: userId,
      });
    }

    // 3. Patch Admin User to ensure xp.Country is set to "SitecoreAI"
    try {
      await AdminUsers.Patch(userId, {
        xp: {
          Country: "SitecoreAI",
        },
      });
      console.log(`Patched Admin User ${userId} with xp.Country = SitecoreAI`);
    } catch (patchErr) {
      console.warn(`Could not patch xp.Country for user ${userId}:`, patchErr);
    }

    return { success: true };
  } catch (err: any) {
    console.error("Assign Roles Error:", err);
    let msg = err.message || "Failed to assign roles to user.";
    if (err.errors?.Errors?.[0]?.Message) {
      msg = err.errors.Errors[0].Message;
    }
    return { success: false, error: msg };
  }
}

/**
 * Update an existing Admin User's profile, active status, password, and roles
 */
export async function updateAdminUserAction(payload: UpdateAdminUserPayload): Promise<{
  success: boolean;
  xpRoles?: string[];
  error?: string;
}> {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) {
      return { success: false, error: "Failed to authenticate with OrderCloud Admin." };
    }

    const baseApiUrl = getBaseApiUrl();
    const { Configuration, AdminUsers, SecurityProfiles, Tokens } = await import("ordercloud-javascript-sdk");
    Configuration.Set({ baseApiUrl });
    Tokens.SetAccessToken(auth.token);

    // 1. Resolve custom xp.Roles: strictly honor explicit preset xpRoles from payload.Roles
    const presetXpRoles = new Set(ROLE_PRESETS.map((p) => p.xpRole));
    const nonPresetRoles = (Array.isArray(payload.xp?.Roles) ? payload.xp!.Roles! : []).filter(
      (r) => !presetXpRoles.has(r)
    );
    const activePresetRoles: string[] = [];
    if (payload.Roles && payload.Roles.length > 0) {
      ROLE_PRESETS.forEach((preset) => {
        if (payload.Roles.includes(preset.xpRole)) {
          activePresetRoles.push(preset.xpRole);
        }
      });
    }
    const xpRoles = Array.from(new Set([...nonPresetRoles, ...activePresetRoles]));

    // 2. Patch user profile with xp.Country and xp.Roles
    const patchData: any = {
      FirstName: payload.FirstName.trim(),
      LastName: payload.LastName.trim(),
      Email: payload.Email.trim(),
      Active: payload.Active,
      xp: {
        ...(payload.xp || {}),
        Country: payload.xp?.Country || "SitecoreAI",
        Roles: xpRoles,
      },
    };

    if (payload.Password && payload.Password.trim().length > 0) {
      patchData.Password = payload.Password.trim();
    }

    await AdminUsers.Patch(payload.ID, patchData);

    // 3. Sync Security Profile assignments: delete obsolete assignments and add active ones
    try {
      const assignments = await SecurityProfiles.ListAssignments({ userID: payload.ID });
      const currentAssignedIds = (assignments.Items || []).map((a) => a.SecurityProfileID);

      // Delete obsolete preset assignments
      for (const assignedId of currentAssignedIds) {
        if (assignedId && presetXpRoles.has(assignedId) && !xpRoles.includes(assignedId)) {
          try {
            await SecurityProfiles.DeleteAssignment(assignedId, { userID: payload.ID });
          } catch {
            // Ignore if already deleted
          }
        }
      }

      // Add assignments for active xpRoles
      for (const xpRole of xpRoles) {
        if (!currentAssignedIds.includes(xpRole)) {
          try {
            await SecurityProfiles.SaveAssignment({
              SecurityProfileID: xpRole,
              UserID: payload.ID,
            });
          } catch {
            // Continue if profile ID does not exist as SecurityProfile in OrderCloud
          }
        }
      }
    } catch (spSyncErr) {
      console.warn("Could not sync security profile assignments:", spSyncErr);
    }

    // 4. Save and assign custom Security Profile with updated standard roles
    try {
      const standardRoles = (payload.Roles || []).filter((r) =>
        (ALL_ORDERCLOUD_ROLES as readonly string[]).includes(r) || r === "FullAccess"
      );
      const sanitizedUserId = payload.ID.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
      const profileId = `sp_admin_${sanitizedUserId}`;

      if (standardRoles.length > 0) {
        await SecurityProfiles.Save(profileId, {
          ID: profileId,
          Name: `Role Profile for ${payload.Username}`,
          Roles: standardRoles as any,
        });

        await SecurityProfiles.SaveAssignment({
          SecurityProfileID: profileId,
          UserID: payload.ID,
        });
      } else {
        try {
          await SecurityProfiles.DeleteAssignment(profileId, { userID: payload.ID });
        } catch {
          // Ignore
        }
      }
    } catch (spErr) {
      console.warn("Could not save custom profile:", spErr);
    }

    return { success: true, xpRoles };
  } catch (err: any) {
    console.error("Update Admin User Error:", err);
    let msg = err.message || "Failed to update Admin User.";
    if (err.errors?.Errors?.[0]?.Message) {
      msg = err.errors.Errors[0].Message;
    }
    return { success: false, error: msg };
  }
}

/**
 * Update an Admin User's Active status
 */
export async function updateAdminUserStatusAction(
  userId: string,
  active: boolean
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) {
      return { success: false, error: "Failed to authenticate with OrderCloud Admin." };
    }

    const baseApiUrl = getBaseApiUrl();
    const { Configuration, AdminUsers, Tokens } = await import("ordercloud-javascript-sdk");
    Configuration.Set({ baseApiUrl });
    Tokens.SetAccessToken(auth.token);

    await AdminUsers.Patch(userId, { Active: active });
    return { success: true };
  } catch (err: any) {
    console.error("Update Admin User Status Error:", err);
    let msg = err.message || "Failed to update user status.";
    if (err.errors?.Errors?.[0]?.Message) {
      msg = err.errors.Errors[0].Message;
    }
    return { success: false, error: msg };
  }
}

/**
 * Delete an Admin User from OrderCloud at /v1/adminusers/{userId}
 */
export async function deleteAdminUserAction(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) {
      return { success: false, error: "Failed to authenticate with OrderCloud Admin." };
    }

    const baseApiUrl = getBaseApiUrl();
    const { Configuration, AdminUsers, Tokens } = await import("ordercloud-javascript-sdk");
    Configuration.Set({ baseApiUrl });
    Tokens.SetAccessToken(auth.token);

    console.log("Deleting admin user:", userId);
    await AdminUsers.Delete(userId);

    return { success: true };
  } catch (err: any) {
    console.error("Delete Admin User Error:", err);
    let msg = err.message || "Failed to delete Admin User.";
    if (err.errors?.Errors?.[0]?.Message) {
      msg = err.errors.Errors[0].Message;
    }
    return { success: false, error: msg };
  }
}

