import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Shield, Mail, Lock, User as UserIcon, Eye, EyeOff, 
  ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Loader2, 
  RefreshCw, Check, X, ShieldAlert, CheckSquare, Square,
  LayoutDashboard, Smartphone
} from "lucide-react";

interface AuthPageProps {
  loginWithEmail: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  registerWithEmail: (fullName: string, email: string, password: string, role: "parent" | "child") => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  reloadUser: () => Promise<void>;
  sendVerification: () => Promise<void>;
  user: any;
  userData: any;
  setIsGuestMode: (val: boolean) => void;
  onBackToHome: () => void;
}

export default function AuthPage({
  loginWithEmail,
  registerWithEmail,
  resetPassword,
  reloadUser,
  sendVerification,
  user,
  userData,
  setIsGuestMode,
  onBackToHome
}: AuthPageProps) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isOperationNotAllowed, setIsOperationNotAllowed] = useState(false);

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"parent" | "child">("parent");
  const [rememberMe, setRememberMe] = useState(true);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Password Visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Email verification timer for resend cooling
  const [resendCooldown, setResendCooldown] = useState(0);

  // Clean messages when switching modes
  useEffect(() => {
    setError(null);
    setSuccessMsg(null);
    setIsOperationNotAllowed(false);
    setPassword("");
    setConfirmPassword("");
  }, [mode]);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Translate Firebase errors into user friendly professional language
  const handleAuthError = (err: any) => {
    console.error("[AuthPage] Authentication failure detected:", err);
    const code = err?.code || "";
    const msg = err?.message || "";

    setIsOperationNotAllowed(false);

    if (code === "auth/operation-not-allowed" || msg.includes("operation-not-allowed")) {
      setIsOperationNotAllowed(true);
      setError("Email/Password Sign-In Method is disabled in your Firebase console. Please enable Email/Password provider in Firebase Console.");
    } else if (code === "auth/invalid-email" || msg.includes("invalid-email")) {
      setError("Please enter a valid email address.");
    } else if (code === "auth/user-not-found" || code === "auth/wrong-password" || msg.includes("wrong-password") || msg.includes("user-not-found") || msg.includes("invalid-credential")) {
      setError("Incorrect email or password. Please try again.");
    } else if (code === "auth/email-already-in-use" || msg.includes("email-already-in-use")) {
      setError("An account with this email address already exists.");
    } else if (code === "auth/weak-password" || msg.includes("weak-password")) {
      setError("Password is too weak. Please use at least 6 characters.");
    } else if (code === "auth/too-many-requests" || msg.includes("too-many-requests")) {
      setError("Access blocked due to too many failed login attempts. Please try again later.");
    } else if (code === "auth/network-request-failed" || msg.includes("network-request-failed")) {
      setError("A network error occurred. Please check your internet connection.");
    } else if (code === "auth/user-disabled" || msg.includes("user-disabled")) {
      setError("This account has been disabled by an administrator.");
    } else if (code === "auth/popup-blocked" || msg.includes("popup-blocked")) {
      setError("Sign-in popup was blocked by your browser. Please allow popups for this site.");
    } else if (code === "auth/popup-closed-by-user" || msg.includes("popup-closed-by-user")) {
      setError("The sign-in window was closed before completing authentication. Please try again.");
    } else if (code === "auth/unauthorized-domain" || msg.includes("unauthorized-domain")) {
      setError("This domain is not authorized for OAuth operations in your Firebase Console. Please add this domain to your Authorized Domains list in Firebase Auth settings.");
    } else {
      setError(err?.message || "An unexpected error occurred. Please try again.");
    }
  };

  // Password Strength Meter
  const getPasswordStrength = (p: string) => {
    if (!p) return { score: 0, label: "None", color: "bg-slate-700" };
    let score = 0;
    if (p.length >= 6) score += 1;
    if (p.length >= 10) score += 1;
    if (/[A-Z]/.test(p)) score += 1;
    if (/[0-9]/.test(p)) score += 1;
    if (/[^A-Za-z0-9]/.test(p)) score += 1;

    if (score <= 1) return { score, label: "Weak", color: "bg-rose-500", text: "text-rose-500" };
    if (score <= 3) return { score, label: "Medium", color: "bg-amber-500", text: "text-amber-500" };
    return { score, label: "Strong", color: "bg-emerald-500", text: "text-emerald-500" };
  };

  const strength = getPasswordStrength(password);

  // Handlers
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please fill out all required fields.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await loginWithEmail(email.trim(), password, rememberMe);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Please complete all required fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!acceptTerms) {
      setError("You must accept the Terms of Service & Privacy Policy.");
      return;
    }

    setLoading(true);
    try {
      const res: any = await registerWithEmail(fullName.trim(), email.trim(), password, role);
      if (res?.needsEmailVerification) {
        setSuccessMsg(res.message || "Account created! A verification link has been sent to your email. Please verify your email before logging in.");
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        return;
      }
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your registered email address.");
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSuccessMsg("Secure password reset instructions have been sent to your email.");
      setEmail("");
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await sendVerification();
      setSuccessMsg("A fresh email verification link has been sent to your address.");
      setResendCooldown(60); // 60s cooldown
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefreshVerification = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await reloadUser();
      setSuccessMsg("Account status synchronized successfully.");
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  // If user is logged in but email is not verified, show friendly email verification gate
  if (user && !user.emailVerified) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 relative overflow-hidden bg-slate-950">
        {/* Decorative elements */}
        <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-teal-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative max-w-md w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6"
        >
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Mail className="h-7 w-7 text-white animate-pulse" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight text-white font-display">Verify Your Email Address</h2>
            <p className="text-slate-400 text-xs leading-relaxed">
              We have sent a secure authentication link to <span className="font-semibold text-cyan-400 font-mono">{user.email}</span>. Please check your inbox (and spam folder) and verify your account to unlock the Guardian AI Dashboard.
            </p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start space-x-2 text-left"
            >
              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <span className="text-[11px] text-rose-300 leading-normal">{error}</span>
            </motion.div>
          )}

          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start space-x-2 text-left"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-[11px] text-emerald-300 leading-normal">{successMsg}</span>
            </motion.div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleManualRefreshVerification}
              disabled={loading}
              className="py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition cursor-pointer shadow-md shadow-blue-500/10 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span>I have Verified</span>
            </button>

            <button
              onClick={handleResendVerification}
              disabled={loading || resendCooldown > 0}
              className="py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition cursor-pointer disabled:opacity-50 disabled:hover:bg-slate-800"
            >
              <span>Resend Link</span>
              {resendCooldown > 0 && (
                <span className="text-slate-400 font-mono">({resendCooldown}s)</span>
              )}
            </button>
          </div>

          <div className="pt-2">
            <button
              onClick={onBackToHome}
              className="text-xs text-slate-500 hover:text-slate-300 hover:underline flex items-center justify-center space-x-1.5 mx-auto"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Sign Out / Return to Home</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 relative overflow-hidden bg-slate-950">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-teal-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="max-w-md w-full relative z-10">
        
        {/* Back Link */}
        <button
          onClick={onBackToHome}
          className="mb-6 inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-400 hover:text-white transition duration-200"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Landing Page</span>
        </button>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          
          {/* Subtle light effect top border */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>

          {/* Form Content */}
          <AnimatePresence mode="wait">
            
            {/* SIGN IN MODE */}
            {mode === "signin" && (
              <motion.div
                key="signin"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="mx-auto h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-teal-400 flex items-center justify-center shadow-lg shadow-blue-500/20 border border-blue-400/30">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-white font-display">Welcome Back</h2>
                  <p className="text-slate-400 text-xs">Access your secured Guardian AI safety dashboards</p>
                </div>

                {error && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start space-x-2 text-left">
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    <span className="text-[11px] text-rose-300 leading-normal">{error}</span>
                  </div>
                )}

                {isOperationNotAllowed && (
                  <div className="p-4 bg-slate-950/95 border border-amber-500/30 rounded-2xl text-left space-y-3 shadow-xl">
                    <div className="flex items-center space-x-2 text-amber-400">
                      <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Firebase Config Required</span>
                    </div>
                    
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Your Firebase project's <strong>Email/Password</strong> provider is disabled. Please follow these quick steps to activate it:
                    </p>
                    
                    <ol className="list-decimal list-inside text-[10px] text-slate-400 space-y-1 font-sans pl-1">
                      <li>
                        Go to your{" "}
                        <a 
                          href="https://console.firebase.google.com/project/polished-computer-774w7/authentication/providers" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:underline font-mono font-bold inline-flex items-center"
                        >
                          Firebase Auth settings ↗
                        </a>
                      </li>
                      <li>Click <strong className="text-slate-200">Add new provider</strong> (or select <strong className="text-slate-200">Email/Password</strong>).</li>
                      <li>Toggle <strong className="text-slate-200">Email/Password</strong> to <strong className="text-slate-200">Enable</strong>.</li>
                    </ol>
                  </div>
                )}

                <form onSubmit={handleSignInSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block font-bold">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="parent@example.com"
                        className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 outline-none rounded-xl pl-11 pr-4 py-3 text-sm text-white transition placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block font-bold">Password</label>
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="text-[10px] text-cyan-400 hover:underline font-semibold"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 outline-none rounded-xl pl-11 pr-11 py-3 text-sm text-white transition placeholder:text-slate-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center space-x-2 text-xs text-slate-400 cursor-pointer select-none">
                      <button
                        type="button"
                        onClick={() => setRememberMe(!rememberMe)}
                        className="text-cyan-500 focus:outline-none"
                      >
                        {rememberMe ? (
                          <CheckSquare className="h-4.5 w-4.5" />
                        ) : (
                          <Square className="h-4.5 w-4.5 text-slate-600" />
                        )}
                      </button>
                      <span>Remember me</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition shadow-md shadow-blue-500/10 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LayoutDashboard className="h-4 w-4" />
                    )}
                    <span>Secure Sign In</span>
                  </button>
                </form>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-800"></div>
                  <span className="flex-shrink mx-4 text-[10px] text-slate-500 font-mono uppercase tracking-wider">Don't have an account?</span>
                  <div className="flex-grow border-t border-slate-800"></div>
                </div>

                <button
                  onClick={() => setMode("signup")}
                  className="w-full py-3 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/30 text-slate-300 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition cursor-pointer"
                >
                  <UserIcon className="h-4 w-4" />
                  <span>Create Guardian Account</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsGuestMode(true)}
                  className="w-full py-2.5 bg-slate-950/40 hover:bg-slate-900 border border-dashed border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white font-mono text-[10px] uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  Explore Guest Sandbox (Offline Mode)
                </button>
              </motion.div>
            )}

            {/* SIGN UP MODE */}
            {mode === "signup" && (
              <motion.div
                key="signup"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-black tracking-tight text-white font-display">Create Account</h2>
                  <p className="text-slate-400 text-xs">Step-by-step custom shield registration</p>
                </div>

                {error && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start space-x-2 text-left">
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    <span className="text-[11px] text-rose-300 leading-normal">{error}</span>
                  </div>
                )}

                {isOperationNotAllowed && (
                  <div className="p-4 bg-slate-950/95 border border-amber-500/30 rounded-2xl text-left space-y-3 shadow-xl">
                    <div className="flex items-center space-x-2 text-amber-400">
                      <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Firebase Config Required</span>
                    </div>
                    
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Your Firebase project's <strong>Email/Password</strong> provider is disabled. Please follow these quick steps to activate it:
                    </p>
                    
                    <ol className="list-decimal list-inside text-[10px] text-slate-400 space-y-1 font-sans pl-1">
                      <li>
                        Go to your{" "}
                        <a 
                          href="https://console.firebase.google.com/project/polished-computer-774w7/authentication/providers" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:underline font-mono font-bold inline-flex items-center"
                        >
                          Firebase Auth settings ↗
                        </a>
                      </li>
                      <li>Click <strong className="text-slate-200">Add new provider</strong> (or select <strong className="text-slate-200">Email/Password</strong>).</li>
                      <li>Toggle <strong className="text-slate-200">Email/Password</strong> to <strong className="text-slate-200">Enable</strong>.</li>
                    </ol>
                  </div>
                )}

                <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block font-bold">Your Full Name</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 outline-none rounded-xl pl-11 pr-4 py-2.5 text-sm text-white transition placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block font-bold">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="parent@example.com"
                        className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 outline-none rounded-xl pl-11 pr-4 py-2.5 text-sm text-white transition placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  {/* USER ROLE SELECTION */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block font-bold">Register As Role</label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setRole("parent")}
                        className={`py-2 px-3 text-xs rounded-xl font-bold border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                          role === "parent" 
                            ? "bg-cyan-500/10 border-cyan-400 text-cyan-400" 
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <Shield className="h-4 w-4" />
                        <span>Parent / Guardian</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole("child")}
                        className={`py-2 px-3 text-xs rounded-xl font-bold border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                          role === "child" 
                            ? "bg-teal-500/10 border-teal-400 text-teal-400" 
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <Smartphone className="h-4 w-4" />
                        <span>Child / Companion</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block font-bold">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 outline-none rounded-xl pl-11 pr-11 py-2.5 text-sm text-white transition placeholder:text-slate-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                      </button>
                    </div>

                    {/* Password Strength Meter */}
                    {password && (
                      <div className="space-y-1 pt-1.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-500 font-mono uppercase">Complexity:</span>
                          <span className={`font-bold uppercase ${strength.text}`}>{strength.label}</span>
                        </div>
                        <div className="h-1 w-full bg-slate-950 rounded-full overflow-hidden flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((step) => (
                            <div 
                              key={step} 
                              className={`h-full flex-1 transition ${
                                strength.score >= step ? strength.color : "bg-slate-850"
                              }`} 
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block font-bold">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 outline-none rounded-xl pl-11 pr-11 py-2.5 text-sm text-white transition placeholder:text-slate-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-1.5">
                    <label className="flex items-start space-x-2 text-xs text-slate-400 cursor-pointer select-none text-left">
                      <button
                        type="button"
                        onClick={() => setAcceptTerms(!acceptTerms)}
                        className="text-cyan-500 focus:outline-none shrink-0 mt-0.5"
                      >
                        {acceptTerms ? (
                          <CheckSquare className="h-4.5 w-4.5" />
                        ) : (
                          <Square className="h-4.5 w-4.5 text-slate-600" />
                        )}
                      </button>
                      <span className="leading-tight text-[11px] text-slate-500">
                        I represent and certify that I accept the Guardian AI <span className="text-cyan-500 hover:underline">Terms of Service</span> and consent to digital monitoring under our <span className="text-cyan-500 hover:underline">Privacy Policy</span>.
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition shadow-md shadow-blue-500/10 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    <span>Register Account & Verify Email</span>
                  </button>
                </form>

                <div className="text-center pt-2">
                  <button
                    onClick={() => setMode("signin")}
                    className="text-xs text-slate-400 hover:text-white font-medium"
                  >
                    Already have an account? <span className="text-cyan-400 underline font-semibold">Sign In</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* FORGOT PASSWORD MODE */}
            {mode === "forgot" && (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="mx-auto h-12 w-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-white font-display">Reset Password</h2>
                  <p className="text-slate-400 text-xs">Enter your email to receive recovery instructions</p>
                </div>

                {error && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start space-x-2 text-left">
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    <span className="text-[11px] text-rose-300 leading-normal">{error}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start space-x-2 text-left animate-bounce">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-[11px] text-emerald-300 leading-normal">{successMsg}</span>
                  </div>
                )}

                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block font-bold">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="parent@example.com"
                        className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 outline-none rounded-xl pl-11 pr-4 py-3 text-sm text-white transition placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition shadow-md shadow-blue-500/10 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span>Send Reset Email</span>
                  </button>
                </form>

                <div className="text-center pt-2">
                  <button
                    onClick={() => setMode("signin")}
                    className="text-xs text-slate-400 hover:text-white font-medium flex items-center justify-center space-x-1.5 mx-auto"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}
