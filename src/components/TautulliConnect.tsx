import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Zap, Server, Key } from "lucide-react";
import { testConnection } from "@/lib/tautulli";
import { TautulliConfig } from "@/types/tautulli";
import { toast } from "sonner";

interface TautulliConnectProps {
  onConnect: (config: TautulliConfig) => void;
}

export const TautulliConnect = ({ onConnect }: TautulliConnectProps) => {
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    if (!url || !apiKey) {
      toast.error("Please enter both URL and API key");
      return;
    }

    setIsLoading(true);
    const config = { url: url.trim(), apiKey: apiKey.trim() };
    const result = await testConnection(config);

    if (result.success) {
      toast.success("Connected to Tautulli!");
      onConnect(config);
    } else {
      toast.error(result.error || "Failed to connect. Check your URL and API key.", {
        duration: 8000,
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-noise pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-bg mb-6 glow"
          >
            <Zap className="w-10 h-10 text-primary" />
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-4xl md:text-5xl font-extrabold mb-3 gradient-text"
          >
            Plex Wrapped
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-muted-foreground text-lg"
          >
            Your year in streaming, beautifully visualized
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="stat-card space-y-6"
        >
          <div className="space-y-2">
            <Label htmlFor="url" className="flex items-center gap-2 text-foreground">
              <Server className="w-4 h-4 text-primary" />
              Tautulli URL
            </Label>
            <Input
              id="url"
              type="url"
              placeholder="http://192.168.1.5:8181"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-background/50 border-border focus:border-primary focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey" className="flex items-center gap-2 text-foreground">
              <Key className="w-4 h-4 text-primary" />
              API Key
            </Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Your Tautulli API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="bg-background/50 border-border focus:border-primary focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">
              Find this in Tautulli → Settings → Web Interface → API Key
            </p>
            <div className="text-xs text-muted-foreground/70 mt-2 p-2 bg-muted/30 rounded space-y-1">
              <p className="font-medium text-muted-foreground">💡 Connection Tips:</p>
              <p>• Use your server's IP address: <code className="bg-muted px-1 rounded">http://192.168.1.5:8181</code></p>
              <p>• If you have a HTTP Root in Tautulli (like /stats), include it: <code className="bg-muted px-1 rounded">http://192.168.1.5:8181/stats</code></p>
              <p>• Docker users having issues? Try <code className="bg-muted px-1 rounded">http://host.docker.internal:8181</code></p>
              <p>• Avoid using <code className="bg-muted px-1 rounded">localhost</code> or <code className="bg-muted px-1 rounded">127.0.0.1</code> from Docker</p>
              <p>• Remote access: Use a reverse proxy with HTTPS</p>
            </div>
          </div>

          <Button
            onClick={handleConnect}
            disabled={isLoading}
            className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-cyan to-pink hover:opacity-90 transition-opacity"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-5 w-5" />
                Connect & Unwrap
              </>
            )}
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-center text-sm text-muted-foreground mt-6"
        >
          Your data stays local. Nothing is sent to external servers.
        </motion.p>
      </motion.div>
    </div>
  );
};