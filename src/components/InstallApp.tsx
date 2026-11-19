import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react";
import { Download } from "lucide-react";

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
const InstallContext = createContext<{ installed: boolean; prompt: (() => Promise<void>) | null }>({
  installed: false,
  prompt: null,
});

export function InstallProvider({ children }: { children: ReactNode }) {
  const [offer, setOffer] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const mode = window.matchMedia("(display-mode: standalone)");
    const check = () =>
      setInstalled(
        mode.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
      );
    const accept = (event: Event) => {
      event.preventDefault();
      setOffer(event as InstallPrompt);
    };
    const finish = () => {
      setInstalled(true);
      setOffer(null);
    };
    check();
    mode.addEventListener("change", check);
    window.addEventListener("beforeinstallprompt", accept);
    window.addEventListener("appinstalled", finish);
    if ("serviceWorker" in navigator && window.isSecureContext)
      void navigator.serviceWorker.register("/reader-sw.js").catch(() => {});
    return () => {
      mode.removeEventListener("change", check);
      window.removeEventListener("beforeinstallprompt", accept);
      window.removeEventListener("appinstalled", finish);
    };
  }, []);
  const prompt =
    offer &&
    (async () => {
      setOffer(null);
      await offer.prompt();
      await offer.userChoice;
    });
  return (
    <InstallContext.Provider value={{ installed, prompt }}>{children}</InstallContext.Provider>
  );
}

export function InstallApp() {
  const { installed, prompt } = useContext(InstallContext);
  const [help, setHelp] = useState(false);
  const id = useId();
  if (installed) return null;
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        className="press inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold text-primary"
        aria-expanded={!prompt ? help : undefined}
        aria-controls={help ? id : undefined}
        onClick={async () => {
          if (prompt) {
            try {
              await prompt();
            } catch {
              setHelp(true);
            }
          } else setHelp(!help);
        }}
      >
        <Download aria-hidden="true" className="size-4" />
        Install app
      </button>
      {help && (
        <div
          id={id}
          className="max-w-sm rounded-2xl bg-card p-4 text-left text-sm text-foreground shadow-soft"
        >
          <p className="font-bold">Add Reading Corner to your device</p>
          <ul className="mt-2 flex list-disc flex-col gap-2 pl-5">
            <li>
              <strong>iPhone or iPad:</strong> Open in Safari, tap Share, then Add to Home Screen
              and Add.
            </li>
            <li>
              <strong>Android:</strong> Open in Chrome and choose Install app or Add to Home screen
              from the menu.
            </li>
            <li>
              <strong>Computer:</strong> Open in Chrome or Edge and select the install icon in the
              address bar when available.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
