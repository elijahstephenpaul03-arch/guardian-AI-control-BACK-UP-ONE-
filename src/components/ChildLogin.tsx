import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Sparkles, Mail, Lock, User as UserIcon, Eye, EyeOff, 
  ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Loader2, 
  Compass, Smile, ShieldCheck, Heart
} from "lucide-react";
import { getAuthRedirectUrl, resendVerificationEmail } from "../lib/supabase";

interface ChildLoginProps {
  loginWithEmail: (email: string, password: string, rememberMe: boolean) => Promise<any>;
  registerWithEmail: (fullName: string, email: string, password: string, role: "parent" | "child") => Promise<any>;
  resetPassword: (email: string) => Promise<void>;
  sendVerification?: (targetEmail?: string, redirectTo?: string) => Promise<any>;
  user: any;
  userData: any;
  navigate: (to: string) => void;
}

export default function ChildLogin({
  loginWithEmail,
  registerWithEmail,
  resetPassword,
  sendVerification,
  user,
  userData,
  navigate
}: ChildLoginProps) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showResendButton, setShowResendButton] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showSignupOption, setShowSignupOption] = useState(false);
  const [mismatchRole, setMismatchRole] = useState<"parent" | "admin" | null>(null);

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isChild = user && userData?.role === "child" && !userData?.disabled;
  const isWrongRole = user && userData?.role && userData.role !== "child";

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
      setSuccessMsg("Email confirmed successfully! Your Explorer account is verified and ready. You may now sign in.");
      setError(null);
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
  }, []);

  // Step 10: Automatic redirect if already authenticated with role "child"
  useEffect(() => {
    if (user && userData?.role === "child" && !userData?.disabled) {
      navigate("/child");
    }
  }, [user, userData?.role, userData?.disabled, navigate]);

  const handleResendConfirmation = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Please enter your Explorer account email address first.");
      return;
    }
    setResending(true);
    setError(null);
    try {
      const callbackUrl = getAuthRedirectUrl("/child/login");
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
      setError("Please enter your child account email and password.");
      setMismatchRole(null);
      return;
    }
    const maskedEmail = cleanEmail.replace(/^(.{2})(.*)(@.*)$/, "$1***$3");
    console.log(`[ChildLogin] Submitting Explorer sign-in for: ${maskedEmail}, passwordLength: ${password.length}`);

    setError(null);
    setSuccessMsg(null);
    setShowSignupOption(false);
    setMismatchRole(null);
    setLoading(true);

    try {
      const result = await loginWithEmail(cleanEmail, password, true);
      
      // Step A: Missing profile in Firestore / Database
      if (result && result.profileMissing) {
        setError("Account authenticated in database, but no Child profile was found. Please ask your parent to connect your account using the family code, or register as a child below.");
        setShowSignupOption(true);
        setMismatchRole(null);
        return;
      }

      // Step B: Role verified as child -> navigate to Child Portal
      if (result && result.role === "child") {
        setError(null);
        setMismatchRole(null);
        navigate("/child");
        return;
      }

      // Step C: Role mismatch - Parent
      if (result && result.role === "parent") {
        setError("This account is registered as a Parent. Please use the Parent Portal.");
        setMismatchRole("parent");
        return;
      }

      // Step D: Role mismatch - Admin
      if (result && result.role === "admin") {
        setError("This account has Administrator privileges. Please use the Admin Portal.");
        setMismatchRole("admin");
        return;
      }

      // Step E: Unrecognized or null role
      setError("Account authenticated, but role is unverified. Please ask your parent to link your account or register below.");
      setShowSignupOption(true);
      setMismatchRole(null);
    } catch (err: any) {
      const code = err?.code || "";
      const msg = err?.message || "";
      setMismatchRole(null);

      if (code === "auth/unconfirmed-email" || msg.toLowerCase().includes("email not confirmed") || msg.toLowerCase().includes("unconfirmed")) {
        setError("Your Explorer account email has not been verified yet. Please check your inbox for the confirmation link or click 'Resend Confirmation Email' below.");
        setShowResendButton(true);
      } else if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError("Invalid credentials. If this account was previously created with Google Sign-In, please use 'Forgot password?' to set a password, or register below.");
        setShowSignupOption(true);
      } else if (code === "auth/user-not-found") {
        setError("No Guardian account found with this email. Please register your child account below.");
        setShowSignupOption(true);
      } else if (code === "auth/invalid-email") {
        setError("Invalid email address format. Please check for accidental spaces or typos.");
      } else if (code === "auth/user-disabled") {
        setError("This child account has been disabled. Please contact your parent or platform administrator.");
      } else if (code === "auth/too-many-requests") {
        setError("Access temporarily blocked due to multiple failed login attempts. Please wait a moment before trying again.");
      } else if (code === "auth/network-request-failed") {
        setError("Network connectivity issue. Please check your internet connection and try again.");
      } else if (msg.includes("permission-denied") || code === "permission-denied") {
        setError("Database access error: Unable to retrieve child profile permissions. Please verify security rules or contact your parent.");
      } else {
        setError(err?.message || "Authentication failed. Please verify credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    const cleanEmail = email.trim();
    if (!cleanName || !cleanEmail || !password || !confirmPassword) {
      setError("Please fill out all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password should be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setMismatchRole(null);
    setLoading(true);
    try {
      const res = await registerWithEmail(cleanName, cleanEmail, password, "child");
      if (res?.needsEmailVerification) {
        setSuccessMsg(res.message || "Explorer account created! Please check your email to verify your account before logging in.");
        setMode("signin");
        setShowResendButton(true);
        setPassword("");
        setConfirmPassword("");
        return;
      }
      // Immediately navigate to Child Portal upon successful registration with active session
      navigate("/child");
    } catch (err: any) {
      const code = err?.code || "";
      const rawMsg = err?.message || "";
      if (code === "auth/email-already-in-use") {
        setError(`This email is already registered. Please sign in with your password.`);
      } else if (code === "auth/invalid-email") {
        setError(`Invalid email address format.`);
      } else if (code === "auth/weak-password") {
        setError(`Password should be at least 6 characters.`);
      } else if (code === "auth/too-many-requests") {
        setError(`Too many registration attempts. Please wait a few moments.`);
      } else {
        setError(`Registration failed: ${rawMsg || "Unable to create account."}${code ? ` [${code}]` : ""}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Please enter your registered child account email address.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await resetPassword(cleanEmail);
      setSuccessMsg("Password reset email sent! Check your inbox to configure or reset your password.");
      setMode("signin");
    } catch (err: any) {
      setError(err?.message || "Failed to send password reset email. Please ensure the email is registered.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 selection:bg-emerald-500 selection:text-slate-950">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),rgba(255,255,255,0))] pointer-events-none"></div>

      {/* Top Header */}
      <div className="w-full max-w-md mb-6 flex justify-between items-center z-10">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Platform Home</span>
        </button>

        <div className="flex items-center space-x-2 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-full">
          <Smile className="h-3 w-3" />
          <span>PORTAL: CHILD</span>
        </div>
      </div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-900/90 border border-emerald-500/20 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-950/40 relative z-10"
      >
        {/* Child Header */}
        <div className="text-center space-y-3 mb-6">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/30 border border-emerald-300/40">
            <Compass className="h-7 w-7 text-slate-950" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">
              Guardian<span className="text-emerald-400">AI</span> Child Explorer
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Homework Helper, Daily Goals & Cyber Safety Companion
            </p>
          </div>
        </div>

        {/* Wrong Role Warning Banner */}
        {isWrongRole && (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/30 text-amber-300 p-3.5 rounded-2xl text-xs space-y-2">
            <div className="flex items-center space-x-2 font-semibold">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
              <span>Signed In As {userData?.role?.toUpperCase()}</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              You are logged in with role <strong className="text-white uppercase">{userData?.role}</strong> ({user?.email}).
            </p>
            <button
              onClick={() => navigate(userData?.role === "admin" ? "/admin" : "/parent")}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
            >
              Open Your {userData?.role === "admin" ? "Admin" : "Parent"} Dashboard
            </button>
          </div>
        )}

        {/* If already authenticated as child */}
        {isChild ? (
          <div className="space-y-4 text-center py-2">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs flex items-center justify-center space-x-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Signed in as Explorer ({user?.email})</span>
            </div>
            <button
              onClick={() => navigate("/child")}
              className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/30 flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>Enter Child Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            {/* Mode Switcher Tabs */}
            {mode !== "forgot" ? (
              <div className="flex p-1 bg-slate-950 border border-slate-800 rounded-2xl mb-4">
                <button
                  type="button"
                  onClick={() => { setMode("signin"); setError(null); setShowSignupOption(false); setMismatchRole(null); }}
                  className={`w-1/2 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    mode === "signin" ? "bg-emerald-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Explorer Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("signup"); setError(null); setShowSignupOption(false); setMismatchRole(null); }}
                  className={`w-1/2 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    mode === "signup" ? "bg-emerald-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Create Account
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-white">Password Recovery</span>
                <button
                  type="button"
                  onClick={() => { setMode("signin"); setError(null); setMismatchRole(null); }}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            )}

            {error && (
              <div className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-2xl text-xs flex flex-col gap-2">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>

                {/* Direct Portal Navigation on Role Mismatch */}
                {mismatchRole === "parent" && (
                  <div className="pt-2 border-t border-rose-500/20 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => navigate("/parent/login")}
                      className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer shadow-md shadow-blue-500/20"
                    >
                      <span>Go to Parent Portal</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {mismatchRole === "admin" && (
                  <div className="pt-2 border-t border-rose-500/20 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => navigate("/admin/login")}
                      className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer shadow-md shadow-rose-500/20"
                    >
                      <span>Go to Admin Portal</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {showSignupOption && mode === "signin" && !mismatchRole && (
                  <div className="pt-2 border-t border-rose-500/20 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setError(null);
                        setShowSignupOption(false);
                        setMismatchRole(null);
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer border border-slate-700"
                    >
                      <span>Reset / Configure Password via Email</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signup");
                        setConfirmPassword(password);
                        if (!fullName.trim() && email.includes("@")) {
                          const suggested = email.split("@")[0].replace(/[._]/g, " ");
                          setFullName(suggested.charAt(0).toUpperCase() + suggested.slice(1));
                        }
                        setError(null);
                        setShowSignupOption(false);
                        setMismatchRole(null);
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer shadow-md shadow-emerald-500/20"
                    >
                      <span>Register Child Explorer Account</span>
                      <ArrowRight className="h-3.5 w-3.5" />
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
              <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 p-3.5 rounded-2xl text-xs flex flex-col gap-2.5">
                <div className="flex items-start space-x-2">
                  <Mail className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-white">Explorer Email Confirmation Needed</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      If you haven't received your confirmation email or the link expired, enter your email and click to resend.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resending || !email.trim()}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer shadow-md shadow-emerald-500/20 disabled:opacity-50"
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
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Child Account Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="leo@childnet.io"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setError(null);
                        setMismatchRole(null);
                      }}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 cursor-pointer font-medium transition"
                    >
                      Forgot password?
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
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/30 flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>
                      <span>Start Learning & Exploring</span>
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
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Explorer Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Leo Miller"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
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
                      placeholder="leo@childnet.io"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
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
                      placeholder="Minimum 6 characters"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      title={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-2 text-slate-500 hover:text-slate-300 transition cursor-pointer p-0.5 focus:outline-none"
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
                      placeholder="Re-type password"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      title={showConfirmPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-2 text-slate-500 hover:text-slate-300 transition cursor-pointer p-0.5 focus:outline-none"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/30 flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-50 mt-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>
                      <span>Join as Explorer</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Mode: Forgot Password */}
            {mode === "forgot" && (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div className="text-center mb-2">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Enter your registered child account email and we'll send you a password reset link to configure your password.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Child Account Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="leo@childnet.io"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/30 flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>
                      <span>Send Password Reset Email</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                    setMismatchRole(null);
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition cursor-pointer"
                >
                  Back to Sign In
                </button>
              </form>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
