import { useEffect, useState } from "react";
import { WrappedReport } from "@/components/WrappedReport";
import { ChristmasMusic } from "@/components/ChristmasMusic";
import { AdminPanel } from "@/components/AdminPanel";
import { Button } from "@/components/ui/button";
import { Shield, Sparkles } from "lucide-react";
import { initializeConfig } from "@/lib/serverConfig";
import type { TautulliConfig } from "@/types/tautulli";

export default function Index() {
  const [config, setConfig] = useState<TautulliConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  useEffect(() => {
    initializeConfig().then((serverConfig) => {
      setConfig(serverConfig.tautulli || null);
      setLoading(false);
    });
  }, []);

  const handleTautulliConnect = (newConfig: TautulliConfig) => {
    setConfig(newConfig);
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
              Plex Wrapped is not configured yet
            </p>

            <Button
              size="lg"
              onClick={() => setShowAdminPanel(true)}
              className="bg-gradient-to-r from-cyan to-pink hover:opacity-90 transition-opacity"
            >
              <Shield className="w-5 h-5 mr-2" />
              Open Admin Panel
            </Button>

            <p className="text-sm text-muted-foreground mt-6">
              Server administrators can configure Tautulli connection
            </p>
          </div>
        </div>

        <AdminPanel
          isOpen={showAdminPanel}
          onClose={() => setShowAdminPanel(false)}
          users={[]}
          onSettingsChange={() => {}}
          onTautulliConnect={handleTautulliConnect}
        />
      </>
    );
  }

  return (
    <>
      <ChristmasMusic />
      <WrappedReport config={config} />
    </>
  );
}