import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Lock, Nfc, Phone, ShieldAlert } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/Logo";
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
    <div className="grid min-h-[100dvh] place-items-center bg-[#0b0a10] px-4 py-10 text-white">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-white/15 bg-white p-6 text-[#111827] shadow-2xl sm:p-8"
      >
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-tr from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white">
            {status === "invalid" ? (
              <ShieldAlert className="size-5" />
            ) : status === "authorized" ? (
              <CheckCircle2 className="size-5" />
            ) : (
              <Nfc className="size-5" />
            )}
          </div>
          <div>
            <p className="font-display text-lg font-extrabold">Reading Corner NFC Card</p>
            <p className="text-xs text-[#6b7280]">Personal secret link verification</p>
          </div>
        </div>

        {status === "checking" && (
          <div className="mt-8 space-y-3 text-center">
            <Logo className="mx-auto size-12 animate-pulse" />
            <p className="text-sm font-semibold">Verifying NFC card link…</p>
            <p className="text-xs text-[#6b7280]">Checking your active device session securely.</p>
          </div>
        )}

        {status === "authorized" && (
          <div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-center text-emerald-900">
            <CheckCircle2 className="mx-auto size-8 text-emerald-600" />
            <p className="mt-2 font-display text-base font-bold">Session verified</p>
            <p className="mt-1 text-xs text-emerald-700">Opening your Reading Corner account…</p>
          </div>
        )}

        {status === "invalid" && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl bg-rose-50 p-4 text-rose-900">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-600" />
                <div>
                  <p className="text-sm font-bold">Link Revoked or Invalid</p>
                  <p className="mt-1 text-xs leading-relaxed text-rose-700">
                    This NFC card link has been revoked, regenerated, or does not exist. For your
                    security, no account information is accessible.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                to="/auth"
                className="flex-1 rounded-xl bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] py-3 text-center text-xs font-bold text-white"
              >
                Sign In Normally
              </Link>
              <Link
                to="/home"
                className="flex-1 rounded-xl bg-[#f3f4f6] py-3 text-center text-xs font-bold text-[#111827]"
              >
                Reading Home
              </Link>
            </div>
          </div>
        )}

        {status === "login_required" && (
          <form onSubmit={handleCardLogin} className="mt-6 space-y-4">
            <div className="rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-3.5 text-xs text-[#374151]">
              <p className="font-semibold text-[#111827]">
                Card detected for account ({ownerHint})
              </p>
              <p className="mt-1 leading-relaxed text-[#6b7280]">
                {differentAccount
                  ? "This device is currently signed into a different account. Sign in with the card owner's phone number and password to open their account."
                  : "Sign in with your phone number and password to unlock this personal NFC card."}
              </p>
            </div>

            <div>
              <span className="mb-1 block text-xs font-semibold text-[#374151]">Phone number</span>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="rounded-xl border border-[#d1d5db] bg-[#f9fafb] px-2.5 py-2.5 text-xs font-semibold outline-none"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <span className="relative flex-1">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6b7280]" />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone number"
                    className="w-full rounded-xl border border-[#d1d5db] bg-[#f9fafb] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#dd2a7b] focus:bg-white"
                  />
                </span>
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[#374151]">Password</span>
              <span className="relative block">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6b7280]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-[#d1d5db] bg-[#f9fafb] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#dd2a7b] focus:bg-white"
                />
              </span>
            </label>

            {error && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="min-h-[46px] w-full rounded-xl bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] py-3 text-sm font-bold text-white shadow-md disabled:opacity-60"
            >
              {busy ? "Verifying…" : "Unlock Account"}
            </button>

            <div className="text-center">
              <Link to="/home" className="text-xs font-semibold text-[#6b7280] hover:underline">
                Return to Reading Corner
              </Link>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
