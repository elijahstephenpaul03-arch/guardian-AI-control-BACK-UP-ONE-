import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Shield, Mail, Lock, User as UserIcon, Eye, EyeOff, 
  ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Loader2, 
  LayoutDashboard, HeartHandshake, ShieldCheck
} from "lucide-react";
import { getAuthRedirectUrl, resendVerificationEmail } from "../lib/supabase";

interface ParentLoginProps {
  loginWithEmail: (email: string, password: string, rememberMe: boolean) => Promise<any>;
  registerWithEmail: (fullName: string, email: string, password: string, role: "parent" | "child") => Promise<any>;
  resetPassword: (email: string) => Promise<void>;
  sendVerification?: (targetEmail?: string, redirectTo?: string) => Promise<any>;
  user: any;
  userData: any;
  navigate: (to: string) => void;
  returnTo?: string;
}

export default function ParentLogin({
  loginWithEmail,
  registerWithEmail,
  resetPassword,
  sendVerification,
  user,
  userData,
  navigate,
  returnTo
}: ParentLoginProps) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showResendButton, setShowResendButton] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showSignupOption, setShowSignupOption] = useState(false);

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isParent = user && userData?.role === "parent" && !userData?.disabled;
  const isWrongRole = user && userData?.role && userData.role !== "parent";

  const getSafeReturnTo = (): string => {
    if (returnTo && returnTo.startsWith("/parent")) {
      return returnTo;
    }
    if (typeof window !== "undefined") {
      const param = new URLSearchParams(window.location.search).get("returnTo");
      if (param && param.startsWith("/parent")) {
        return param;
      }
    }
    return "/parent";
  };

  const safeReturnPath = getSafeReturnTo();

  const getFeatureLabelFromPath = (path: string): string => {
    if (path.includes("tab=map")) return "Real-Time GPS Tracking";
    if (path.includes("tab=timeline")) return "History & Timeline";
    if (path.includes("tab=sos")) return "One-Tap SOS Alert";
    if (path.includes("tab=devices")) return "Remote Lock & Devices";
    if (path.includes("tab=controls")) return "Content Shield & App Limits";
    if (path.includes("tab=danger-center")) return "Unsafe AI Threat Detection";
    if (path.includes("tab=settings")) return "Cloud Sync Engine";
    return "Parent Dashboard";
  };

  const requestedFeatureLabel = safeReturnPath !== "/parent" ? getFeatureLabelFromPath(safeReturnPath) : null;

  // Detect Supabase confirmation callback or error in URL hash / query params
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.substring(1) : hash);
    const searchParams = new URLSearchParams(search);

    const errorParam = hashParams.get("error") || searchParams.get("error");
    const errorDescription = hashParams.get("error_description") || searchParams.get("error_description");
    const errorCode = hashParams.get("error_code") || searchParams.get("error_code");
    const typeParam = hashParams.get("type") || searchParams.get("type");
    const accessToken = hashParams.get("access_token");

    if (errorParam || errorCode || errorDescription) {
      const msg = errorDescription
        ? decodeURIComponent(errorDescription.replace(/\+/g, " "))
        : "The email confirmation link is invalid or has expired.";
      setError(`Confirmation Link Notice: ${msg} Please request a fresh confirmation email below.`);
      setShowResendButton(true);
    } else if (typeParam === "signup" || typeParam === "email_change" || accessToken) {
      setSuccessMsg("Email confirmed successfully! Your Parent account is verified and ready. You may now sign in.");
      setError(null);
      // Clean up hash from URL
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
  }, []);

  // Auto-redirect if already signed in as parent
  useEffect(() => {
    if (isParent && !loading) {
      const timer = setTimeout(() => {
        navigate(safeReturnPath);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isParent, loading, safeReturnPath, navigate]);

  const handleResendConfirmation = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Please enter your parent email address above first to resend verification.");
      return;
    }
    setResending(true);
    setError(null);
    try {
      const callbackUrl = getAuthRedirectUrl("/parent/login");
      if (sendVerification) {
        await sendVerification(cleanEmail, callbackUrl);
      } else {
        await resendVerificationEmail(cleanEmail, callbackUrl);
      }
      setSuccessMsg(`A fresh verification email has been sent to ${cleanEmail}. Please check your inbox and spam folder.`);
      setShowResendButton(false);
    } catch (err: any) {
      setError(err?.message || "Failed to resend confirmation email. Please check that the email is registered.");
    } finally {
      setResending(false);
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please fill in all required fields.");
      return;
    }
    setError(null);
    setShowSignupOption(false);
    setLoading(true);
    try {
      await loginWithEmail(email.trim(), password, rememberMe);
    } catch (err: any) {
      const code = err?.code || "";
      const msg = (err?.message || "").toLowerCase();
      if (code === "auth/unconfirmed-email" || msg.includes("email not confirmed") || msg.includes("unconfirmed")) {
        setError("Your Parent account email has not been verified yet. Please click the link in your confirmation email or click 'Resend Confirmation Email' below.");
        setShowResendButton(true);
      } else if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setError("Invalid email or password. If this account was previously created with Google Sign-In, please use 'Forgot?' to set a password, or register below.");
        setShowSignupOption(true);
      } else {
        setError(err?.message || "Failed to sign in. Please verify your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Please fill out all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!acceptTerms) {
      setError("Please accept the Terms of Service.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await registerWithEmail(fullName.trim(), email.trim(), password, "parent");
      if (res?.needsEmailVerification) {
        setSuccessMsg(res.message || "Account created! A verification link has been sent to your email. Please verify your email before logging in.");
        setMode("signin");
        setShowResendButton(true);
        setPassword("");
        setConfirmPassword("");
        return;
      }
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") {
        setError("An account with this email address already exists.");
      } else {
        setError(err?.message || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your registered email address.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSuccessMsg("Password reset email sent! Check your inbox.");
    } catch (err: any) {
      setError(err?.message || "Failed to send password reset email.");
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(37,99,235,0.15),rgba(255,255,255,0))] pointer-events-none"></div>

      {/* Top Header */}
      <div className="w-full max-w-md mb-6 flex justify-between items-center z-10">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Platform Home</span>
        </button>

        <div className="flex items-center space-x-2 text-[11px] font-mono text-blue-400 bg-blue-950/40 border border-blue-800/40 px-2.5 py-1 rounded-full">
          <HeartHandshake className="h-3 w-3" />
          <span>PORTAL: PARENT</span>
        </div>
      </div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-900/90 border border-blue-500/20 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl shadow-blue-950/40 relative z-10"
      >
        {/* Brand Header */}
        <div className="text-center space-y-3 mb-6">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 border border-blue-400/40">
            <Shield className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">
              Guardian<span className="text-blue-400">AI</span> Parent Portal
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Family Safety Command Center & Digital Health Monitoring
            </p>
          </div>
        </div>

        {/* Intended Feature Login Notice */}
        {requestedFeatureLabel && !isParent && (
          <div className="mb-5 p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-300 flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Lock className="h-4 w-4 text-cyan-400 shrink-0" />
              <span>Authentication required to open: <strong className="text-white">{requestedFeatureLabel}</strong></span>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800 shrink-0 font-bold uppercase">
              Protected
            </span>
          </div>
        )}

        {/* Wrong Role Warning Banner */}
        {isWrongRole && (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/30 text-amber-300 p-3.5 rounded-2xl text-xs space-y-2">
            <div className="flex items-center space-x-2 font-semibold">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
              <span>Access Restricted: Signed In As {userData?.role?.toUpperCase()}</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              You are currently logged in with role <strong className="text-white uppercase">{userData?.role}</strong> ({user?.email}). Parent administration features require a verified Parent account.
            </p>
            <button
              onClick={() => navigate(userData?.role === "admin" ? "/admin" : "/child")}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
            >
              Open Your {userData?.role === "admin" ? "Admin" : "Child"} Dashboard
            </button>
          </div>
        )}

        {/* If already authenticated as parent */}
        {isParent ? (
          <div className="space-y-4 text-center py-2">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs flex items-center justify-center space-x-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Signed in as Parent ({user?.email})</span>
            </div>
            {requestedFeatureLabel && (
              <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-[11px] text-blue-300 font-mono">
                Redirecting to requested feature: <strong className="text-white">{requestedFeatureLabel}</strong>...
              </div>
            )}
            <button
              onClick={() => navigate(safeReturnPath)}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Continue to {requestedFeatureLabel || "Parent Dashboard"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            {/* Mode Switcher Tabs */}
            <div className="flex p-1 bg-slate-950 border border-slate-800 rounded-2xl mb-4">
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(null); setShowSignupOption(false); }}
                className={`w-1/2 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  mode === "signin" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(null); setShowSignupOption(false); }}
                className={`w-1/2 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  mode === "signup" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                Create Account
              </button>
            </div>

            {error && (
              <div className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-2xl text-xs flex flex-col gap-2">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>

                {showSignupOption && mode === "signin" && (
                  <div className="pt-2 border-t border-rose-500/20 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signup");
                        setConfirmPassword(password);
                        setAcceptTerms(true);
                        if (!fullName.trim() && email.includes("@")) {
                          const suggested = email.split("@")[0].replace(/[._]/g, " ");
                          setFullName(suggested.charAt(0).toUpperCase() + suggested.slice(1));
                        }
                        setError(null);
                        setShowSignupOption(false);
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer shadow-md shadow-blue-600/20"
                    >
                      <span>Create Parent Account with this email</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setError(null);
                        setShowSignupOption(false);
                      }}
                      className="text-[11px] text-blue-400 hover:underline text-center cursor-pointer"
                    >
                      Forgot password? Send password reset link
                    </button>
                  </div>
                )}
              </div>
            )}

            {successMsg && (
              <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3 rounded-xl text-xs flex items-start space-x-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {showResendButton && (
              <div className="mb-4 bg-blue-500/10 border border-blue-500/30 text-blue-200 p-3.5 rounded-2xl text-xs flex flex-col gap-2.5">
                <div className="flex items-start space-x-2">
                  <Mail className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-white">Email Confirmation Needed</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      If you haven't received your confirmation email or the link expired, enter your email below and click to resend.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resending || !email.trim()}
                  className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer shadow-md shadow-blue-600/20 disabled:opacity-50"
                >
                  {resending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      <span>Resend Confirmation Email</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Mode: Sign In */}
            {mode === "signin" && (
              <form onSubmit={handleSignInSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Parent Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="parent@example.com"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">Password</label>
                    <button
                      type="button"
                      onClick={() => { setMode("forgot"); setError(null); }}
                      className="text-[11px] text-blue-400 hover:underline cursor-pointer"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      title={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition cursor-pointer p-0.5 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-800 accent-blue-600"
                    />
                    <span>Remember this device</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>
                      <span>Sign In as Parent</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Mode: Sign Up */}
            {mode === "signup" && (
              <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Sarah Jenkins"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="parent@example.com"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      title={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition cursor-pointer p-0.5 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      title={showConfirmPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition cursor-pointer p-0.5 focus:outline-none"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <label className="flex items-start space-x-2 text-[11px] text-slate-400 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-0.5 rounded bg-slate-950 border-slate-800 accent-blue-600"
                  />
                  <span>I agree to Guardian AI's Terms of Service & Child Data Protection Policy.</span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>
                      <span>Create Parent Account</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Mode: Forgot Password */}
            {mode === "forgot" && (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Enter your email address to receive password reset instructions.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="parent@example.com"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setMode("signin"); setError(null); }}
                    className="w-1/2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
                  >
                    Back to Sign In
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-1/2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Send Reset Link</span>}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
