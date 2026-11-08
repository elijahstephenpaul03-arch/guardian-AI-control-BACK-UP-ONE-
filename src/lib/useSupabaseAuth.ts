import { useState, useEffect, useCallback, useRef } from "react";
import { 
  supabase, 
  isSupabaseConfigured, 
  NormalizedAuthUser, 
  UserProfilePayload, 
  fetchUserProfile, 
  signInWithEmail, 
  signUpParent, 
  signUpChild, 
  signUpAdmin, 
  signOutUser, 
  resetPasswordForEmail, 
  resendVerificationEmail,
  normalizeUser,
  ADMIN_EMAILS,
  generateOrFetchFamilyCode as supabaseGenerateOrFetchCode,
  submitFamilyLinkRequest as supabaseSubmitLinkRequest,
  respondToFamilyLinkRequest as supabaseRespondToLinkRequest,
  unlinkChildAccount as supabaseUnlinkChild,
  fetchPendingFamilyRequests as supabaseFetchPendingRequests,
  fetchChildFamilyRequest as supabaseFetchChildRequest,
  subscribeParentFamilyRequests,
  subscribeChildFamilyRequest,
  triggerEmergencySosAlert,
  resolveEmergencySosAlert,
  fetchAuthorizedSosAlerts,
  subscribeSosAlertsRealtime,
  registerChildDeviceInSupabase,
  fetchDevicesFromSupabase,
  fetchLinkedChildProfilesForParent
} from "./supabase";
import { UserRole, FamilyData, FamilyRequest, SosAlert, ChildDevice, ChildProfile } from "../types";

export interface SupabaseAuthHookResult {
  user: NormalizedAuthUser | null;
  userData: UserProfilePayload | null;
  authLoading: boolean;
  isSupabaseMode: boolean;
  familyData: FamilyData | null;
  pendingRequests: FamilyRequest[];
  childFamilyRequest: FamilyRequest | null;
  profiles: ChildProfile[];
  sosAlerts: SosAlert[];
  resolvingSosAlertId: string | null;
  devices: ChildDevice[];
  registerCurrentChildDevice: (childId: string, parentId: string) => Promise<void>;
  loginWithEmail: (email: string, password: string, rememberMe?: boolean) => Promise<any>;
  registerWithEmail: (fullName: string, email: string, password: string, role?: UserRole, redirectTo?: string) => Promise<any>;
  resetPassword: (email: string) => Promise<void>;
  handleLogout: () => Promise<void>;
  reloadUser: () => Promise<void>;
  sendVerification: (targetEmail?: string, redirectTo?: string) => Promise<void>;
  createOrFetchFamilyCode: () => Promise<FamilyData | string | null>;
  joinFamilyByCode: (code: string) => Promise<any>;
  acceptFamilyRequest: (requestId: string, childUid: string, childName: string, childEmail?: string) => Promise<any>;
  rejectFamilyRequest: (requestId: string) => Promise<any>;
  removeChildFromFamily: (childId: string) => Promise<any>;
  triggerSosAlert: (childId?: string, childName?: string, location?: any) => Promise<any>;
  resolveSosAlert: (alertId: string) => Promise<any>;
}

export function useSupabaseAuth(): SupabaseAuthHookResult {
  const [user, setUser] = useState<NormalizedAuthUser | null>(null);
  const [userData, setUserData] = useState<UserProfilePayload | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Family linking state
  const [familyData, setFamilyData] = useState<FamilyData | null>(null);
  const [pendingRequests, setPendingRequests] = useState<FamilyRequest[]>([]);
  const [childFamilyRequest, setChildFamilyRequest] = useState<FamilyRequest | null>(null);
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);

  // Emergency SOS state
  const [sosAlerts, setSosAlerts] = useState<SosAlert[]>([]);
  const [resolvingSosAlertId, setResolvingSosAlertId] = useState<string | null>(null);

  // Companion devices state
  const [devices, setDevices] = useState<ChildDevice[]>([]);

  // Sync devices from public.devices
  const syncDevices = useCallback(async (targetUid: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const devList = await fetchDevicesFromSupabase(targetUid);
      setDevices(devList);
    } catch (err) {
      console.warn("[useSupabaseAuth] Error syncing devices:", err);
    }
  }, []);

  // Track family refresh debounce
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync profile from authoritative public.users table
  const syncProfile = useCallback(async (userId: string, email: string, fallbackName?: string) => {
    try {
      const profile = await fetchUserProfile(userId);
      if (profile) {
        setUserData(profile);
        try {
          localStorage.setItem(`GUARDIAN_CACHED_USER_${userId}`, JSON.stringify(profile));
        } catch (_) {}
        return profile;
      } else {
        const isKnownAdmin = ADMIN_EMAILS.includes(email.toLowerCase());
        const emailPrefix = email.includes("@") ? email.split("@")[0].replace(/[._-]/g, " ").trim() : email;
        const formattedPrefix = emailPrefix 
          ? emailPrefix.split(" ").filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") 
          : "Parent";
        const fallbackProfile: UserProfilePayload = {
          role: isKnownAdmin ? "admin" : "parent",
          fullName: fallbackName || formattedPrefix,
          displayName: fallbackName || null,
          email,
          status: "active",
          disabled: false,
          profileMissing: true,
        };
        setUserData(fallbackProfile);
        return fallbackProfile;
      }
    } catch (err) {
      console.warn("[useSupabaseAuth] Error syncing profile:", err);
      return null;
    }
  }, []);

  // Sync family data and pending requests for authenticated parent
  const syncParentFamily = useCallback(async (parentUid: string) => {
    if (!isSupabaseConfigured) return;
    try {
      // 1. Fetch parent's family record
      const { data: famRow, error: famErr } = await (supabase as any)
        .from("families")
        .select("family_code, family_name, owner_parent_id, parent_email, created_at")
        .eq("owner_parent_id", parentUid)
        .maybeSingle();

      if (!famErr && famRow) {
        setFamilyData({
          familyCode: famRow.family_code,
          familyName: famRow.family_name,
          ownerParentId: famRow.owner_parent_id,
          parentEmail: famRow.parent_email,
          createdAt: famRow.created_at,
        });
        setUserData(prev => (prev && !prev.familyCode ? { ...prev, familyCode: famRow.family_code } : prev));
      }

      // 2. Fetch pending requests
      const reqs = await supabaseFetchPendingRequests(parentUid);
      setPendingRequests(reqs as FamilyRequest[]);

      // 3. Fetch authoritative linked child profiles
      const childProfiles = await fetchLinkedChildProfilesForParent(parentUid);
      setProfiles(childProfiles);
    } catch (err) {
      console.warn("[useSupabaseAuth] Error syncing parent family:", err);
    }
  }, []);

  // Sync family request status for authenticated child
  const syncChildFamily = useCallback(async (childUid: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const req = await supabaseFetchChildRequest(childUid);
      setChildFamilyRequest(req as FamilyRequest | null);

      // If child is linked, load the family details
      if (userData?.familyCode) {
        const { data: famRow } = await (supabase as any)
          .from("families")
          .select("family_code, family_name, owner_parent_id, parent_email, created_at")
          .eq("family_code", userData.familyCode)
          .maybeSingle();

        if (famRow) {
          setFamilyData({
            familyCode: famRow.family_code,
            familyName: famRow.family_name,
            ownerParentId: famRow.owner_parent_id,
            parentEmail: famRow.parent_email,
            createdAt: famRow.created_at,
          });
        }
      }
    } catch (err) {
      console.warn("[useSupabaseAuth] Error syncing child family:", err);
    }
  }, [userData?.familyCode]);

  // Realtime subscriptions for family changes
  useEffect(() => {
    if (!user || !userData) return;

    let cleanup = () => {};

    if (userData.role === "parent") {
      syncParentFamily(user.uid);
      cleanup = subscribeParentFamilyRequests(user.uid, () => {
        if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = setTimeout(() => {
          syncParentFamily(user.uid);
        }, 150);
      });
    } else if (userData.role === "child") {
      syncChildFamily(user.uid);
      cleanup = subscribeChildFamilyRequest(user.uid, () => {
        if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = setTimeout(() => {
          syncChildFamily(user.uid);
          syncProfile(user.uid, user.email, user.displayName || undefined);
        }, 150);
      });
    }

    return () => {
      cleanup();
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, [user, userData?.role, syncParentFamily, syncChildFamily, syncProfile]);

  // Track in-flight family code generation promise to prevent race conditions or duplicate RPC calls
  const isGeneratingFamilyCodeRef = useRef<Promise<FamilyData | string | null> | null>(null);
  const lastProcessedUserIdRef = useRef<string | null>(null);

  // Initialize session on mount and subscribe to auth state changes
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    let isMounted = true;

    // Single Authoritative Auth State Listener (Supabase fires INITIAL_SESSION on subscribe)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      const currentUid = session?.user?.id || null;
      console.log(`[useSupabaseAuth] Auth state changed: ${event} (user: ${session?.user?.email || "anonymous"})`);

      if (session?.user) {
        const normalized = normalizeUser(session.user);
        setUser(normalized);

        // Immediate cached user restoration for instant profile rendering on refresh
        try {
          const cached = localStorage.getItem(`GUARDIAN_CACHED_USER_${session.user.id}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && typeof parsed === "object") {
              setUserData(parsed);
            }
          }
        } catch (_) {}

        // Schedule profile and device synchronization outside synchronous auth machine tick
        setTimeout(async () => {
          if (!isMounted || !session?.user) return;
          const profile = await syncProfile(session.user.id, session.user.email || "", normalized?.displayName || undefined);
          if (profile?.disabled) {
            console.warn("[useSupabaseAuth] Authenticated user is marked disabled in database. Signing out.");
            await signOutUser();
            if (isMounted) {
              setUser(null);
              setUserData(null);
              setDevices([]);
            }
          } else {
            syncDevices(session.user.id);
          }
        }, 0);
      } else {
        lastProcessedUserIdRef.current = null;
        setUser(null);
        setUserData(null);
        setFamilyData(null);
        setPendingRequests([]);
        setChildFamilyRequest(null);
        setProfiles([]);
        setDevices([]);
        if (typeof window !== "undefined") {
          try {
            const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith("GUARDIAN_CACHED_USER_"));
            keysToRemove.forEach(k => localStorage.removeItem(k));
          } catch (_) {}
        }
      }
      setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [syncProfile]);

  const loginWithEmail = async (email: string, password: string, rememberMe = true) => {
    setAuthLoading(true);
    try {
      const result = await signInWithEmail({ email, password, rememberMe });
      setUser(result.user);
      setUserData(result.profile);
      if (result.profile.role === "parent") {
        syncParentFamily(result.user.uid);
      } else if (result.profile.role === "child") {
        syncChildFamily(result.user.uid);
      }
      return {
        user: result.user,
        uid: result.uid,
        role: result.role,
        profile: result.profile,
        profileMissing: result.profileMissing,
      };
    } finally {
      setAuthLoading(false);
    }
  };

  const registerWithEmail = async (
    fullName: string, 
    email: string, 
    password: string, 
    role: UserRole = "parent",
    redirectTo?: string
  ) => {
    setAuthLoading(true);
    try {
      let result;
      if (role === "child") {
        result = await signUpChild({ email, password, fullName, redirectTo });
      } else if (role === "admin") {
        result = await signUpAdmin({ email, password, fullName, redirectTo });
      } else {
        result = await signUpParent({ email, password, fullName, redirectTo });
      }

      // If email verification is enabled and no session was returned, do not pretend user is authenticated
      if (result.needsEmailVerification || !result.session) {
        setUser(null);
        setUserData(null);
        return {
          user: null,
          uid: result.uid || null,
          role,
          profile: null,
          needsEmailVerification: true,
          message: result.message || "Account created! Please check your email to verify your account before logging in.",
        };
      }

      // If session is present (auto-confirmed or confirmation disabled), establish user state
      setUser(result.user);
      setUserData(result.profile);

      return {
        user: result.user,
        uid: result.user?.uid || result.uid,
        role: result.profile?.role || role,
        profile: result.profile,
        needsEmailVerification: false,
      };
    } finally {
      setAuthLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    await resetPasswordForEmail(email);
  };

  const handleLogout = async () => {
    await signOutUser();
    setUser(null);
    setUserData(null);
    setFamilyData(null);
    setPendingRequests([]);
    setChildFamilyRequest(null);
    setProfiles([]);
    setDevices([]);
    if (typeof window !== "undefined") {
      try {
        const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith("GUARDIAN_"));
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch (_) {}
    }
  };

  const reloadUser = async () => {
    if (!isSupabaseConfigured) return;
    const { data: { user: freshUser } } = await supabase.auth.getUser();
    if (freshUser) {
      const normalized = normalizeUser(freshUser);
      setUser(normalized);
      await syncProfile(freshUser.id, freshUser.email || "", normalized?.displayName || undefined);
    }
  };

  const sendVerification = async (targetEmail?: string, redirectTo?: string) => {
    const emailToVerify = (targetEmail || user?.email || "").trim();
    if (!emailToVerify) {
      throw new Error("Please specify an email address to resend verification.");
    }
    await resendVerificationEmail(emailToVerify, redirectTo);
  };

  // ==============================================================================
  // FAMILY LINKING ACTIONS (PHASE 3)
  // ==============================================================================

  const createOrFetchFamilyCode = async (): Promise<FamilyData | string | null> => {
    // 1. Check if user state exists
    if (!user) {
      console.warn("[createOrFetchFamilyCode] Blocked: No user in state.");
      return null;
    }

    // 2. Return cached family data if already resolved in memory
    if (familyData?.familyCode) {
      return familyData;
    }

    // 3. Confirm active Supabase session & access token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session || !session.access_token) {
      console.warn("[createOrFetchFamilyCode] Blocked: No active Supabase session.");
      return null;
    }

    // 4. Ensure authoritative profile is loaded and verified
    let currentProfile = userData;
    if (!currentProfile || currentProfile.profileMissing) {
      currentProfile = await syncProfile(session.user.id, session.user.email || "", user.displayName || undefined);
    }

    if (!currentProfile) {
      console.warn("[createOrFetchFamilyCode] Blocked: Unable to load authoritative profile.");
      return null;
    }

    if (currentProfile.disabled) {
      throw new Error("Account is disabled. Please contact your platform administrator.");
    }

    if (currentProfile.role !== "parent") {
      console.warn(`[createOrFetchFamilyCode] Blocked: Role '${currentProfile.role}' is not a parent account. Admin and child accounts do not receive family codes.`);
      return null;
    }

    // 5. In-flight promise lock to prevent duplicate concurrent calls
    if (isGeneratingFamilyCodeRef.current) {
      return isGeneratingFamilyCodeRef.current;
    }

    const task = (async () => {
      try {
        const res = await supabaseGenerateOrFetchCode(currentProfile?.fullName || undefined);
        const newFam: FamilyData = {
          familyCode: res.familyCode,
          familyName: res.familyName,
          ownerParentId: res.ownerParentId,
          parentEmail: res.parentEmail,
          createdAt: res.createdAt,
        };
        setFamilyData(newFam);
        setUserData(prev => (prev ? { ...prev, familyCode: res.familyCode } : prev));
        return newFam;
      } finally {
        isGeneratingFamilyCodeRef.current = null;
      }
    })();

    isGeneratingFamilyCodeRef.current = task;
    return task;
  };

  const joinFamilyByCode = async (code: string) => {
    if (!user) throw new Error("Must be logged in to join family.");
    const req = await supabaseSubmitLinkRequest(code);
    setChildFamilyRequest(req as FamilyRequest);
    return req;
  };

  const acceptFamilyRequest = async (requestId: string, childUid: string, childName: string, childEmail?: string) => {
    if (!user) throw new Error("Parent must be authenticated.");
    const res = await supabaseRespondToLinkRequest(requestId, "accept");
    // Update pending requests list
    setPendingRequests(prev => prev.filter(r => r.id !== requestId));
    if (user) {
      await syncParentFamily(user.uid);
    }
    return res;
  };

  const rejectFamilyRequest = async (requestId: string) => {
    if (!user) throw new Error("Parent must be authenticated.");
    const res = await supabaseRespondToLinkRequest(requestId, "reject");
    setPendingRequests(prev => prev.filter(r => r.id !== requestId));
    return res;
  };

  const removeChildFromFamily = async (childId: string) => {
    if (!user) throw new Error("Parent must be authenticated.");
    const res = await supabaseUnlinkChild(childId);
    setProfiles(prev => prev.filter(p => p.id !== childId));
    if (user) {
      await syncParentFamily(user.uid);
    }
    return res;
  };

  // ==============================================================================
  // COMPANION DEVICE OPERATIONS (SUPABASE)
  // ==============================================================================

  const registerCurrentChildDevice = useCallback(async (childId: string, parentId: string) => {
    try {
      // Guard: Companion device registration is strictly reserved for authenticated child accounts
      if (userData?.role === "parent" && (!childId || childId === user?.uid)) {
        console.info("[useSupabaseAuth] Notice: Skipping companion device registration for parent user session.");
        return;
      }

      const ua = typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
      const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle)/i.test(ua);
      const isMobile = /mobile|iphone|ipod|android.*mobile|blackberry|iemobile/i.test(ua);
      const type: 'phone' | 'tablet' | 'laptop' = isTablet ? 'tablet' : (isMobile ? 'phone' : 'laptop');
      const model = isMobile ? (ua.includes("iphone") ? "Apple iPhone" : "Android Smartphone") : (isTablet ? "Tablet Device" : "Workstation / Laptop");
      const childName = userData?.fullName || "Child";

      const saved = await registerChildDeviceInSupabase({
        childId,
        parentId,
        deviceName: `${childName}'s ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        deviceType: type,
        model,
      });

      setDevices(prev => {
        const existing = prev.find(d => d.id === saved.id);
        if (existing) {
          return prev.map(d => d.id === saved.id ? { ...d, ...saved } : d);
        }
        return [...prev, saved];
      });
    } catch (err: any) {
      console.warn("[useSupabaseAuth] Notice registering child device:", err?.message || err);
    }
  }, [userData?.fullName]);

  // ==============================================================================
  // EMERGENCY SOS OPERATIONS (PHASE 4)
  // ==============================================================================

  const syncSosAlerts = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;
    try {
      const alerts = await fetchAuthorizedSosAlerts();
      setSosAlerts(alerts as SosAlert[]);
    } catch (err) {
      console.warn("[useSupabaseAuth] Error syncing SOS alerts:", err);
    }
  }, [user]);

  // Realtime subscription for SOS alerts
  useEffect(() => {
    if (!user) {
      setSosAlerts([]);
      return;
    }

    syncSosAlerts();

    const cleanup = subscribeSosAlertsRealtime(user.uid, () => {
      syncSosAlerts();
    });

    return () => {
      cleanup();
    };
  }, [user, syncSosAlerts]);

  const triggerSosAlert = async (childId?: string, childName?: string, location?: any) => {
    if (!user) throw new Error("Must be logged in to trigger an SOS alert.");
    const targetChildId = childId || (userData?.role === "child" ? user.uid : undefined);
    const newAlert = await triggerEmergencySosAlert({
      childId: targetChildId,
      location: location || { lat: 17.4849, lng: 78.3907, name: "Kondapur Safe Perimeter, Hyderabad" },
    });
    setSosAlerts(prev => [newAlert as SosAlert, ...prev.filter(a => a.id !== newAlert.id)]);
    return newAlert;
  };

  const resolveSosAlert = async (alertId: string) => {
    if (!user) throw new Error("Must be logged in to resolve an SOS alert.");
    setResolvingSosAlertId(alertId);
    try {
      const resolved = await resolveEmergencySosAlert(alertId);
      setSosAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: "resolved", resolvedAt: resolved.resolvedAt, resolvedBy: resolved.resolvedBy } : a));
      return resolved;
    } finally {
      setResolvingSosAlertId(null);
    }
  };

  return {
    user,
    userData,
    authLoading,
    isSupabaseMode: isSupabaseConfigured,
    familyData,
    pendingRequests,
    childFamilyRequest,
    profiles,
    sosAlerts,
    resolvingSosAlertId,
    devices,
    registerCurrentChildDevice,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
    handleLogout,
    reloadUser,
    sendVerification,
    createOrFetchFamilyCode,
    joinFamilyByCode,
    acceptFamilyRequest,
    rejectFamilyRequest,
    removeChildFromFamily,
    triggerSosAlert,
    resolveSosAlert,
  };
}
