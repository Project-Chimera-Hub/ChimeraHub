import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

// Surfaces the browser's PWA install flow as a normal button:
//   - On Chrome / Edge / Android we capture the beforeinstallprompt event
//     and trigger prompt() when the user taps the button.
//   - On iOS Safari there's no programmatic prompt, so we surface a small
//     toast with the manual "Share → Add to Home Screen" instructions.
//   - When the app is already installed (display-mode: standalone or
//     navigator.standalone) the button hides itself.
export default function InstallAppButton({ className = '' }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isiOS, setIsiOS] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia?.('(display-mode: standalone)');
    const updateStandalone = () => {
      setIsStandalone(!!(mql?.matches || window.navigator.standalone));
    };
    updateStandalone();
    mql?.addEventListener?.('change', updateStandalone);

    const ua = window.navigator.userAgent || '';
    setIsiOS(/iPad|iPhone|iPod/.test(ua) && !window.MSStream);

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      mql?.removeEventListener?.('change', updateStandalone);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (isStandalone) return null;

  const canPrompt = !!deferredPrompt;
  // iOS Safari never fires beforeinstallprompt, but it does support
  // "Add to Home Screen" via the share sheet. Show the button anyway and
  // pop a hint when tapped.
  if (!canPrompt && !isiOS) return null;

  const handleClick = async () => {
    if (canPrompt) {
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch { /* ignore */ }
      setDeferredPrompt(null);
      return;
    }
    if (isiOS) setShowIosHint(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-primary/20 border border-primary/60 text-primary hover:bg-primary/30 hover:border-primary text-xs font-mono font-semibold transition-colors shadow-[0_0_18px_rgba(43,227,198,0.18)] ${className}`}
        title="Install GOATED n-Back as an app"
      >
        <Download className="w-3.5 h-3.5" />
        Install app
      </button>
      {showIosHint && (
        <div
          onClick={() => setShowIosHint(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/70 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 space-y-3 font-mono text-sm"
          >
            <div className="text-foreground font-semibold">Install on iOS</div>
            <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside">
              <li>Tap the <span className="text-primary">Share</span> button in Safari (the square with the up arrow).</li>
              <li>Scroll down and tap <span className="text-primary">Add to Home Screen</span>.</li>
              <li>Tap <span className="text-primary">Add</span> in the top-right.</li>
            </ol>
            <p className="text-xs text-muted-foreground/70">The icon will appear on your home screen and the app will run full-screen with no Safari chrome.</p>
            <button
              onClick={() => setShowIosHint(false)}
              className="w-full mt-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-mono hover:bg-primary/90"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
