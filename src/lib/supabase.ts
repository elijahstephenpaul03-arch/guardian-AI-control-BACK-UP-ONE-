import { createClient, SupabaseClient, User as SupabaseUser, Session } from "@supabase/supabase-js";
import { UserRole, ChildDevice } from "../types";

// ==============================================================================
// GUARDIAN AI: INDEPENDENT SUPABASE EDITION - CLIENT & AUTHENTICATION (PHASE 2)
// ==============================================================================

// Authoritative Administrator email addresses recognized by the platform
export const ADMIN_EMAILS = [
  "elijahstephenpaul03@gmail.com",
  "admin@guardianai.io",
  "admin@guardian.ai"
];

// Supabase environment credentials (Client-side Publishable / Anon Key only)
// Note: NEVER expose SUPABASE_SECRET_KEY / service role key to browser or Vite client.
const env: Record<string, any> = 
  (typeof import.meta !== "undefined" && (import.meta as any).env) 
    ? (import.meta as any).env 
    : (typeof process !== "undefined" && process.env) 
      ? process.env 
      : {};

const rawSupabaseUrl: string = env.VITE_SUPABASE_URL || "";
const rawSupabaseKey: string = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(
  rawSupabaseUrl &&
  rawSupabaseKey &&
  !rawSupabaseUrl.includes("placeholder") &&
  !rawSupabaseKey.includes("placeholder")
);

if (!isSupabaseConfigured && typeof window !== "undefined") {
  console.info(
    "[Guardian AI - Supabase] Notice: VITE_SUPABASE_URL and/or VITE_SUPABASE_PUBLISHABLE_KEY are not configured yet in .env.\n" +
    "The application will operate in demo/fallback mode until Supabase environment variables are provided."
  );
}

// Database Row Types corresponding to the PostgreSQL schema (Phase 1)
export interface PublicUserRow {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  role: UserRole;
  family_code: string | null;
  parent_id: string | null;
  disabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface NormalizedAuthUser {
  uid: string;
  id: string;
  email: string;
  displayName?: string | null;
  emailVerified: boolean;
  rawSupabaseUser: SupabaseUser;
}

export interface UserProfilePayload {
  role: UserRole;
  fullName: string;
  email: string;
  status: "active" | "disabled";
  disabled: boolean;
  parentId?: string;
  familyCode?: string;
  profileMissing?: boolean;
  familyDisconnected?: boolean;
  disconnectedMessage?: string;
  disconnectedAt?: string;
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: PublicUserRow;
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          display_name?: string | null;
          role: UserRole;
          family_code?: string | null;
          parent_id?: string | null;
          disabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          email: string;
          full_name: string | null;
          display_name: string | null;
          role: UserRole;
          family_code: string | null;
          parent_id: string | null;
          disabled: boolean;
          updated_at: string;
        }>;
      };
      families: {
        Row: {
          family_code: string;
          family_name: string;
          owner_parent_id: string;
          parent_email: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          family_code: string;
          family_name: string;
          owner_parent_id: string;
          parent_email: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          family_name: string;
          owner_parent_id: string;
          parent_email: string;
          updated_at: string;
        }>;
      };
      sos_alerts: {
        Row: {
          id: string;
          child_id: string;
          child_name: string;
          family_code: string | null;
          parent_uid: string | null;
          latitude: number | null;
          longitude: number | null;
          location_name: string | null;
          status: "active" | "resolved";
          created_at: string;
          resolved_at: string | null;
          resolved_by: string | null;
        };
      };
      devices: {
        Row: {
          device_id: string;
          device_name: string;
          device_model: string | null;
          android_version: string | null;
          battery: number;
          charging: boolean;
          online: boolean;
          gps: any;
          screen_on: boolean;
          last_seen: string;
          connection_quality: string | null;
          sos_active: boolean;
          parent_id: string | null;
          child_id: string | null;
          family_code: string | null;
          updated_at: string;
        };
        Insert: {
          device_id: string;
          device_name: string;
          device_model?: string | null;
          android_version?: string | null;
          battery?: number;
          charging?: boolean;
          online?: boolean;
          gps?: any;
          screen_on?: boolean;
          last_seen?: string;
          connection_quality?: string | null;
          sos_active?: boolean;
          parent_id?: string | null;
          child_id?: string | null;
          family_code?: string | null;
          updated_at?: string;
        };
        Update: Partial<{
          device_name: string;
          device_model: string | null;
          android_version: string | null;
          battery: number;
          charging: boolean;
          online: boolean;
          gps: any;
          screen_on: boolean;
          last_seen: string;
          connection_quality: string | null;
          sos_active: boolean;
          parent_id: string | null;
          child_id: string | null;
          family_code: string | null;
          updated_at: string;
        }>;
      };
    };
  };
}

// Instantiate client safely (with safe dummy fallback if not configured to prevent crashes)
export const supabase: SupabaseClient<Database> = isSupabaseConfigured
  ? createClient<Database>(rawSupabaseUrl, rawSupabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    })
  : (createClient<Database>("https://placeholder-project.supabase.co", "placeholder-key", {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }) as SupabaseClient<Database>);

// Normalizes Supabase auth errors into standard error structures matching the UI error handlers
export function normalizeAuthError(err: any): Error & { code?: string; status?: number } {
  if (!err) return new Error("Unknown error occurred");

  const message = err.message || String(err);
  const normalizedErr = new Error(message) as Error & { code?: string; status?: number };
  normalizedErr.status = err.status || 400;

  const lowerMsg = message.toLowerCase();
  const lowerCode = (err.code || "").toLowerCase();

  if (
    lowerMsg.includes("invalid login credentials") || 
    lowerMsg.includes("invalid credentials") || 
    lowerCode === "invalid_credentials" ||
    lowerMsg.includes("wrong password")
  ) {
    normalizedErr.code = "auth/invalid-credential";
  } else if (
    lowerMsg.includes("user already registered") ||
    lowerMsg.includes("email already in use") ||
    lowerCode === "user_already_exists"
  ) {
    normalizedErr.code = "auth/email-already-in-use";
  } else if (
    lowerMsg.includes("user not found") ||
    lowerCode === "user_not_found"
  ) {
    normalizedErr.code = "auth/user-not-found";
  } else if (
    lowerMsg.includes("rate limit") ||
    lowerMsg.includes("too many requests") ||
    err.status === 429
  ) {
    normalizedErr.code = "auth/too-many-requests";
  } else if (
    lowerMsg.includes("email not confirmed") ||
    lowerCode === "email_not_confirmed"
  ) {
    normalizedErr.code = "auth/unconfirmed-email";
  } else if (
    lowerMsg.includes("account disabled") ||
    lowerMsg.includes("user disabled")
  ) {
    normalizedErr.code = "auth/user-disabled";
  } else {
    normalizedErr.code = err.code || "auth/unknown";
  }

  return normalizedErr;
}

// Normalizes a Supabase user into a consistent shape matching existing UI expectations
export function normalizeUser(user: SupabaseUser | null): NormalizedAuthUser | null {
  if (!user) return null;
  return {
    uid: user.id,
    id: user.id,
    email: user.email || "",
    displayName: (user.user_metadata?.full_name as string) || (user.user_metadata?.fullName as string) || user.email || "Guardian User",
    emailVerified: Boolean(user.email_confirmed_at),
    rawSupabaseUser: user,
  };
}

// ==============================================================================
// AUTHENTICATION OPERATIONS
// ==============================================================================

/**
 * Authoritatively retrieves the user's profile from the public.users table.
 * Never trusts client-supplied JWT claims or raw_user_meta_data for roles.
 */
export async function fetchUserProfile(userId: string): Promise<UserProfilePayload | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, full_name, display_name, role, family_code, parent_id, disabled")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn(`[fetchUserProfile] Notice querying profile for ${userId}:`, error.message);
      return null;
    }

    if (!data) return null;

    const row = data as PublicUserRow;
    return {
      role: row.role,
      fullName: row.full_name || row.display_name || row.email,
      email: row.email,
      status: row.disabled ? "disabled" : "active",
      disabled: Boolean(row.disabled),
      parentId: row.parent_id || undefined,
      familyCode: row.family_code || undefined,
      profileMissing: false,
    };
  } catch (err) {
    console.warn("[fetchUserProfile] Unexpected error:", err);
    return null;
  }
}

export interface SignUpAuthResult {
  user: NormalizedAuthUser | null;
  profile: UserProfilePayload | null;
  session: Session | null;
  needsEmailVerification: boolean;
  uid?: string;
  message?: string;
}

/**
 * Resolves the application origin dynamically in any deployment environment.
 * Ensures no hardcoded localhost URLs are used for authentication redirects.
 */
export function getAppOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  if (env.VITE_APP_URL) {
    return env.VITE_APP_URL.replace(/\/+$/, "");
  }
  if (env.APP_URL) {
    return env.APP_URL.replace(/\/+$/, "");
  }
  return "";
}

/**
 * Resolves the authentication redirect / confirmation callback URL.
 * Automatically prepends the active application origin.
 */
export function getAuthRedirectUrl(path: string = "/parent/login"): string {
  const origin = getAppOrigin();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return origin ? `${origin}${cleanPath}` : cleanPath;
}

/**
 * Registers a new Parent user account.
 * Database handle_new_user() trigger guarantees role assignment and prevents role tampering.
 * Inspects both user and session to verify if email confirmation is required.
 * Attaches dynamic application origin callback to emailRedirectTo.
 */
export async function signUpParent(params: {
  email: string;
  password: string;
  fullName: string;
  redirectTo?: string;
}): Promise<SignUpAuthResult> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
  }

  const cleanEmail = params.email.trim();
  const cleanName = params.fullName.trim();
  const emailRedirectTo = params.redirectTo || getAuthRedirectUrl("/parent/login");

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password: params.password,
    options: {
      emailRedirectTo,
      data: {
        role: "parent",
        full_name: cleanName,
        fullName: cleanName,
      },
    },
  });

  if (error) {
    throw normalizeAuthError(error);
  }

  if (!data.user) {
    throw new Error("Sign up failed to return an authenticated user session.");
  }

  const hasSession = Boolean(data.session && data.session.access_token);

  if (!hasSession) {
    // Email confirmation is required by Supabase: do not pretend the parent is authenticated
    return {
      user: null,
      profile: null,
      session: null,
      needsEmailVerification: true,
      uid: data.user.id,
      message: `Account created for ${cleanEmail}! A confirmation link has been sent to your email. Please verify your email before logging in.`,
    };
  }

  const normalized = normalizeUser(data.user)!;
  const profile = (await fetchUserProfile(data.user.id)) || {
    role: "parent",
    fullName: cleanName,
    email: cleanEmail,
    status: "active",
    disabled: false,
  };

  return {
    user: normalized,
    profile,
    session: data.session,
    needsEmailVerification: false,
    uid: data.user.id,
  };
}

/**
 * Registers a new Child user account.
 * Sets requested role to 'child'. Database triggers strictly validate role assignment.
 * Attaches dynamic application origin callback to emailRedirectTo.
 */
export async function signUpChild(params: {
  email: string;
  password: string;
  fullName: string;
  familyCode?: string;
  redirectTo?: string;
}): Promise<SignUpAuthResult> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
  }

  const cleanEmail = params.email.trim();
  const cleanName = params.fullName.trim();
  const emailRedirectTo = params.redirectTo || getAuthRedirectUrl("/child/login");

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password: params.password,
    options: {
      emailRedirectTo,
      data: {
        role: "child",
        full_name: cleanName,
        fullName: cleanName,
        familyCode: params.familyCode?.trim() || undefined,
      },
    },
  });

  if (error) {
    throw normalizeAuthError(error);
  }

  if (!data.user) {
    throw new Error("Sign up failed to return an authenticated child user session.");
  }

  const hasSession = Boolean(data.session && data.session.access_token);

  if (!hasSession) {
    return {
      user: null,
      profile: null,
      session: null,
      needsEmailVerification: true,
      uid: data.user.id,
      message: `Explorer account created for ${cleanEmail}! Please check your email inbox to verify your account before logging in.`,
    };
  }

  const normalized = normalizeUser(data.user)!;
  const profile = (await fetchUserProfile(data.user.id)) || {
    role: "child",
    fullName: cleanName,
    email: cleanEmail,
    status: "active",
    disabled: false,
    familyCode: params.familyCode?.trim() || undefined,
  };

  return {
    user: normalized,
    profile,
    session: data.session,
    needsEmailVerification: false,
    uid: data.user.id,
  };
}

/**
 * Registers an Administrator user account.
 * Note: Database trigger handle_new_user() will strictly verify whether the email is
 * in ADMIN_EMAILS and email identity is verified before granting the 'admin' role.
 * Non-admin emails or unverified emails are automatically assigned 'parent'.
 * Attaches dynamic application origin callback to emailRedirectTo.
 */
export async function signUpAdmin(params: {
  email: string;
  password: string;
  fullName: string;
  redirectTo?: string;
}): Promise<SignUpAuthResult> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
  }

  const cleanEmail = params.email.trim();
  const cleanName = params.fullName.trim();
  const emailRedirectTo = params.redirectTo || getAuthRedirectUrl("/admin/login");

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password: params.password,
    options: {
      emailRedirectTo,
      data: {
        role: "admin",
        full_name: cleanName,
        fullName: cleanName,
      },
    },
  });

  if (error) {
    throw normalizeAuthError(error);
  }

  if (!data.user) {
    throw new Error("Sign up failed to return an authenticated admin user session.");
  }

  const hasSession = Boolean(data.session && data.session.access_token);

  if (!hasSession) {
    return {
      user: null,
      profile: null,
      session: null,
      needsEmailVerification: true,
      uid: data.user.id,
      message: `Administrator account created for ${cleanEmail}! Please check your email inbox to verify your account before logging in.`,
    };
  }

  const normalized = normalizeUser(data.user)!;
  const profile = (await fetchUserProfile(data.user.id)) || {
    role: ADMIN_EMAILS.includes(cleanEmail.toLowerCase()) ? "admin" : "parent",
    fullName: cleanName,
    email: cleanEmail,
    status: "active",
    disabled: false,
  };

  return {
    user: normalized,
    profile,
    session: data.session,
    needsEmailVerification: false,
    uid: data.user.id,
  };
}

/**
 * Signs in a user with email and password.
 * Reads the authoritative public.users profile and verifies whether the account is disabled.
 */
export async function signInWithEmail(params: {
  email: string;
  password: string;
  rememberMe?: boolean;
}): Promise<{
  user: NormalizedAuthUser;
  uid: string;
  role: UserRole;
  profile: UserProfilePayload;
  profileMissing: boolean;
}> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
  }

  const cleanEmail = params.email.trim();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: params.password,
  });

  if (error) {
    throw normalizeAuthError(error);
  }

  if (!data.user) {
    throw new Error("Authentication succeeded but returned no active user session.");
  }

  const normalized = normalizeUser(data.user)!;
  const authoritativeProfile = await fetchUserProfile(data.user.id);

  if (authoritativeProfile?.disabled) {
    await supabase.auth.signOut();
    const disabledErr = new Error("This account has been disabled. Please contact your platform administrator.");
    (disabledErr as any).code = "auth/user-disabled";
    throw disabledErr;
  }

  const effectiveRole: UserRole = authoritativeProfile?.role || (
    ADMIN_EMAILS.includes(cleanEmail.toLowerCase()) ? "admin" : "parent"
  );

  const payload: UserProfilePayload = authoritativeProfile || {
    role: effectiveRole,
    fullName: normalized.displayName || cleanEmail,
    email: cleanEmail,
    status: "active",
    disabled: false,
    profileMissing: true,
  };

  return {
    user: normalized,
    uid: normalized.uid,
    role: effectiveRole,
    profile: payload,
    profileMissing: !authoritativeProfile,
  };
}

/**
 * Signs out the current user session.
 */
export async function signOutUser(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("[signOutUser] Warning during signOut:", err);
  }
}

/**
 * Dispatches password recovery email via Supabase Auth.
 * Uses dynamic application origin instead of hardcoded localhost.
 */
export async function resetPasswordForEmail(email: string, redirectTo?: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }
  const cleanEmail = email.trim();
  const targetRedirect = redirectTo || getAuthRedirectUrl("/parent/login?mode=reset");
  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: targetRedirect,
  });
  if (error) {
    throw normalizeAuthError(error);
  }
}

/**
 * Resends signup confirmation email with dynamic application redirect.
 * Uses supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: actualAppCallbackUrl } }).
 */
export async function resendVerificationEmail(email: string, redirectTo?: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }
  const cleanEmail = email.trim();
  const actualAppCallbackUrl = redirectTo || getAuthRedirectUrl("/parent/login");
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: cleanEmail,
    options: {
      emailRedirectTo: actualAppCallbackUrl,
    },
  });
  if (error) {
    throw normalizeAuthError(error);
  }
}

/**
 * Subscribes to Supabase authentication state changes.
 */
export function subscribeAuthState(
  callback: (event: string, session: Session | null, user: NormalizedAuthUser | null) => void
): () => void {
  if (!isSupabaseConfigured) {
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session, normalizeUser(session?.user || null));
  });

  return () => {
    data.subscription.unsubscribe();
  };
}

// ==============================================================================
// FAMILY CODE & LINKING OPERATIONS (PHASE 3)
// ==============================================================================

export interface FamilyDataResult {
  familyCode: string;
  familyName: string;
  ownerParentId: string;
  parentEmail?: string;
  createdAt: string;
  isNew?: boolean;
}

export interface FamilyLinkRequestResult {
  id: string;
  familyCode: string;
  parentUid: string;
  childUid: string;
  childName: string;
  childEmail?: string;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "disconnected";
  createdAt: string;
  respondedAt?: string;
  isDuplicate?: boolean;
  message?: string;
}

// Concurrency lock to prevent duplicate RPC calls when multiple dashboard components or effects request family code
let inFlightFamilyCodePromise: Promise<FamilyDataResult> | null = null;

/**
 * Invokes trusted database function to generate or retrieve Parent's unique Family Code.
 * Pre-Flight Validations:
 * 1. Checks that an active Supabase session and Bearer access token are present.
 * 2. Verifies the caller's authoritative public.users profile (role === 'parent' | 'admin' and disabled === false).
 * 3. Prevents duplicate simultaneous RPC calls via concurrency deduplication lock.
 * 4. Database function public.generate_or_get_family_code() guarantees idempotency and collision resistance.
 */
export async function generateOrFetchFamilyCode(familyName?: string): Promise<FamilyDataResult> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
  }

  // 1. Pre-Flight Session & Token Validation
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session || !session.access_token || !session.user) {
    throw new Error("Authentication required: No active session. Please sign in to access or generate your Family Code.");
  }

  // 2. Concurrency Lock: Reuse active in-flight execution to prevent race conditions or duplicate RPC calls
  if (inFlightFamilyCodePromise) {
    return inFlightFamilyCodePromise;
  }

  const executionTask = (async () => {
    try {
      // 3. Authoritative Profile Verification
      const profile = await fetchUserProfile(session.user.id);
      if (!profile) {
        throw new Error("Authentication required: Authoritative user profile not found. Please re-authenticate.");
      }

      if (profile.disabled) {
        throw new Error("Account is disabled. Please contact your platform administrator.");
      }

      if (profile.role !== "parent") {
        throw new Error("Unauthorized: Only verified parent accounts can generate or manage Family Codes. Admin and child accounts do not receive family codes.");
      }

      // 4. Invoke trusted database function
      const { data, error } = await (supabase.rpc as any)("generate_or_get_family_code", {
        p_family_name: familyName || profile.fullName || null,
      });

      if (error) {
        console.error("[generateOrFetchFamilyCode] Database error:", error);
        throw new Error(error.message || "Failed to generate or fetch family code.");
      }

      return {
        familyCode: data.family_code,
        familyName: data.family_name,
        ownerParentId: data.owner_parent_id,
        parentEmail: data.parent_email,
        createdAt: data.created_at,
        isNew: Boolean(data.is_new),
      };
    } finally {
      inFlightFamilyCodePromise = null;
    }
  })();

  inFlightFamilyCodePromise = executionTask;
  return executionTask;
}

/**
 * Child submits a 6-character Family Code to request connection.
 * Validates family existence and atomically creates a pending family_link_requests entry.
 */
export async function submitFamilyLinkRequest(familyCode: string): Promise<FamilyLinkRequestResult> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const cleanCode = familyCode.trim().toUpperCase();
  const { data, error } = await (supabase.rpc as any)("submit_family_link_request", {
    p_family_code: cleanCode,
  });

  if (error) {
    console.error("[submitFamilyLinkRequest] Database error:", error);
    throw new Error(error.message || "Failed to submit family connection request.");
  }

  return {
    id: data.id,
    familyCode: data.family_code,
    parentUid: data.parent_uid,
    childUid: data.child_uid,
    childName: data.child_name,
    childEmail: data.child_email,
    status: data.status,
    createdAt: data.created_at,
    isDuplicate: Boolean(data.is_duplicate),
    message: data.message,
  };
}

/**
 * Parent accepts or rejects a pending family connection request.
 * Atomically updates PostgreSQL relationship and creates child profile upon acceptance.
 */
export async function respondToFamilyLinkRequest(
  requestId: string,
  action: "accept" | "reject"
): Promise<{ success: boolean; status: string; requestId: string; childUid: string; message: string }> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await (supabase.rpc as any)("respond_to_family_link_request", {
    p_request_id: requestId,
    p_action: action,
  });

  if (error) {
    console.error(`[respondToFamilyLinkRequest] Database error on ${action}:`, error);
    throw new Error(error.message || `Failed to ${action} connection request.`);
  }

  return {
    success: Boolean(data.success),
    status: data.status,
    requestId: data.request_id,
    childUid: data.child_uid,
    message: data.message,
  };
}

/**
 * Safely unlinks a child from the parent's family while retaining historical records.
 */
export async function unlinkChildAccount(childUid: string): Promise<{ success: boolean; childUid: string; message: string }> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await (supabase.rpc as any)("unlink_child", {
    p_child_uid: childUid,
  });

  if (error) {
    console.error("[unlinkChildAccount] Database error:", error);
    throw new Error(error.message || "Failed to disconnect child account.");
  }

  return {
    success: Boolean(data.success),
    childUid: data.child_uid,
    message: data.message,
  };
}

/**
 * Queries all pending family connection requests for the authenticated parent.
 */
export async function fetchPendingFamilyRequests(parentUid: string): Promise<FamilyLinkRequestResult[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (supabase as any)
    .from("family_link_requests")
    .select("id, family_code, parent_uid, child_uid, child_name, child_email, status, created_at, responded_at")
    .eq("parent_uid", parentUid)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[fetchPendingFamilyRequests] Query warning:", error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    familyCode: row.family_code,
    parentUid: row.parent_uid,
    childUid: row.child_uid,
    childName: row.child_name,
    childEmail: row.child_email,
    status: row.status,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
  }));
}

/**
 * Queries the latest family connection request for the authenticated child.
 */
export async function fetchChildFamilyRequest(childUid: string): Promise<FamilyLinkRequestResult | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await (supabase as any)
    .from("family_link_requests")
    .select("id, family_code, parent_uid, child_uid, child_name, child_email, status, created_at, responded_at")
    .eq("child_uid", childUid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    familyCode: data.family_code,
    parentUid: data.parent_uid,
    childUid: data.child_uid,
    childName: data.child_name,
    childEmail: data.child_email,
    status: data.status,
    createdAt: data.created_at,
    respondedAt: data.responded_at,
  };
}

/**
 * Subscribes to Realtime changes on family_link_requests for the authenticated parent.
 */
export function subscribeParentFamilyRequests(
  parentUid: string,
  onChange: () => void
): () => void {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`parent-link-requests-${parentUid}`)
    .on(
      "postgres_changes" as any,
      {
        event: "*",
        schema: "public",
        table: "family_link_requests",
        filter: `parent_uid=eq.${parentUid}`,
      },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribes to Realtime changes on family_link_requests for the authenticated child.
 */
export function subscribeChildFamilyRequest(
  childUid: string,
  onChange: () => void
): () => void {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`child-link-request-${childUid}`)
    .on(
      "postgres_changes" as any,
      {
        event: "*",
        schema: "public",
        table: "family_link_requests",
        filter: `child_uid=eq.${childUid}`,
      },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ==============================================================================
// EMERGENCY SOS OPERATIONS & REALTIME SYNCHRONIZATION (PHASE 4)
// ==============================================================================

export interface SosAlertRow {
  id: string;
  child_id: string;
  child_name: string;
  parent_uid: string | null;
  family_code: string | null;
  location: { lat: number; lng: number; name: string } | null;
  status: "active" | "resolved";
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface SosAlertPayload {
  id: string;
  childId: string;
  childName: string;
  parentUid?: string;
  familyCode?: string;
  location?: { lat: number; lng: number; name: string };
  status: "active" | "resolved";
  timestamp: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export function formatSosAlertRow(row: any): SosAlertPayload {
  return {
    id: row.id,
    childId: row.child_id,
    childName: row.child_name,
    parentUid: row.parent_uid || undefined,
    familyCode: row.family_code || undefined,
    location: row.location || { lat: 17.4849, lng: 78.3907, name: "Kondapur, Hyderabad" },
    status: row.status,
    timestamp: row.created_at,
    resolvedAt: row.resolved_at || undefined,
    resolvedBy: row.resolved_by || undefined,
  };
}

/**
 * Authoritatively triggers an emergency SOS distress alert.
 * Uses trusted PostgreSQL database function to resolve parent_uid and family_code.
 */
export async function triggerEmergencySosAlert(params: {
  childId?: string;
  location?: { lat: number; lng: number; name: string };
}): Promise<SosAlertPayload> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
  }

  const { data, error } = await (supabase.rpc as any)("trigger_emergency_sos", {
    p_child_id: params.childId || null,
    p_location: params.location || null,
  });

  if (error) {
    console.error("[triggerEmergencySosAlert] Database error:", error);
    throw new Error(error.message || "Failed to transmit emergency SOS distress alert.");
  }

  return formatSosAlertRow(data);
}

/**
 * Authoritatively marks an active emergency SOS distress alert as resolved.
 * Strictly validated by database: zero child self-clear; authorized parent/admin only.
 */
export async function resolveEmergencySosAlert(alertId: string): Promise<SosAlertPayload> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await (supabase.rpc as any)("resolve_emergency_sos", {
    p_alert_id: alertId,
  });

  if (error) {
    console.error("[resolveEmergencySosAlert] Database error:", error);
    throw new Error(error.message || "Failed to resolve emergency SOS distress alert.");
  }

  return formatSosAlertRow(data);
}

/**
 * Queries all visible emergency SOS alerts authorized for the authenticated user via RLS.
 */
export async function fetchAuthorizedSosAlerts(): Promise<SosAlertPayload[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (supabase as any)
    .from("sos_alerts")
    .select("id, child_id, child_name, parent_uid, family_code, location, status, created_at, resolved_at, resolved_by")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.warn("[fetchAuthorizedSosAlerts] Query warning:", error.message);
    return [];
  }

  return (data || []).map(formatSosAlertRow);
}

/**
 * Subscribes to Supabase Realtime changes on public.sos_alerts.
 * Leverages Postgres Changes CDC stream so parents and children receive live notifications.
 */
export function subscribeSosAlertsRealtime(
  filterUid: string,
  onUpdate: () => void
): () => void {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`realtime-sos-alerts-${filterUid}`)
    .on(
      "postgres_changes" as any,
      {
        event: "*",
        schema: "public",
        table: "sos_alerts",
      },
      () => {
        onUpdate();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ==============================================================================
// CHILD DEVICE TELEMETRY & REGISTRATION (SUPABASE)
// ==============================================================================

export interface RegisterDeviceParams {
  childId: string;
  parentId: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: 'phone' | 'tablet' | 'laptop' | 'desktop';
  model?: string;
  os?: string;
  battery?: number;
  gps?: { lat: number; lng: number; name?: string };
}

/**
 * Registers or updates a child companion device in public.devices using Supabase Auth.
 * Adheres strictly to Supabase RLS policies (devices_insert_policy and devices_update_policy).
 */
export async function registerChildDeviceInSupabase(params: RegisterDeviceParams): Promise<ChildDevice> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session || !session.user) {
    throw new Error("Authentication required to register child device.");
  }

  // Authoritatively inspect caller profile
  const callerUid = session.user.id;
  const callerProfile = await fetchUserProfile(callerUid);
  if (!callerProfile) {
    throw new Error("Authentication required: Authoritative user profile not found.");
  }
  if (callerProfile.disabled) {
    throw new Error("Account is disabled. Please contact your platform administrator.");
  }

  let effectiveChildId = params.childId;
  let effectiveParentId = params.parentId;
  let effectiveFamilyCode: string | null = null;

  if (callerProfile.role === "child") {
    // 1. child_id must strictly equal auth.uid() for Child registrations
    effectiveChildId = callerUid;

    // 7. Unlinked child account must be rejected
    if (!callerProfile.parentId) {
      throw new Error("Unlinked child account cannot register companion devices. Connect to a family first.");
    }

    // 2 & 4. parent_id must be derived from or verified against authoritative public.users.parent_id
    effectiveParentId = callerProfile.parentId;

    // 3. family_code must match child's actual linked family
    effectiveFamilyCode = callerProfile.familyCode || null;
  } else if (callerProfile.role === "parent") {
    effectiveParentId = callerUid;
    effectiveFamilyCode = callerProfile.familyCode || null;
  }

  let devId = params.deviceId;
  if (!devId && typeof window !== "undefined") {
    devId = localStorage.getItem("GUA_DEVICE_ID") || undefined;
  }
  if (!devId) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "DEV-";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("GUA_DEVICE_ID", code);
      } catch (_) {}
    }
    devId = code;
  }

  const nowIso = new Date().toISOString();
  const devName = params.deviceName || `${params.deviceType ? params.deviceType.charAt(0).toUpperCase() + params.deviceType.slice(1) : "Companion"} Device`;

  const row = {
    device_id: devId,
    device_name: devName,
    device_model: params.model || "Companion Device",
    android_version: params.os || "Guardian OS 2.4",
    battery: params.battery ?? 88,
    charging: false,
    online: true,
    gps: params.gps || { lat: 17.4849, lng: 78.3907, name: "Live GPS" },
    screen_on: true,
    last_seen: nowIso,
    connection_quality: "strong",
    sos_active: false,
    parent_id: effectiveParentId,
    child_id: effectiveChildId,
    family_code: effectiveFamilyCode,
    updated_at: nowIso,
  };

  const { error } = await (supabase as any)
    .from("devices")
    .upsert(row, { onConflict: "device_id" });

  if (error) {
    console.error("[registerChildDeviceInSupabase] Error registering device in Supabase:", error);
    throw new Error(error.message || "Failed to register child device in Supabase.");
  }

  return {
    id: devId,
    name: devName,
    type: params.deviceType || "phone",
    model: params.model || "Companion Device",
    os: params.os || "Guardian OS 2.4",
    battery: params.battery ?? 88,
    status: "online",
    lastActive: "Just now",
    childId: effectiveChildId,
    parentId: effectiveParentId,
    createdAt: nowIso,
  };
}

/**
 * Queries registered companion devices for a parent or child via Supabase RLS.
 */
export async function fetchDevicesFromSupabase(parentOrChildId: string): Promise<ChildDevice[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (supabase as any)
    .from("devices")
    .select("*")
    .or(`parent_id.eq.${parentOrChildId},child_id.eq.${parentOrChildId}`)
    .order("updated_at", { ascending: false });

  if (error || !data) {
    console.warn("[fetchDevicesFromSupabase] Query warning:", error?.message);
    return [];
  }

  return data.map((d: any) => ({
    id: d.device_id,
    name: d.device_name,
    type: (d.device_name.toLowerCase().includes("tablet") ? "tablet" : (d.device_name.toLowerCase().includes("laptop") ? "laptop" : "phone")) as any,
    model: d.device_model || "Companion Device",
    os: d.android_version || "Guardian OS",
    battery: d.battery ?? 100,
    status: d.online ? "online" : "offline",
    lastActive: d.last_seen ? new Date(d.last_seen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Offline",
    childId: d.child_id,
    parentId: d.parent_id,
    createdAt: d.updated_at,
  }));
}


