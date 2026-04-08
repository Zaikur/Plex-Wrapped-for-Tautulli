import { useEffect, useRef, useState } from "react";
import { Globe, Image, Key, Loader2, LogIn, RefreshCw, Server, Settings2, Shield, Trash2, Trophy, Upload, UserCog, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { TautulliConfig, TautulliUser } from "@/types/tautulli";
import { testConnection } from "@/lib/tautulli";
import { AdminSettings } from "@/lib/adminStorage";
import {
  AuthSession,
  PlexAuthConfig,
  getPlexAuthConfig,
  getServerAdminSettings,
  getTautulliConfig,
  loadAdminConfig,
  savePlexUserMappingOverrides,
  saveServerAdminSettings,
  setTautulliConfig,
  startPlexLogin,
  uploadLogo,
  deleteLogo,
  checkLogoExists,
  getLogoUrl,
} from "@/lib/serverConfig";
import { ImageExportDialog } from "./ImageExportDialog";
import { toast } from "sonner";

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  session: AuthSession | null;
  users: TautulliUser[];
  onSettingsChange: (settings: AdminSettings) => void;
  onTautulliConnect?: (config: TautulliConfig) => void;
}

const caseInsensitiveEquals = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase();

export const AdminPanel = ({
  isOpen,
  onClose,
  session,
  users,
  onSettingsChange,
  onTautulliConnect,
}: AdminPanelProps) => {
  const [settings, setSettings] = useState<AdminSettings>(getServerAdminSettings());
  const [plexAuthConfig, setPlexAuthConfig] = useState<PlexAuthConfig>(getPlexAuthConfig());
  const [mappingDrafts, setMappingDrafts] = useState<Record<number, string>>({});
  const [isLoadingAdminConfig, setIsLoadingAdminConfig] = useState(false);

  const [tautulliUrl, setTautulliUrl] = useState("");
  const [tautulliApiKey, setTautulliApiKey] = useState("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [currentTautulliConfig, setCurrentTautulliConfig] = useState<TautulliConfig | undefined>(getTautulliConfig());

  const [showImageExport, setShowImageExport] = useState(false);

  const [logoExists, setLogoExists] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const initialize = async () => {
      setSettings(getServerAdminSettings());
      setPlexAuthConfig(getPlexAuthConfig());

      const exists = await checkLogoExists();
      setLogoExists(exists);
      setLogoPreviewUrl(exists ? getLogoUrl() : "");

      if (!session?.isAdmin) {
        return;
      }

      setIsLoadingAdminConfig(true);
      try {
        const adminConfig = await loadAdminConfig();
        setSettings(adminConfig.adminSettings);
        setPlexAuthConfig(adminConfig.plexAuth);
        setCurrentTautulliConfig(adminConfig.tautulli);
        setTautulliUrl(adminConfig.tautulli?.url || "");
        setTautulliApiKey(adminConfig.tautulli?.apiKey || "");
      } catch (error) {
        console.error(error);
        toast.error("Failed to load admin configuration");
      } finally {
        setIsLoadingAdminConfig(false);
      }
    };

    initialize();
  }, [isOpen, session?.isAdmin]);

  const handleStartPlexLogin = async () => {
    try {
      await startPlexLogin();
    } catch (error) {
      console.error(error);
      toast.error("Failed to start Plex sign-in");
    }
  };

  const handleSettingChange = async (key: keyof AdminSettings, value: boolean | string | number) => {
    const nextSettings = {
      ...settings,
      [key]: value,
    };

    setSettings(nextSettings);
    onSettingsChange(nextSettings);

    try {
      await saveServerAdminSettings(nextSettings);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save admin settings");
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Only PNG, JPEG, WebP, and SVG are allowed.");
      return;
    }

    setIsUploadingLogo(true);
    const result = await uploadLogo(file);
    if (result.success) {
      toast.success("Logo uploaded successfully");
      const exists = await checkLogoExists();
      setLogoExists(exists);
      setLogoPreviewUrl(exists ? getLogoUrl() : "");
      if (!settings.useCustomLogo) {
        await handleSettingChange("useCustomLogo", true);
      }
    } else {
      toast.error(result.error || "Failed to upload logo");
    }

    setIsUploadingLogo(false);
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  };

  const handleDeleteLogo = async () => {
    const result = await deleteLogo();
    if (result.success) {
      toast.success("Logo deleted successfully");
      setLogoExists(false);
      setLogoPreviewUrl("");
      await handleSettingChange("useCustomLogo", false);
    } else {
      toast.error(result.error || "Failed to delete logo");
    }
  };

  const handleTestTautulliConnection = async () => {
    if (!tautulliUrl || !tautulliApiKey) {
      toast.error("Please enter both URL and API key");
      return;
    }

    setIsTestingConnection(true);
    const config = {
      url: tautulliUrl.trim(),
      apiKey: tautulliApiKey.trim(),
    };

    try {
      const result = await testConnection(config);
      if (!result.success) {
        toast.error(result.error || "Failed to connect. Check your URL and API key.", { duration: 8000 });
        return;
      }

      await setTautulliConfig(config);
      setCurrentTautulliConfig(config);
      toast.success("Connected to Tautulli! Configuration saved.");
      onTautulliConnect?.(config);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save the Tautulli configuration");
    } finally {
      setIsTestingConnection(false);
    }
  };

  const getOverrideForUser = (user: TautulliUser) => {
    return plexAuthConfig.userMappingOverrides.find((override) => override.tautulliUserId === user.user_id);
  };

  const getDraftValue = (user: TautulliUser) => {
    const draft = mappingDrafts[user.user_id];
    if (draft !== undefined) {
      return draft;
    }
    return getOverrideForUser(user)?.plexUsername || user.username;
  };

  const handleMappingDraftChange = (userId: number, value: string) => {
    setMappingDrafts((current) => ({
      ...current,
      [userId]: value,
    }));
  };

  const handleSaveMapping = async (user: TautulliUser) => {
    const nextPlexUsername = getDraftValue(user).trim();
    if (!nextPlexUsername) {
      toast.error("Plex username cannot be empty");
      return;
    }

    const otherOverrides = plexAuthConfig.userMappingOverrides.filter((override) => {
      return override.tautulliUserId !== user.user_id && !caseInsensitiveEquals(override.plexUsername, nextPlexUsername);
    });
    const nextOverrides = caseInsensitiveEquals(nextPlexUsername, user.username)
      ? otherOverrides
      : [
          ...otherOverrides,
          {
            plexUsername: nextPlexUsername,
            tautulliUserId: user.user_id,
            tautulliUsername: user.username,
            friendlyName: user.friendly_name || user.username,
          },
        ];

    try {
      await savePlexUserMappingOverrides(nextOverrides);
      setPlexAuthConfig((current) => ({
        ...current,
        userMappingOverrides: nextOverrides,
      }));
      toast.success(caseInsensitiveEquals(nextPlexUsername, user.username) ? "Override cleared" : "Override saved");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save Plex username override");
    }
  };

  const handleResetMapping = async (user: TautulliUser) => {
    try {
      const nextOverrides = plexAuthConfig.userMappingOverrides.filter((override) => override.tautulliUserId !== user.user_id);
      await savePlexUserMappingOverrides(nextOverrides);
      setPlexAuthConfig((current) => ({
        ...current,
        userMappingOverrides: nextOverrides,
      }));
      setMappingDrafts((current) => ({
        ...current,
        [user.user_id]: user.username,
      }));
      toast.success("Override removed");
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove Plex username override");
    }
  };

  if (!isOpen) {
    return null;
  }

  const renderAccessState = () => {
    if (!session?.authenticated) {
      return (
        <div className="space-y-4 py-6 text-center">
          <Shield className="w-12 h-12 text-primary mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Admin access requires Plex sign-in</h3>
            <p className="text-sm text-muted-foreground">
              Sign in with the Plex account bound to this Plex Wrapped installation.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={handleStartPlexLogin}>
              <LogIn className="w-4 h-4 mr-2" />
              Sign In with Plex
            </Button>
          </DialogFooter>
        </div>
      );
    }

    if (!session.isAdmin) {
      return (
        <div className="space-y-4 py-6 text-center">
          <Shield className="w-12 h-12 text-primary mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">This Plex account is not the admin account</h3>
            <p className="text-sm text-muted-foreground">
              Signed in as {session.friendlyName || session.plexUsername}. Only the bound admin Plex account can open this panel.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>
        </div>
      );
    }

    if (isLoadingAdminConfig) {
      return (
        <div className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading admin configuration…</p>
        </div>
      );
    }

    return (
      <div className="space-y-6 py-4">
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          Admin account: <span className="font-medium text-foreground">{plexAuthConfig.adminPlexUsername || session.plexUsername}</span>
        </div>

        <Tabs defaultValue="connection" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="connection" className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              <span className="hidden sm:inline">Connection</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="export" className="flex items-center gap-2">
              <Image className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connection" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Server className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Tautulli Connection</h3>
                  {currentTautulliConfig && (
                    <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full">Connected</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Configure the shared Tautulli connection used to generate reports.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="tautulli-url" className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-primary" />
                    Tautulli URL
                  </Label>
                  <Input
                    id="tautulli-url"
                    type="url"
                    placeholder="http://localhost:8181"
                    value={tautulliUrl}
                    onChange={(event) => setTautulliUrl(event.target.value)}
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tautulli-api" className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-primary" />
                    API Key
                  </Label>
                  <Input
                    id="tautulli-api"
                    type="password"
                    placeholder="Your Tautulli API key"
                    value={tautulliApiKey}
                    onChange={(event) => setTautulliApiKey(event.target.value)}
                    className="bg-background/50"
                  />
                  <p className="text-xs text-muted-foreground">Find this in Tautulli → Settings → Web Interface → API Key</p>
                </div>

                <Button onClick={handleTestTautulliConnection} disabled={isTestingConnection} className="w-full">
                  {isTestingConnection ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing Connection...
                    </>
                  ) : currentTautulliConfig ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Test & Update Connection
                    </>
                  ) : (
                    <>
                      <Server className="mr-2 h-4 w-4" />
                      Test & Save Connection
                    </>
                  )}
                </Button>
              </div>

              <div className="text-xs text-muted-foreground/70 p-3 bg-muted/30 rounded-lg space-y-1">
                <p className="font-medium text-muted-foreground">Connection Tips:</p>
                <p>Use an address reachable from this container or host.</p>
                <p>If Tautulli runs in Docker too, use the service name or a shared network hostname.</p>
                <p>HTTPS is recommended if the app is exposed externally.</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 mt-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="custom-logo" className="text-base flex items-center gap-2">
                    <Image className="w-4 h-4" />
                    Custom Logo
                  </Label>
                  <p className="text-sm text-muted-foreground">Display a custom logo on reports and export slides.</p>
                </div>
                <Switch
                  id="custom-logo"
                  checked={settings.useCustomLogo}
                  onCheckedChange={(checked) => handleSettingChange("useCustomLogo", checked)}
                  disabled={!logoExists}
                />
              </div>

              <div className="pt-2 space-y-3">
                {logoExists && logoPreviewUrl && (
                  <div className="flex items-center justify-center p-4 bg-background/50 rounded-lg border border-border">
                    <img
                      src={logoPreviewUrl}
                      alt="Custom logo preview"
                      style={{ maxHeight: `${settings.logoMaxHeight}px`, maxWidth: "100%", objectFit: "contain" }}
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={isUploadingLogo}
                  >
                    {isUploadingLogo ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        {logoExists ? "Replace Logo" : "Upload Logo"}
                      </>
                    )}
                  </Button>
                  {logoExists && (
                    <Button variant="outline" onClick={handleDeleteLogo} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {logoExists && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Logo Max Height</Label>
                      <span className="text-sm text-muted-foreground">{settings.logoMaxHeight}px</span>
                    </div>
                    <Slider
                      value={[settings.logoMaxHeight]}
                      onValueChange={([value]) => handleSettingChange("logoMaxHeight", value)}
                      min={40}
                      max={200}
                      step={10}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="custom-title" className="text-base">Custom Title</Label>
                  <p className="text-sm text-muted-foreground">Use a custom title instead of "Plex Wrapped".</p>
                </div>
                <Switch id="custom-title" checked={settings.useCustomTitle} onCheckedChange={(checked) => handleSettingChange("useCustomTitle", checked)} />
              </div>
              {settings.useCustomTitle && (
                <Input
                  value={settings.customTitle}
                  onChange={(event) => handleSettingChange("customTitle", event.target.value)}
                  placeholder="Plex Wrapped"
                  className="bg-background/50"
                />
              )}
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="space-y-0.5">
                <Label htmlFor="normalize-anomalies" className="text-base">Normalize Tautulli Anomalies</Label>
                <p className="text-sm text-muted-foreground">Cap impossible watch durations to the actual media runtime.</p>
              </div>
              <Switch
                id="normalize-anomalies"
                checked={settings.normalizeTautulliAnomalies}
                onCheckedChange={(checked) => handleSettingChange("normalizeTautulliAnomalies", checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="space-y-0.5">
                <Label htmlFor="enable-geolocation" className="text-base flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Streaming Locations
                </Label>
                <p className="text-sm text-muted-foreground">Show a map of where streams originated from.</p>
              </div>
              <Switch id="enable-geolocation" checked={settings.enableGeolocation} onCheckedChange={(checked) => handleSettingChange("enableGeolocation", checked)} />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="space-y-0.5">
                <Label htmlFor="show-leaderboard" className="text-base flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  Show Leaderboard
                </Label>
                <p className="text-sm text-muted-foreground">Display the user leaderboard in All Users reports.</p>
              </div>
              <Switch id="show-leaderboard" checked={settings.showLeaderboard} onCheckedChange={(checked) => handleSettingChange("showLeaderboard", checked)} />
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4 mt-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Plex usernames map to Tautulli usernames automatically. Use overrides here only if a user’s Plex account name does not match their Tautulli username.
            </div>

            {users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserCog className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No users found. Connect to Tautulli first to manage user mappings.</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Tautulli Username</TableHead>
                      <TableHead>Plex Username</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="w-[160px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const override = getOverrideForUser(user);
                      const draftValue = getDraftValue(user);

                      return (
                        <TableRow key={user.user_id}>
                          <TableCell className="font-medium">{user.friendly_name || user.username}</TableCell>
                          <TableCell className="text-muted-foreground">{user.username}</TableCell>
                          <TableCell>
                            <Input
                              value={draftValue}
                              onChange={(event) => handleMappingDraftChange(user.user_id, event.target.value)}
                              className="h-8 bg-background/50"
                              placeholder={user.username}
                            />
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${override ? "bg-amber-500/15 text-amber-500" : "bg-green-500/15 text-green-500"}`}>
                              {override ? "Override" : "Auto"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleSaveMapping(user)}>
                                Save
                              </Button>
                              {override && (
                                <Button size="sm" variant="ghost" onClick={() => handleResetMapping(user)}>
                                  Reset
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="export" className="space-y-4 mt-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Image className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Export as Images</h3>
              </div>
              <p className="text-sm text-muted-foreground">Generate PNG exports for one or more Plex Wrapped reports.</p>

              {!currentTautulliConfig ? (
                <div className="text-center py-4 text-sm text-muted-foreground">Connect to Tautulli first to export images.</div>
              ) : users.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">No users found.</div>
              ) : (
                <Button onClick={() => setShowImageExport(true)} className="w-full">
                  <Image className="w-4 h-4 mr-2" />
                  Select Users & Export Images
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Admin Panel
            </DialogTitle>
            <DialogDescription>
              Configure Plex Wrapped, manage Tautulli connectivity, and review Plex-to-Tautulli user mappings.
            </DialogDescription>
          </DialogHeader>

          {renderAccessState()}
        </DialogContent>
      </Dialog>

      {currentTautulliConfig && (
        <ImageExportDialog
          isOpen={showImageExport}
          onClose={() => setShowImageExport(false)}
          users={users}
          config={currentTautulliConfig}
        />
      )}
    </>
  );
};