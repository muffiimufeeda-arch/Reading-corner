import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Lock, Nfc, Phone, ShieldAlert } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/Logo";
import { TripleTapExit } from "@/components/TripleTapExit";
import { loginWithPhone, logout, resolveNfcToken, useChat } from "@/lib/chat-store";

export const Route = createFileRoute("/nfc/$token")({
  head: () => ({
    meta: [{ title: "Personal NFC Link — Reading Corner" }, { name: "robots", content: "noindex" }],
  }),
  component: NfcTapPage,
});

const COUNTRY_CODES = ["+91", "+1", "+44", "+971", "+966", "+65", "+61"];

function NfcTapPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { ready, me } = useChat();

  const [status, setStatus] = useState<"checking" | "authorized" | "login_required" | "invalid">(
    "checking",
  );
  const [ownerHint, setOwnerHint] = useState("R***");
  const [differentAccount, setDifferentAccount] = useState(false);

  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;
    let active = true;
    resolveNfcToken(token)
      .then((res) => {
        if (!active) return;
        if (res.status === "authorized") {
          setStatus("authorized");
          toast.success(`Welcome back, ${res.owner?.fullName ?? "Reader"}`);
          window.setTimeout(() => {
            navigate({ to: "/messages", replace: true });
          }, 600);
        } else {
          setStatus("login_required");
          setOwnerHint(res.ownerHint ?? "R***");
          setDifferentAccount(Boolean(res.signedInAsDifferentAccount));
        }
      })
      .catch(() => {
        if (!active) return;
        setStatus("invalid");
      });
    return () => {
      active = false;
    };
  }, [token, ready, me?.id, navigate]);

  async function handleCardLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (phone.replace(/\D/g, "").length < 7 || !password) {
      setError("Enter your phone number and password.");
      return;
    }
    setBusy(true);
    try {
      if (differentAccount) {
        await logout();
      }
      await loginWithPhone({ phone, countryCode, password });
      const recheck = await resolveNfcToken(token);
      if (recheck.status === "authorized") {
        setStatus("authorized");
        toast.success("NFC card verified");
        navigate({ to: "/messages", replace: true });
      } else {
        setError(
          "This account does not match this NFC card. Sign in with the card owner's phone number and password.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid phone number or password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-gradient-to-b from-[#060913] via-[#0c1427] to-[#07090f] px-4 py-10 text-white">
      {/* Drifting 3D Glass Ambient Orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          animate={{ x: [0, 22, -12, 0], y: [0, 14, -10, 0], scale: [1, 1.08, 0.96, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -left-24 -top-24 size-96 rounded-full bg-gradient-to-tr from-[#2563eb]/35 via-[#dd2a7b]/25 to-[#8134af]/30 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -20, 14, 0], y: [0, -14, 10, 0], scale: [1.04, 0.95, 1.07, 1.04] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-24 -right-24 size-96 rounded-full bg-gradient-to-tr from-[#f58529]/22 via-[#e11d48]/26 to-[#3b82f6]/32 blur-3xl"
        />
      </div>

      <TripleTapExit />

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="relative w-full max-w-md"
      >
        {/* Upper Frosted Glass Header Crest */}
        <div className="rounded-t-[32px] border border-b-0 border-[#3b82f6]/30 bg-gradient-to-b from-[#162039]/84 to-[#10172b]/76 px-6 pb-8 pt-6 backdrop-blur-2xl shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.2)]">
          <div className="flex items-center gap-3.5">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              className="glass-sheen grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white shadow-[0_10px_24px_-6px_rgba(221,42,123,0.6)]"
            >
              {status === "invalid" ? (
                <ShieldAlert className="size-5" />
              ) : status === "authorized" ? (
                <CheckCircle2 className="size-5" />
              ) : (
                <Nfc className="size-5" />
              )}
            </motion.div>
            <div>
              <p className="font-display text-lg font-extrabold tracking-tight">
                Reading Corner NFC Card
              </p>
              <p className="text-xs text-white/70">Personal secret link verification</p>
            </div>
          </div>
        </div>

        {/* Lower Overlapping Curved Frosted Form Sheet */}
        <div className="-mt-4 rounded-[32px] border border-[#3b82f6]/35 bg-[#0f1628]/86 p-6 text-white backdrop-blur-2xl shadow-[inset_0_1.5px_1px_rgba(147,197,253,0.22),0_26px_60px_-14px_rgba(37,99,235,0.42)] sm:p-7">
          {status === "checking" && (
            <div className="space-y-3 py-4 text-center">
              <Logo className="mx-auto size-12 animate-pulse" />
              <p className="text-sm font-semibold">Verifying NFC card link…</p>
              <p className="text-xs text-white/65">Checking your active device session securely.</p>
            </div>
          )}

          {status === "authorized" && (
            <div className="rounded-2xl border border-emerald-400/35 bg-emerald-500/15 p-5 text-center text-emerald-100">
              <CheckCircle2 className="mx-auto size-9 text-emerald-400" />
              <p className="mt-2 font-display text-base font-bold">Session verified</p>
              <p className="mt-1 text-xs text-emerald-200/80">
                Opening your Reading Corner account…
              </p>
            </div>
          )}

          {status === "invalid" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-rose-400/35 bg-rose-500/15 p-4 text-rose-100">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-400" />
                  <div>
                    <p className="text-sm font-bold">Link Revoked or Invalid</p>
                    <p className="mt-1 text-xs leading-relaxed text-rose-200/80">
                      This NFC card link has been revoked, regenerated, or does not exist. For your
                      security, no account information is accessible.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  to="/auth"
                  className="glass-sheen flex-1 rounded-full bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] py-3 text-center text-xs font-bold text-white shadow-md"
                >
                  Sign In Normally
                </Link>
                <Link
                  to="/home"
                  className="flex-1 rounded-full border border-white/15 bg-white/10 py-3 text-center text-xs font-bold text-white hover:bg-white/15"
                >
                  Reading Home
                </Link>
              </div>
            </div>
          )}

          {status === "login_required" && (
            <form onSubmit={handleCardLogin} className="space-y-4">
              <div className="rounded-2xl border border-white/15 bg-white/5 p-3.5 text-xs text-white/80">
                <p className="font-semibold text-white">Card detected for account ({ownerHint})</p>
                <p className="mt-1 leading-relaxed text-white/65">
                  {differentAccount
                    ? "This device is currently signed into a different account. Sign in with the card owner's phone number and password to open their account."
                    : "Sign in with your phone number and password to unlock this personal NFC card."}
                </p>
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-semibold text-white/80">
                  Phone number
                </span>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="rounded-full border border-white/15 bg-[#172038]/90 px-3 py-2.5 text-xs font-bold text-white outline-none"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-1 items-center gap-2.5 rounded-full border border-white/15 bg-[#172038]/90 p-1.5 focus-within:ring-2 focus-within:ring-[#dd2a7b]/40">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-[#2563eb] to-[#3b82f6] text-white shadow">
                      <Phone className="size-3.5" />
                    </span>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone number"
                      className="min-w-0 flex-1 bg-transparent pr-3 text-sm text-white outline-none placeholder:text-white/45"
                    />
                  </div>
                </div>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-white/80">Password</span>
                <div className="flex items-center gap-2.5 rounded-full border border-white/15 bg-[#172038]/90 p-1.5 focus-within:ring-2 focus-within:ring-[#dd2a7b]/40">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-[#dd2a7b] to-[#8134af] text-white shadow">
                    <Lock className="size-3.5" />
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="min-w-0 flex-1 bg-transparent pr-3 text-sm text-white outline-none placeholder:text-white/45"
                  />
                </div>
              </label>

              {error && (
                <p className="rounded-2xl border border-rose-400/30 bg-rose-500/15 px-3.5 py-2.5 text-xs font-medium text-rose-200">
                  {error}
                </p>
              )}

              <motion.button
                type="submit"
                disabled={busy}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="glass-sheen min-h-[48px] w-full rounded-full bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] py-3 text-sm font-bold text-white shadow-[0_12px_28px_-6px_rgba(221,42,123,0.55)] disabled:opacity-60"
              >
                {busy ? "Verifying…" : "Unlock Account"}
              </motion.button>

              <div className="text-center">
                <Link to="/home" className="text-xs font-semibold text-white/65 hover:underline">
                  Return to Reading Corner
                </Link>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
