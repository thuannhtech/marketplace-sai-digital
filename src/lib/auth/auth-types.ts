export interface OrderCloudUserSession {
  userId: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  xpRoles?: string[];
  xp?: Record<string, any>;
  isSuperAdmin: boolean;
  accessToken: string;
  expiresAt: number; // Unix timestamp in seconds
}

export interface AdminUserItem {
  ID: string;
  Username: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Active: boolean;
  DateCreated?: string;
  Roles?: string[];
  SecurityProfileID?: string;
  xp?: {
    Country?: string;
    Roles?: string[];
    [key: string]: any;
  };
}

export interface CreateAdminUserPayload {
  Username: string;
  Password: string;
  FirstName: string;
  LastName: string;
  Email: string;
  Active: boolean;
  Roles: string[];
  SecurityProfileID?: string;
  xp?: {
    Country?: string;
    Roles?: string[];
    [key: string]: any;
  };
}

export interface UpdateAdminUserPayload {
  ID: string;
  Username: string;
  Password?: string;
  FirstName: string;
  LastName: string;
  Email: string;
  Active: boolean;
  Roles: string[];
  xp?: {
    Country?: string;
    Roles?: string[];
    [key: string]: any;
  };
}

export interface SecurityProfileSummary {
  ID: string;
  Name: string;
  Roles: string[];
  CustomRoles?: string[];
}

export interface RoleCategory {
  name: string;
  description: string;
  roles: string[];
}

export interface PagePermissionConfig {
  read: string[];
  write: string[];
  approve?: string[];
}
