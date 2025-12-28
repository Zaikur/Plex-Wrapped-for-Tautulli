import { useState, useEffect } from "react";
import { User, Lock, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TautulliUser } from "@/types/tautulli";
import { verifyServerUserPassword, initializeConfig } from "@/lib/serverConfig";
import { toast } from "sonner";

interface UsernameInputProps {
  users: TautulliUser[];
  onSelectUser: (userId: number | null) => void;
  passwordProtectionEnabled: boolean;
}

export const UsernameInput = ({ users, onSelectUser, passwordProtectionEnabled }: UsernameInputProps) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [matchedUser, setMatchedUser] = useState<TautulliUser | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Initialize config when component mounts to ensure password data is loaded
  useEffect(() => {
    initializeConfig().then(() => {
      setConfigLoaded(true);
    });
  }, []);

  const handleUsernameSubmit = () => {
    if (!username.trim()) {
      toast.error("Please enter a username");
      return;
    }

    // Prevent "user" as username in discreet mode
    if (username.toLowerCase() === "user") {
      toast.error("Invalid username. Please enter a specific user.");
      return;
    }

    // Find user by username only (not friendly name)
    const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
      toast.error("User not found");
      return;
    }

    if (passwordProtectionEnabled) {
      setMatchedUser(user);
      setShowPasswordField(true);
    } else {
      onSelectUser(user.user_id);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!matchedUser) return;

    if (!configLoaded) {
      toast.error("Configuration still loading, please wait...");
      return;
    }

    // Ensure config is fresh before verifying
    await initializeConfig();

    if (verifyServerUserPassword(matchedUser.user_id, password)) {
      onSelectUser(matchedUser.user_id);
      setShowPasswordField(false);
      setPassword("");
      setUsername("");
      setMatchedUser(null);
    } else {
      toast.error("Incorrect password");
      // Reset everything on wrong password
      setPassword("");
      setShowPasswordField(false);
      setMatchedUser(null);
      setUsername("");
    }
  };

  const handleClear = () => {
    setUsername("");
    setPassword("");
    setShowPasswordField(false);
    setMatchedUser(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <User className="w-5 h-5 text-primary" />
        <div className="flex items-center gap-2 flex-1">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            className="bg-card border-border"
            onKeyDown={(e) => e.key === "Enter" && handleUsernameSubmit()}
            disabled={showPasswordField}
          />
          {!showPasswordField && (
            <Button size="icon" onClick={handleUsernameSubmit}>
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {showPasswordField && matchedUser && (
        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5 text-primary" />
          <div className="flex items-center gap-2 flex-1">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`Password for ${matchedUser.friendly_name || matchedUser.username}`}
              className="bg-card border-border"
              onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
              autoFocus
            />
            <Button size="icon" onClick={handlePasswordSubmit} disabled={!configLoaded}>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="outline" onClick={handleClear}>
              ×
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};