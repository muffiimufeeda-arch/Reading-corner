import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Moon,
  Phone,
  ShieldCheck,
  Sun,
  User,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/Logo";
import { TripleTapExit } from "@/components/TripleTapExit";
import {
  initialsOf,
  loginWithPhone,
  registerWithPhone,
  resetPasswordWithOtp,
  sendOtp,
  useChat,
} from "@/lib/chat-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { next?: string } =>
    typeof search["next"] === "string" ? { next: search["next"] } : {},
  head: () => ({
    meta: [
      { title: "Sign in — Reading Corner" },
      {
        name: "description",
        content:
          "Sign in or register with your phone number and password to access Reading Corner Chat and your personal NFC link.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type AuthMode = "login" | "register" | "forgot";

const COUNTRY_CODES = [
  { code: "+91", label: "IN +91" },
  { code: "+1", label: "US +1" },
  { code: "+44", label: "UK +44" },
  { code: "+971", label: "AE +971" },
  { code: "+966", label: "SA +966" },
  { code: "+65", label: "SG +65" },
  { code: "+61", label: "AU +61" },
];

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const { ready, me, otpConfigured, legacyAccounts } = useChat();

  const [mode, setMode] = useState<AuthMode>("login");
  const [darkBackdrop, setDarkBackdrop] = useState(false);
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [dp, setDp] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [otpRequested, setOtpRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ready && me) {
      if (next && next.startsWith("/nfc/")) {
        window.location.assign(next);
      } else {
        navigate({ to: "/messages", replace: true });
      }
    }
  }, [ready, me, navigate, next]);

  function switchMode(target: AuthMode) {
    setMode(target);
    setError("");
    setInfo("");
    setPassword("");
    setConfirm("");
    setOtpCode("");
    setOtpSentTo(null);
    setOtpRequested(false);
  }

  function pickDp(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDp(String(reader.result));
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleSendOtp(purpose: "reset_password" | "register") {
    setError("");
    setInfo("");
    if (phone.replace(/\D/g, "").length < 7) {
      setError("Enter your valid phone number first.");
      return;
    }
    setBusy(true);
    try {
      const res = await sendOtp({ phone, countryCode, purpose });
      setOtpRequested(true);
      setOtpSentTo(res.phoneMasked);
      setInfo(`Verification code sent via SMS to ${res.phoneMasked}.`);
      toast.success("OTP sent to your phone");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send OTP.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    const cleanDigits = phone.replace(/\D/g, "");
    if (cleanDigits.length < 7) {
      setError("Enter a valid phone number.");
      return;
    }

    if (mode === "login") {
      if (!password) {
        setError("Password is required.");
        return;
      }
      setBusy(true);
      try {
        await loginWithPhone({ phone, countryCode, password });
        toast.success("Welcome back");
        if (next && next.startsWith("/nfc/")) {
          window.location.assign(next);
        } else {
          navigate({ to: "/messages", replace: true });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid phone number or password.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === "register") {
      if (fullName.trim().length < 2) {
        setError("Full name is required (at least 2 characters).");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
      if (otpConfigured && !otpCode.trim()) {
        setError("Enter the SMS OTP verification code sent to your phone.");
        return;
      }
      setBusy(true);
      try {
        await registerWithPhone({
          fullName: fullName.trim(),
          phone,
          countryCode,
          password,
          bio: bio.trim(),
          ...(otpCode.trim() ? { otpCode: otpCode.trim() } : {}),
          avatarDataUrl: dp,
        });
        toast.success("Account created with your personal NFC link");
        if (next && next.startsWith("/nfc/")) {
          window.location.assign(next);
        } else {
          navigate({ to: "/messages", replace: true });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not register account.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === "forgot") {
      if (!otpCode.trim()) {
        setError("Enter the 6-digit SMS OTP sent to your phone.");
        return;
      }
      if (password.length < 8) {
        setError("New password must be at least 8 characters.");
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
      setBusy(true);
      try {
        await resetPasswordWithOtp({
          phone,
          countryCode,
          code: otpCode.trim(),
          newPassword: password,
        });
        toast.success("Password updated. Sign in with your phone number.");
        switchMode("login");
        setInfo("Your password has been reset. You can now log in.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Password reset failed.");
      } finally {
        setBusy(false);
      }
    }
  }

  return (
    <div
      className={cn(
        "relative min-h-[100dvh] overflow-x-hidden px-4 py-6 transition-colors duration-300 sm:px-6 sm:py-10",
        darkBackdrop
          ? "bg-gradient-to-b from-[#070a13] via-[#0d1426] to-[#080a10] text-white"
          : "bg-gradient-to-br from-[#dce9ff] via-[#eef3ff] to-[#fbeaff] text-[#111827]",
      )}
    >
      {/* Subtle 3D Studio Ambient Orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.07, 1], opacity: [0.45, 0.65, 0.45] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className={cn(
            "absolute -left-24 -top-24 size-96 rounded-full blur-3xl",
            darkBackdrop
              ? "bg-gradient-to-tr from-[#2563eb]/35 via-[#e11d48]/25 to-[#4f46e5]/30"
              : "bg-gradient-to-tr from-[#60a5fa]/40 via-[#f472b6]/25 to-[#818cf8]/35",
          )}
        />
        <motion.div
          animate={{ scale: [1.05, 1, 1.05], opacity: [0.35, 0.55, 0.35] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          className={cn(
            "absolute -bottom-28 -right-24 size-96 rounded-full blur-3xl",
            darkBackdrop
              ? "bg-gradient-to-tr from-[#e11d48]/25 via-[#2563eb]/25 to-[#6366f1]/30"
              : "bg-gradient-to-tr from-[#f58529]/25 via-[#dd2a7b]/25 to-[#60a5fa]/35",
          )}
        />
      </div>

      <TripleTapExit />

      <div className="relative mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-5xl flex-col justify-center lg:grid lg:grid-cols-[1fr_450px] lg:items-center lg:gap-12">
        {/* Left Info & Quick Header */}
        <div className="mb-6 lg:mb-0">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate({ to: "/home" })}
              className={cn(
                "inline-flex min-h-[42px] items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold backdrop-blur-md transition",
                darkBackdrop
                  ? "border-white/15 bg-white/10 text-white hover:bg-white/15"
                  : "border-white/80 bg-white/75 text-[#1e293b] shadow-sm hover:bg-white",
              )}
            >
              <ArrowLeft className="size-4" /> Reading Corner
            </button>

            <button
              type="button"
              onClick={() => setDarkBackdrop((d) => !d)}
              aria-label={darkBackdrop ? "Switch to light mode" : "Switch to dark mode"}
              className={cn(
                "inline-flex min-h-[42px] items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold backdrop-blur-md transition",
                darkBackdrop
                  ? "border-white/15 bg-white/10 text-white hover:bg-white/15"
                  : "border-white/80 bg-white/75 text-[#1e293b] shadow-sm hover:bg-white",
              )}
            >
              {darkBackdrop ? <Sun className="size-4" /> : <Moon className="size-4" />}
              {darkBackdrop ? "Light" : "Dark"}
            </button>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mt-6"
          >
            <div className="flex items-center gap-3.5">
              <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-tr from-[#2563eb] via-[#dd2a7b] to-[#f58529] p-2.5 shadow-[0_12px_28px_-8px_rgba(37,99,235,0.5)]">
                <Logo className="size-9" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-4xl">
                  Reading Corner
                </h1>
                <p
                  className={cn(
                    "text-xs font-medium sm:text-sm",
                    darkBackdrop ? "text-white/70" : "text-[#475569]",
                  )}
                >
                  Read · Chat · Sync across your devices
                </p>
              </div>
            </div>

            <div
              className={cn(
                "mt-6 hidden space-y-3 text-sm lg:block",
                darkBackdrop ? "text-white/80" : "text-[#334155]",
              )}
            >
              <p className="flex items-center gap-2.5">
                <Phone className="size-4 text-[#2563eb]" />
                Sign in across devices using your phone number and password only.
              </p>
              <p className="flex items-center gap-2.5">
                <ShieldCheck className="size-4 text-[#dd2a7b]" />
                Every account receives a private, revocable NFC card link.
              </p>
              <p className="flex items-center gap-2.5">
                <Lock className="size-4 text-[#f58529]" />
                Reading progress, bookmarks, media, and chats stay private to your account.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Right 3D Layered Glassmorphic Card */}
        <motion.div
          initial={{ opacity: 0, y: 18, rotateX: 4 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ perspective: 1000 }}
          className="w-full"
        >
          <div
            className={cn(
              "rounded-[32px] border p-5 backdrop-blur-2xl sm:p-7",
              darkBackdrop
                ? "border-white/15 bg-[#121828]/88 text-white shadow-[0_24px_60px_-15px_rgba(37,99,235,0.35)]"
                : "border-white/90 bg-white/92 text-[#0f172a] shadow-[0_24px_60px_-15px_rgba(37,99,235,0.28)]",
            )}
          >
            {/* Mode Switcher */}
            {mode !== "forgot" ? (
              <div
                className={cn(
                  "grid grid-cols-2 gap-1.5 rounded-2xl p-1",
                  darkBackdrop ? "bg-[#1b2236]" : "bg-[#eff4ff]",
                )}
              >
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className={cn(
                    "min-h-[42px] rounded-xl text-xs font-bold transition-all",
                    mode === "login"
                      ? "bg-gradient-to-r from-[#2563eb] via-[#dd2a7b] to-[#f58529] text-white shadow-md"
                      : darkBackdrop
                        ? "text-white/70 hover:text-white"
                        : "text-[#475569] hover:text-[#0f172a]",
                  )}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className={cn(
                    "min-h-[42px] rounded-xl text-xs font-bold transition-all",
                    mode === "register"
                      ? "bg-gradient-to-r from-[#2563eb] via-[#dd2a7b] to-[#f58529] text-white shadow-md"
                      : darkBackdrop
                        ? "text-white/70 hover:text-white"
                        : "text-[#475569] hover:text-[#0f172a]",
                  )}
                >
                  Create Account
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="inline-flex min-h-[36px] items-center gap-1.5 text-xs font-bold text-[#2563eb]"
              >
                <ArrowLeft className="size-3.5" /> Back to Login
              </button>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="mt-5"
              >
                <h2 className="font-display text-2xl font-extrabold tracking-tight">
                  {mode === "login"
                    ? "Welcome Back"
                    : mode === "register"
                      ? "Create Your Account"
                      : "Reset Password"}
                </h2>
                <p
                  className={cn("mt-1 text-xs", darkBackdrop ? "text-white/65" : "text-[#64748b]")}
                >
                  {mode === "login"
                    ? "Sign in with your phone number and password to open Chat."
                    : mode === "register"
                      ? "One account per verified phone number. Syncs books & chats."
                      : "Verify your phone number with SMS OTP to set a new password."}
                </p>

                {/* Non-destructive legacy local account helper */}
                {mode === "register" && legacyAccounts.length > 0 && !fullName && (
                  <div className="mt-3 rounded-2xl border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-950">
                    <p className="font-semibold">Previous device profile found</p>
                    <p className="mt-0.5 text-amber-800">
                      Link your phone number to upgrade “{legacyAccounts[0]?.username}” without
                      losing reading data.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const first = legacyAccounts[0];
                        if (!first) return;
                        setFullName(first.username);
                        if (first.bio) setBio(first.bio);
                        if (first.dp) setDp(first.dp);
                      }}
                      className="mt-2 rounded-lg bg-amber-900 px-3 py-1.5 text-[11px] font-bold text-white"
                    >
                      Pre-fill profile details
                    </button>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3.5">
                  {mode === "register" && (
                    <>
                      <div className="flex items-center gap-3.5">
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-tr from-[#2563eb] via-[#dd2a7b] to-[#f58529] p-0.5 shadow-md"
                          aria-label="Choose profile photo"
                        >
                          <span
                            className={cn(
                              "grid size-full place-items-center overflow-hidden rounded-full font-display text-base font-bold",
                              darkBackdrop
                                ? "bg-[#1b2236] text-white"
                                : "bg-[#f3f6ff] text-[#0f172a]",
                            )}
                          >
                            {dp ? (
                              <img
                                src={dp}
                                alt="Profile preview"
                                className="size-full object-cover"
                              />
                            ) : fullName.trim() ? (
                              initialsOf(fullName)
                            ) : (
                              <Camera className="size-5 opacity-60" />
                            )}
                          </span>
                        </button>
                        <div className="min-w-0 flex-1 text-xs">
                          <p className="font-bold">Profile photo</p>
                          <p className={darkBackdrop ? "text-white/60" : "text-[#64748b]"}>
                            Tap to upload a photo from your device.
                          </p>
                        </div>
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/*"
                          onChange={pickDp}
                          className="hidden"
                        />
                      </div>

                      <div
                        className={cn(
                          "flex items-center gap-2.5 rounded-full border p-1.5 shadow-sm",
                          darkBackdrop
                            ? "border-white/15 bg-[#1b2236]"
                            : "border-[#dbe4f6] bg-[#f6f9ff]",
                        )}
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-[#2563eb] to-[#4f46e5] text-white shadow">
                          <User className="size-4" />
                        </span>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Full name *"
                          autoComplete="name"
                          className="min-w-0 flex-1 bg-transparent pr-3 text-sm outline-none placeholder:opacity-60"
                        />
                      </div>
                    </>
                  )}

                  {/* Pill Phone Input with Circular Icon Badge */}
                  <div className="flex gap-2">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      aria-label="Country code"
                      className={cn(
                        "rounded-full border px-3 py-2.5 text-xs font-bold outline-none shadow-sm",
                        darkBackdrop
                          ? "border-white/15 bg-[#1b2236] text-white"
                          : "border-[#dbe4f6] bg-[#f6f9ff] text-[#0f172a]",
                      )}
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <div
                      className={cn(
                        "flex flex-1 items-center gap-2.5 rounded-full border p-1.5 shadow-sm",
                        darkBackdrop
                          ? "border-white/15 bg-[#1b2236]"
                          : "border-[#dbe4f6] bg-[#f6f9ff]",
                      )}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-[#2563eb] to-[#3b82f6] text-white shadow">
                        <Phone className="size-4" />
                      </span>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Phone number *"
                        autoComplete="tel-national"
                        className="min-w-0 flex-1 bg-transparent pr-3 text-sm outline-none placeholder:opacity-60"
                      />
                    </div>
                  </div>

                  {/* OTP request panel for Forgot Password or OTP-configured Registration */}
                  {(mode === "forgot" || (mode === "register" && otpConfigured)) && (
                    <div
                      className={cn(
                        "space-y-2.5 rounded-2xl border p-3.5",
                        darkBackdrop
                          ? "border-white/15 bg-[#1b2236]"
                          : "border-[#dbe4f6] bg-[#f6f9ff]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold">SMS OTP Verification</span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void handleSendOtp(mode === "forgot" ? "reset_password" : "register")
                          }
                          className="rounded-full bg-[#2563eb] px-3.5 py-1.5 text-[11px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                        >
                          {otpRequested ? "Resend OTP" : "Send SMS OTP"}
                        </button>
                      </div>

                      {!otpConfigured && (
                        <p className="text-[11px] leading-relaxed text-amber-500">
                          Live SMS OTP requires <code>TWILIO_ACCOUNT_SID</code>,{" "}
                          <code>TWILIO_AUTH_TOKEN</code>, and <code>TWILIO_VERIFY_SERVICE_SID</code>{" "}
                          configured on the server.
                        </p>
                      )}

                      {(otpRequested || otpConfigured) && (
                        <div
                          className={cn(
                            "flex items-center gap-2 rounded-full border p-1",
                            darkBackdrop
                              ? "border-white/15 bg-[#121828]"
                              : "border-[#dbe4f6] bg-white",
                          )}
                        >
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#2563eb]/15 text-[#2563eb]">
                            <KeyRound className="size-3.5" />
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={8}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                            placeholder={
                              otpSentTo ? `Code sent to ${otpSentTo}` : "Enter 6-digit SMS code"
                            }
                            className="min-w-0 flex-1 bg-transparent pr-3 text-sm tracking-widest outline-none"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Password Pill Input */}
                  <div
                    className={cn(
                      "flex items-center gap-2.5 rounded-full border p-1.5 shadow-sm",
                      darkBackdrop
                        ? "border-white/15 bg-[#1b2236]"
                        : "border-[#dbe4f6] bg-[#f6f9ff]",
                    )}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-[#2563eb] to-[#dd2a7b] text-white shadow">
                      <Lock className="size-4" />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        mode === "login"
                          ? "Password *"
                          : mode === "forgot"
                            ? "New password (8+ chars) *"
                            : "Create password (8+ chars) *"
                      }
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="mr-1.5 grid size-8 shrink-0 place-items-center rounded-full opacity-70 hover:opacity-100"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>

                  {mode !== "login" && (
                    <div
                      className={cn(
                        "flex items-center gap-2.5 rounded-full border p-1.5 shadow-sm",
                        darkBackdrop
                          ? "border-white/15 bg-[#1b2236]"
                          : "border-[#dbe4f6] bg-[#f6f9ff]",
                      )}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-[#dd2a7b] to-[#8134af] text-white shadow">
                        <Lock className="size-4" />
                      </span>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Confirm password *"
                        autoComplete="new-password"
                        className="min-w-0 flex-1 bg-transparent pr-3 text-sm outline-none placeholder:opacity-60"
                      />
                    </div>
                  )}

                  {mode === "register" && (
                    <input
                      type="text"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Short bio or favorite genre (optional)"
                      maxLength={180}
                      className={cn(
                        "w-full rounded-full border px-4 py-3 text-sm outline-none shadow-sm",
                        darkBackdrop
                          ? "border-white/15 bg-[#1b2236] text-white"
                          : "border-[#dbe4f6] bg-[#f6f9ff] text-[#0f172a]",
                      )}
                    />
                  )}

                  {mode === "login" && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => switchMode("forgot")}
                        className="text-xs font-bold text-[#2563eb] hover:underline"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-start gap-2 rounded-2xl bg-rose-500/15 px-3.5 py-2.5 text-xs font-semibold text-rose-500">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {info && (
                    <div className="flex items-start gap-2 rounded-2xl bg-emerald-500/15 px-3.5 py-2.5 text-xs font-semibold text-emerald-500">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                      <span>{info}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#2563eb] via-[#dd2a7b] to-[#f58529] py-3 text-sm font-bold text-white shadow-[0_12px_28px_-8px_rgba(37,99,235,0.5)] transition active:scale-[0.98] disabled:opacity-60"
                  >
                    <span>
                      {busy
                        ? "Please wait…"
                        : mode === "login"
                          ? "Login"
                          : mode === "register"
                            ? "Create Account & Personal NFC Link"
                            : "Verify OTP & Reset Password"}
                    </span>
                    {!busy && <ArrowRight className="size-4" />}
                  </button>

                  {mode === "login" && (
                    <p
                      className={cn(
                        "pt-1 text-center text-xs",
                        darkBackdrop ? "text-white/65" : "text-[#64748b]",
                      )}
                    >
                      Don&apos;t have an account?{" "}
                      <button
                        type="button"
                        onClick={() => switchMode("register")}
                        className="font-bold text-[#2563eb] hover:underline"
                      >
                        Sign Up
                      </button>
                    </p>
                  )}
                </form>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
