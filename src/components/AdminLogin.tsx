import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  ShieldAlert, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, 
  AlertCircle, Loader2, Key, ShieldCheck, CheckCircle2, Sparkles
} from "lucide-react";
import { ADMIN_EMAILS } from "../lib/useFirebaseSync";
import { getAuthRedirectUrl, resendVerificationEmail } from "../lib/supabase";

interface AdminLoginProps {
  loginWithEmail: (email: string, password: string, rememberMe: boolean) => Promise<any>;
  registerWithEmail?: (fullName: string, email: string, password: string, role: "parent" | "child" | "admin") => Promise<any>;
  resetPassword: (email: string) => Promise<void>;
  sendVerification?: (targetEmail?: string, redirectTo?: string) => Promise<any>;
  user: any;
  userData: any;
  navigate: (to: string) => void;
}

export default function AdminLogin({
  loginWithEmail,
  registerWithEmail,
  resetPassword,
  sendVerification,
  user,
  userData,
  navigate
}: AdminLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showResendButton, setShowResendButton] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showInitAction, setShowInitAction] = useState(false);

  // If already authenticated as admin, let the user enter directly
  const isAdmin = user && userData?.role === "admin";
  const isWrongRole = user && userData?.role && userData.role !== "admin";

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
      setSuccessMsg("Administrator email confirmed successfully! You may now authenticate your Admin session.");
      setError(null);
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
  }, []);

  const handleResendConfirmation = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Please enter your administrator email address first.");
      return;
    }
    setResending(true);
    setError(null);
    try {
      const callbackUrl = getAuthRedirectUrl("/admin/login");
      if (sendVerification) {
        await sendVerification(cleanEmail, callbackUrl);
      } else {
        await resendVerificationEmail(cleanEmail, callbackUrl);
      }
      setSuccessMsg(`A fresh verification email has been sent to ${cleanEmail}. Please check your inbox.`);
      setShowResendButton(false);
    } catch (err: any) {
      setError(err?.message || "Failed to resend confirmation email.");
    } finally {
      setResending(false);
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError("Please enter your administrator credentials.");
      return;
    }

    setError(null);
    setShowInitAction(false);
    setLoading(true);
    try {
      await loginWithEmail(cleanEmail, password, true);
    } catch (err: any) {
      console.warn("[AdminLogin] Authentication result:", err);
      const code = err?.code || "";
      const msg = (err?.message || "").toLowerCase();
      const isKnownAdmin = ADMIN_EMAILS.some(e => e.toLowerCase() === cleanEmail.toLowerCase());

      if (code === "auth/unconfirmed-email" || msg.includes("email not confirmed") || msg.includes("unconfirmed")) {
        setError("Your administrator email has not been verified yet. Please check your inbox for the confirmation link or click 'Resend Confirmation Email' below.");
        setShowResendButton(true);
      } else if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        if (isKnownAdmin && registerWithEmail) {
          setError(`Administrator credentials not found for ${cleanEmail}. If you have not set up your administrator password yet, you can initialize your account with this password below.`);
          setShowInitAction(true);
        } else {
          setError("Invalid administrator email or password. If you are an authorized administrator setting up for the first time, click 'Initialize Admin Account' below.");
          setShowInitAction(Boolean(registerWithEmail));
        }
      } else if (code === "auth/too-many-requests") {
        setError("Access temporarily blocked due to multiple failed attempts. Please wait a few moments.");
      } else {
        setError(err?.message || "Authentication failed. Please verify credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeAdmin = async () => {
    if (!registerWithEmail) return;
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Please enter your administrator email first.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters to initialize administrator account.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res: any = await registerWithEmail("Platform Administrator", cleanEmail, password, "admin");
      if (res?.needsEmailVerification) {
        setSuccessMsg(res.message || "Administrator account created! Please verify your email before signing in.");
        setShowInitAction(false);
        setShowResendButton(true);
        setPassword("");
        return;
      }
      navigate("/admin");
    } catch (err: any) {
      console.error("[AdminLogin] Failed to initialize admin account:", err);
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") {
        setError("This administrator account already exists. The password entered was incorrect. Click 'Forgot Key?' to reset your password, or try your registered password.");
        setShowInitAction(false);
      } else {
        setError(err?.message || "Failed to initialize administrator account.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your registered administrator email.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setResetSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Failed to dispatch password recovery email.");
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 selection:bg-rose-500 selection:text-white">
      {/* Dynamic Background Matrix Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(225,29,72,0.12),rgba(255,255,255,0))] pointer-events-none"></div>
      
      {/* Return to Home / Portals Button */}
      <div className="w-full max-w-md mb-6 flex justify-between items-center z-10">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Platform Home</span>
        </button>

        <div className="flex items-center space-x-2 text-[11px] font-mono text-rose-400 bg-rose-950/40 border border-rose-800/40 px-2.5 py-1 rounded-full">
          <Key className="h-3 w-3" />
          <span>PORTAL: ADMIN</span>
        </div>
      </div>

      {/* Main Admin Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-900/90 border border-rose-500/20 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-950/40 relative z-10"
      >
        {/* Admin Header */}
        <div className="text-center space-y-3 mb-6">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-tr from-rose-600 via-red-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-600/30 border border-rose-400/40">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">
              Guardian<span className="text-rose-400">AI</span> Administrator
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Elevated Platform Governance & Infrastructure Console
            </p>
          </div>
        </div>

        {/* Wrong Role Warning Banner */}
        {isWrongRole && (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/30 text-amber-300 p-3.5 rounded-2xl text-xs space-y-2">
            <div className="flex items-center space-x-2 font-semibold">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
              <span>Non-Admin Account Detected</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              You are signed in as a <strong className="text-white uppercase">{userData?.role}</strong> ({user?.email}). This portal is restricted to Platform Administrators.
            </p>
            <div className="pt-1 flex gap-2">
              {userData?.role === "parent" ? (
                <button
                  onClick={() => navigate("/parent")}
                  className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer"
                >
                  Go to Parent Portal
                </button>
              ) : (
                <button
                  onClick={() => navigate("/child")}
                  className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
                >
                  Go to Child Portal
                </button>
              )}
            </div>
          </div>
        )}

        {/* If already authenticated as admin */}
        {isAdmin ? (
          <div className="space-y-4 text-center py-2">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs flex items-center justify-center space-x-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Authenticated as Administrator ({user?.email})</span>
            </div>
            <button
              onClick={() => navigate("/admin")}
              className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <span>Enter Admin Console</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : !forgotMode ? (
          <>
            <form onSubmit={handleSignInSubmit} className="space-y-4">
            {successMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-2xl text-xs flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
            {showResendButton && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-200 p-3.5 rounded-2xl text-xs flex flex-col gap-2.5">
                <div className="flex items-start space-x-2">
                  <Mail className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-white">Administrator Confirmation Needed</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
                      If you have not verified your email address or the confirmation token expired, click below to resend.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resending || !email.trim()}
                  className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer shadow-md shadow-rose-600/20 disabled:opacity-50"
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
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-2xl text-xs flex flex-col gap-2.5">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>

                {showInitAction && (
                  <div className="pt-2 border-t border-rose-500/20 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleInitializeAdmin}
                      disabled={loading}
                      className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer shadow-lg shadow-rose-600/25 disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 text-amber-300" />
                          <span>Initialize Admin Account for {email.trim() || "this email"}</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setForgotMode(true); setError(null); setShowInitAction(false); }}
                      className="text-[11px] text-rose-400 hover:underline text-center cursor-pointer font-mono"
                    >
                      Forgot existing password? Send password reset link
                    </button>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono">
                ADMIN EMAIL
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@guardian.ai"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500 transition font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-slate-300 font-mono">
                  SECURITY KEY / PASSWORD
                </label>
                <button
                  type="button"
                  onClick={() => setForgotMode(true)}
                  className="text-[11px] text-rose-400 hover:underline cursor-pointer font-mono"
                >
                  Forgot Key?
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500 transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>Authenticate Admin Session</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Notice: Public registration is strictly disabled for Admin. Contact system owner for authorization.
              </p>
            </div>
          </form>
          </>
        ) : (
          /* Password Reset Mode */
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            {resetSuccess ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl text-xs space-y-2">
                <div className="flex items-center space-x-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Password Reset Dispatched</span>
                </div>
                <p className="text-slate-400">
                  Secure recovery instructions have been sent to <strong>{email}</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(false);
                    setResetSuccess(false);
                  }}
                  className="mt-2 w-full py-2 rounded-lg bg-emerald-600 text-white font-bold"
                >
                  Return to Admin Login
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-300">
                  Enter your verified administrator email address to receive a secure password recovery token.
                </p>

                {error && (
                  <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono">
                    ADMIN EMAIL
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@guardian.ai"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotMode(false)}
                    className="w-1/2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-1.5 transition"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Send Recovery</span>}
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </motion.div>
    </div>
  );
}
