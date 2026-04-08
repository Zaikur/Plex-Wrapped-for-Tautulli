import { useEffect, useState } from "react";
import { WrappedReport } from "@/components/WrappedReport";
import { ChristmasMusic } from "@/components/ChristmasMusic";
import { AdminPanel } from "@/components/AdminPanel";
import { Button } from "@/components/ui/button";
import { LogIn, Shield, Sparkles } from "lucide-react";
import { AuthSession, PublicBootstrap, getAuthSession, loadPublicBootstrap, startPlexLogin } from "@/lib/serverConfig";
import type { TautulliConfig } from "@/types/tautulli";
import { toast } from "sonner";

export default function Index() {
  const [config, setConfig] = useState<TautulliConfig | null>(null);
  const [bootstrap, setBootstrap] = useState<PublicBootstrap | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get("auth");
    const authError = params.get("authError");

    if (authStatus === "success") {
      toast.success("Signed in with Plex");
    }

    if (authError) {
      const messages: Record<string, string> = {
        invalid_state: "The Plex sign-in flow expired. Please try again.",
        plex_auth_timeout: "Plex sign-in timed out. Please try again.",
        no_tautulli_mapping: "This Plex account is not mapped to a Tautulli user yet.",
        callback_failed: "Plex sign-in failed. Please try again.",
      };
      toast.error(messages[authError] || "Plex sign-in failed.");
    }

    if (authStatus || authError || params.get("setup")) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("auth");
      cleanUrl.searchParams.delete("authError");
      cleanUrl.searchParams.delete("setup");
      window.history.replaceState({}, "", cleanUrl.toString());
    }

    Promise.all([loadPublicBootstrap(), getAuthSession()])
      .then(([publicState, authSession]) => {
        setBootstrap(publicState);
        setSession(authSession);
        setConfig(publicState.tautulliConfigured ? { url: "", apiKey: "" } : null);
      })
      .catch((error) => {
        console.error(error);
        toast.error("Failed to load Plex Wrapped");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleTautulliConnect = (newConfig: TautulliConfig) => {
    setConfig(newConfig);
    setBootstrap((current) => current ? {
      ...current,
      tautulliConfigured: true,
      setupComplete: !!current.hasAdmin,
    } : current);
  };

  const handleSettingsChange = (adminSettings: PublicBootstrap["adminSettings"]) => {
    setBootstrap((current) => current ? { ...current, adminSettings } : current);
  };

  const handleStartPlexLogin = async () => {
    try {
      await startPlexLogin();
    } catch (error) {
      console.error(error);
      toast.error("Failed to start Plex sign-in");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading Plex Wrapped…
      </div>
    );
  }

  // Show setup screen if not configured
  if (!config) {
    const noAdminBound = !bootstrap?.hasAdmin;
    const signedInAsNonAdmin = !!session?.authenticated && !session.isAdmin;

    return (
      <>
        <ChristmasMusic />
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-noise pointer-events-none" />
          
          <div className="text-center max-w-md relative z-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-bg mb-6 glow">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            
            <h1 className="text-4xl md:text-5xl font-extrabold mb-3 gradient-text">
              Plex Wrapped
            </h1>
            
            <p className="text-muted-foreground text-lg mb-8">
              {noAdminBound
                ? "Sign in with Plex to claim the admin account and finish setup"
                : "Plex Wrapped is not configured yet"}
            </p>

            {session?.isAdmin ? (
              <Button
                size="lg"
                onClick={() => setShowAdminPanel(true)}
                className="bg-gradient-to-r from-cyan to-pink hover:opacity-90 transition-opacity"
              >
                <Shield className="w-5 h-5 mr-2" />
                Open Admin Panel
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={handleStartPlexLogin}
                className="bg-gradient-to-r from-cyan to-pink hover:opacity-90 transition-opacity"
              >
                <LogIn className="w-5 h-5 mr-2" />
                Sign In with Plex
              </Button>
            )}

            <p className="text-sm text-muted-foreground mt-6">
              {signedInAsNonAdmin
                ? `Signed in as ${session?.friendlyName || session?.plexUsername}. This Plex account is not the admin account.`
                : "Only the bound admin Plex account can configure Tautulli."}
            </p>
          </div>
        </div>

        <AdminPanel
          isOpen={showAdminPanel}
          onClose={() => setShowAdminPanel(false)}
          session={session}
          users={[]}
          onSettingsChange={handleSettingsChange}
          onTautulliConnect={handleTautulliConnect}
        />
      </>
    );
  }

  return (
    <>
      <ChristmasMusic />
      <WrappedReport config={config} session={session} onSessionChange={setSession} />
    </>
  );
}