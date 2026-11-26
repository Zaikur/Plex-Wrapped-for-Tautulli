import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Lock, RefreshCw, Users, Settings2, AlertCircle, Server, Key, Loader2, Image, Upload, Trash2, Trophy, Medal, Globe, Database, LogOut, ExternalLink, MonitorSmartphone, CalendarDays, Music, Gift, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { AdminSettings, DAYS_IN_MONTH, DEFAULT_ADMIN_SETTINGS, formatMonthDay, getDisplayTitle, parseMonthDay } from "@/lib/adminStorage";
import { getDefaultYear } from "./YearSelector";
import { customAppIconUrl, defaultAppIconUrl } from "@/lib/appIcons";
import { renderAppIcons } from "@/lib/pwa";
import { AUDIO_SLOTS, type AudioSlot } from "@/lib/audio";
import { AudioSetting } from "./AudioSetting";
import { pauseBackgroundMusic } from "@/lib/sounds";
import { ImageExportDialog } from "./ImageExportDialog";
import { checkLogoExists, getLogoUrl, setCachedSettings } from "@/lib/serverConfig";
import { THEMES, THEME_IDS, type ThemeId } from "@/lib/themes";
import { applyTheme } from "@/lib/applyTheme";
import { api, ApiError } from "@/lib/api";
import type { AdminConfig, ApiUser, CacheStatus, CustomAudioInfo, VersionInfo } from "@/types/api";
import { APP_VERSION } from "@/version";
import { toast } from "sonner";

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type View = "loading" | "login" | "panel";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const formatTime = (ms: number | null) => (ms ? new Date(ms).toLocaleString() : "Never");

const VersionBadge = ({ version }: { version: VersionInfo | null }) => {
  const base = "text-xs font-normal px-2 py-0.5 rounded-full";
  if (!version) return <span className={`${base} bg-muted text-muted-foreground`}>{APP_VERSION}</span>;
  switch (version.status) {
    case "update-available":
      return (
        <a
          href={version.releaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${base} bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 inline-flex items-center gap-1`}
        >
          {version.current} · Update available: {version.latest}
          <ExternalLink className="w-3 h-3" />
        </a>
      );
    case "up-to-date":
      return <span className={`${base} bg-green/20 text-green`}>{version.current} · Up to date</span>;
    case "develop":
      return <span className={`${base} bg-purple/20 text-purple`}>{version.current} · Develop Build</span>;
    default:
      return <span className={`${base} bg-muted text-muted-foreground`}>{version.current} · Couldn't check for updates</span>;
  }
};

export const AdminPanel = ({ isOpen, onClose }: AdminPanelProps) => {
  const [view, setView] = useState<View>("loading");
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_ADMIN_SETTINGS);
  const [plexServer, setPlexServer] = useState<AdminConfig["plexServer"]>(null);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [userMappings, setUserMappings] = useState<AdminConfig["userMappings"]>([]);
  const [adminPlexUsername, setAdminPlexUsername] = useState("");
  const [mappingUsername, setMappingUsername] = useState("");
  const [mappingUserId, setMappingUserId] = useState("");
  const [savingMapping, setSavingMapping] = useState(false);
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);

  // Tautulli connection state
  const [tautulliUrl, setTautulliUrl] = useState("");
  const [tautulliApiKey, setTautulliApiKey] = useState("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connected, setConnected] = useState(false);

  // Image Export state
  const [showImageExport, setShowImageExport] = useState(false);

  // Logo state
  const [logoExists, setLogoExists] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string>("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // App (PWA) icon state
  const [appIconVersion, setAppIconVersion] = useState<number | null>(null);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);

  // Uploaded sounds (background music, unwrap sound)
  const [customAudio, setCustomAudio] = useState<AdminConfig["customAudio"]>({ music: null, unwrap: null });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<Partial<AdminSettings>>({});

  const checkLogoStatus = async () => {
    const exists = await checkLogoExists();
    setLogoExists(exists);
    setLogoPreviewUrl(exists ? getLogoUrl() : "");
  };

  const loadPanel = useCallback(async () => {
    const config = await api.admin.config();
    setSettings(config.settings);
    setPlexServer(config.plexServer);
    setUserMappings(config.userMappings);
    setAdminPlexUsername(config.adminPlexUsername);
    setConnected(Boolean(config.tautulli));
    setTautulliUrl(config.tautulli?.url ?? "");
    setTautulliApiKey(config.tautulli?.apiKey ?? "");
    setAppIconVersion(config.appIconVersion);
    setCustomAudio(config.customAudio);
    setView("panel");
    checkLogoStatus();
    api.admin.cacheStatus().then(setCacheStatus).catch(() => {});
    api.admin.version().then(setVersion).catch(() => {});
    if (config.tautulli) {
      api.users().then(setUsers).catch(() => setUsers([]));
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setView("loading");
    api.admin
      .status()
      .then((status) => {
        if (status.authenticated) loadPanel().catch(() => setView("login"));
        else setView("login");
      })
      .catch(() => {
        toast.error("Could not reach the server");
        setView("login");
      });
  }, [isOpen, loadPanel]);

  // Keep the cache status fresh while the panel is open (faster while a sync is running)
  const cacheRunning = Boolean(cacheStatus && cacheStatus.state !== "idle");
  useEffect(() => {
    if (!isOpen || view !== "panel") return;
    const interval = setInterval(() => {
      api.admin.cacheStatus().then(setCacheStatus).catch(() => {});
    }, cacheRunning ? 2000 : 10000);
    return () => clearInterval(interval);
  }, [isOpen, view, cacheRunning]);

  // Check for updates again now and then while the panel stays open
  useEffect(() => {
    if (!isOpen || view !== "panel") return;
    const interval = setInterval(() => {
      api.admin.version().then(setVersion).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isOpen, view]);

  const handleLogout = async () => {
    await api.admin.logout().catch(() => {});
    onClose();
  };

  const flushSettings = async () => {
    const patch = pendingPatch.current;
    pendingPatch.current = {};
    saveTimer.current = null;
    try {
      const saved = await api.admin.saveSettings(patch);
      setSettings(saved);
      setCachedSettings(saved);
    } catch (error) {
      toast.error((error as Error).message);
      // Re-sync with what the server has
      api.admin
        .config()
        .then((c) => {
          setSettings(c.settings);
          applyTheme(c.settings.theme);
        })
        .catch(() => {});
    }
  };

  const handleSettingChange = <K extends keyof AdminSettings>(key: K, value: AdminSettings[K], debounce = false) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    // Show a new theme right away, without waiting for the save
    if (key === "theme") applyTheme(value);
    pendingPatch.current = { ...pendingPatch.current, [key]: value };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (debounce) saveTimer.current = setTimeout(flushSettings, 500);
    else flushSettings();


  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Only PNG, JPEG, WebP, and SVG are allowed.");
      return;
    }

    setIsUploadingLogo(true);
    try {
      await api.admin.uploadLogo(file);
      toast.success("Logo uploaded successfully");
      await checkLogoStatus();
      // Enable custom logo if not already enabled
      if (!settings.useCustomLogo) {
        handleSettingChange('useCustomLogo', true);
      }
    } catch (error) {
      toast.error((error as Error).message || "Failed to upload logo");
    }

    setIsUploadingLogo(false);
    // Reset input
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  };

  const handleDeleteLogo = async () => {
    try {
      await api.admin.deleteLogo();
      toast.success("Logo deleted successfully");
      setLogoExists(false);
      setLogoPreviewUrl("");
      // Disable custom logo setting
      handleSettingChange('useCustomLogo', false);
    } catch (error) {
      toast.error((error as Error).message || "Failed to delete logo");
    }
  };

  const handleAppIconUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      toast.error("Invalid file type. Only PNG, JPEG, WebP, and SVG are allowed.");
      return;
    }

    setIsUploadingIcon(true);
    try {
      // Resized in the browser into every icon size the app needs
      const { icons, lowResolution } = await renderAppIcons(file);
      const { version } = await api.admin.uploadAppIcon(icons);
      setAppIconVersion(version);
      toast.success("App icon updated");
      if (lowResolution) toast.warning("This image is smaller than 512×512, so the icon may look blurry");
    } catch (error) {
      toast.error((error as Error).message || "Failed to update the app icon");
    } finally {
      setIsUploadingIcon(false);
    }
  };

  const handleResetAppIcon = async () => {
    try {
      await api.admin.deleteAppIcon();
      setAppIconVersion(null);
      toast.success("Default app icon restored");
    } catch (error) {
      toast.error((error as Error).message || "Failed to restore the default icon");
    }
  };

  // Uploading or deleting a sound also switches it on the server; only that setting is taken over, so unsaved edits stay
  const handleCustomAudioChange = (slot: AudioSlot, custom: CustomAudioInfo | null, saved: AdminSettings) => {
    const key = AUDIO_SLOTS[slot].sourceSetting;
    setCustomAudio((prev) => ({ ...prev, [slot]: custom }));
    setSettings((prev) => ({ ...prev, [key]: saved[key] }));
    setCachedSettings(saved);
  };

  // Keeps the day valid when switching to a shorter month
  const handleCurrentYearFromChange = (month: number, day: number) => {
    handleSettingChange('currentYearFrom', formatMonthDay(month, Math.min(day, DAYS_IN_MONTH[month - 1])));
  };

  const saveMappings = async (mappings: AdminConfig["userMappings"]) => {
    setSavingMapping(true);
    try {
      setUserMappings(await api.admin.saveUserMappings(mappings));
      setMappingUsername("");
      setMappingUserId("");
      toast.success("User mappings saved. Viewers will sign in again to apply the changes.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSavingMapping(false);
    }
  };

  const handleTestTautulliConnection = async () => {
    if (!tautulliUrl || !tautulliApiKey) {
      toast.error("Please enter both URL and API key");
      return;
    }
    setIsTestingConnection(true);
    try {
      const result = await api.admin.testTautulli(tautulliUrl.trim(), tautulliApiKey.trim());
      toast.success(`Connected to ${result.serverName || "Tautulli"}! Building the stats cache in the background.`);
      await loadPanel();
    } catch (error) {
      const hint = error instanceof ApiError ? (error.data?.hint as string | undefined) : undefined;
      toast.error(`${(error as Error).message || "Failed to connect. Check your URL and API key."}${hint ? ` ${hint}` : ""}`, {
        duration: 8000
      });
    }
    setIsTestingConnection(false);
  };

  const runCacheAction = async (action: () => Promise<CacheStatus>, message: string) => {
    try {
      setCacheStatus(await action());
      toast.success(message);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleRevokeSessions = async () => {
    if (!window.confirm("Sign out every viewer? Plex sessions will have to sign in again.")) return;
    try {
      await api.admin.revokeSessions();
      toast.success("All viewer sessions were signed out");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  if (!isOpen) return null;

  const yearFrom = parseMonthDay(settings.currentYearFrom) ?? parseMonthDay(DEFAULT_ADMIN_SETTINGS.currentYearFrom)!;
  const exportUsers = users.map((u) => ({ user_id: u.user_id, username: u.username, friendly_name: u.friendly_name, thumb: u.thumb }));

  return <>
      <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <Shield className="w-5 h-5 text-primary" />
              Admin Panel
              {view === "panel" && <VersionBadge version={version} />}
            </DialogTitle>
            <DialogDescription>
              Configure admin settings, Tautulli connection, and user access
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {view === "loading" ? <motion.div key="loading" className="py-12 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </motion.div> : view === "login" ? <div className="space-y-4 py-4 text-center">
                <Shield className="w-12 h-12 text-primary mx-auto" />
                <p>Sign in with the admin Plex account to open this panel.</p>
                <Button onClick={onClose}>Back to Plex sign-in</Button>
              </div> : <motion.div key="settings" initial={{
            opacity: 0,
            y: 10
          }} animate={{
            opacity: 1,
            y: 0
          }} exit={{
            opacity: 0,
            y: -10
          }} className="space-y-6 py-4">
                <Tabs defaultValue="connection" className="w-full">
                  <TabsList className="grid w-full grid-cols-5">
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
                    <TabsTrigger value="cache" className="flex items-center gap-2">
                      <Database className="w-4 h-4" />
                      <span className="hidden sm:inline">Cache</span>
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
                          {connected && <span className="text-xs bg-green/20 text-green px-2 py-0.5 rounded-full">
                              Connected{plexServer ? ` · ${plexServer.name}` : ""}
                            </span>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Configure your Tautulli connection here.
                        </p>

                        <div className="space-y-2">
                          <Label htmlFor="tautulli-url" className="flex items-center gap-2">
                            <Server className="w-4 h-4 text-primary" />
                            Tautulli URL
                          </Label>
                          <Input id="tautulli-url" type="url" placeholder="http://localhost:8181" value={tautulliUrl} onChange={e => setTautulliUrl(e.target.value)} className="bg-background/50" />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="tautulli-api" className="flex items-center gap-2">
                            <Key className="w-4 h-4 text-primary" />
                            API Key
                          </Label>
                          <Input id="tautulli-api" type="password" placeholder="Your Tautulli API key" value={tautulliApiKey} onChange={e => setTautulliApiKey(e.target.value)} className="bg-background/50" />
                          <p className="text-xs text-muted-foreground">
                            Find this in Tautulli → Settings → Web Interface → API Key
                          </p>
                        </div>

                        <Button onClick={handleTestTautulliConnection} disabled={isTestingConnection} className="w-full">
                          {isTestingConnection ? <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Testing Connection...
                            </> : connected ? <>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Update Connection
                            </> : <>
                              <Server className="mr-2 h-4 w-4" />
                              Test & Save Connection
                            </>}
                        </Button>
                      </div>

                      <div className="text-xs text-muted-foreground/70 p-3 bg-muted/30 rounded-lg space-y-1">
                        <p className="font-medium text-muted-foreground">💡 Connection Tips:</p>
                        <p>• Use the internal IP or hostname accessible from this server</p>
                        <p>• For Docker, use the container name or host network IP</p>
                        <p>• HTTPS is recommended for external access</p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="settings" className="space-y-4 mt-4">
                    <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                      <Label className="text-base">Plex Authentication</Label>
                      <p className="text-sm text-muted-foreground">Admin account: {adminPlexUsername}. Viewers sign in with Plex and can only view their own report. Use the Users tab to map different Plex and Tautulli usernames.</p>
                    </div>

                    {/* Theme: each option is drawn in its own theme (data-theme) */}
                    <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                      <div className="space-y-0.5">
                        <Label className="text-base flex items-center gap-2">
                          <Palette className="w-4 h-4" />
                          Theme
                        </Label>
                        <p className="text-sm text-muted-foreground">Colours of the report and the exported images</p>
                      </div>
                      <RadioGroup
                        value={settings.theme}
                        onValueChange={value => handleSettingChange('theme', value as ThemeId)}
                        className="grid gap-2 sm:grid-cols-3"
                      >
                        {THEME_IDS.map(id => (
                          <label
                            key={id}
                            htmlFor={`theme-${id}`}
                            data-theme={id}
                            className={`flex flex-col gap-3 p-3 rounded-md border bg-background text-foreground cursor-pointer transition-colors ${
                              settings.theme === id ? "border-primary" : "border-border hover:border-muted-foreground/50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-display text-3xl font-extrabold tracking-tighter leading-none gradient-text">
                                {getDefaultYear(settings.currentYearFrom)}
                              </span>
                              <RadioGroupItem id={`theme-${id}`} value={id} />
                            </div>
                            <div aria-hidden className="flex h-1.5 overflow-hidden rounded-full">
                              <span className="flex-1 bg-cyan" />
                              <span className="flex-1 bg-purple" />
                              <span className="flex-1 bg-pink" />
                            </div>
                            <div className="space-y-0.5">
                              <span className="font-medium">{THEMES[id].label}</span>
                              <p className="text-xs text-muted-foreground">{THEMES[id].description}</p>
                            </div>
                          </label>
                        ))}
                      </RadioGroup>
                    </div>

                    {/* Custom Logo Setting */}
                    <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="custom-logo" className="text-base flex items-center gap-2">
                            <Image className="w-4 h-4" />
                            Custom Logo
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Display a custom logo on reports and exports
                          </p>
                        </div>
                        <Switch
                          id="custom-logo"
                          checked={settings.useCustomLogo}
                          onCheckedChange={checked => handleSettingChange('useCustomLogo', checked)}
                          disabled={!logoExists}
                        />
                      </div>

                      <div className="pt-2 space-y-3">
                        {/* Logo Preview */}
                        {logoExists && logoPreviewUrl && (
                          <div className="flex items-center justify-center p-4 bg-background/50 rounded-lg border border-border">
                            <img
                              src={logoPreviewUrl}
                              alt="Custom Logo Preview"
                              style={{ maxHeight: `${settings.logoMaxHeight}px`, maxWidth: '100%', objectFit: 'contain' }}
                            />
                          </div>
                        )}

                        {/* Upload/Delete Buttons */}
                        <div className="flex gap-2">
                          <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            onChange={handleLogoUpload}
                            className="hidden"
                            id="logo-upload"
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
                                {logoExists ? 'Replace Logo' : 'Upload Logo'}
                              </>
                            )}
                          </Button>
                          {logoExists && (
                            <Button
                              variant="outline"
                              onClick={handleDeleteLogo}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        {/* Logo Size Slider */}
                        {logoExists && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">Logo Max Height</Label>
                              <span className="text-sm text-muted-foreground">{settings.logoMaxHeight}px</span>
                            </div>
                            <Slider
                              value={[settings.logoMaxHeight]}
                              onValueChange={([value]) => handleSettingChange('logoMaxHeight', value, true)}
                              min={40}
                              max={200}
                              step={10}
                              className="w-full"
                            />
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground">
                          Supported formats: PNG, JPEG, WebP, SVG (max 5MB)
                        </p>
                      </div>
                    </div>

                    {/* Custom Title Setting */}
                    <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="custom-title" className="text-base">
                            Custom Title
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Use a custom title instead of "Plex Wrapped"
                          </p>
                        </div>
                        <Switch
                          id="custom-title"
                          checked={settings.useCustomTitle}
                          onCheckedChange={checked => handleSettingChange('useCustomTitle', checked)}
                        />
                      </div>
                      {settings.useCustomTitle && (
                        <div className="pt-2">
                          <Input
                            value={settings.customTitle}
                            onChange={e => handleSettingChange('customTitle', e.target.value, true)}
                            placeholder="Plex Wrapped"
                            className="bg-background/50"
                          />
                        </div>
                      )}
                    </div>

                    {/* Installable app (PWA) */}
                    <div className="p-4 rounded-lg bg-muted/50 space-y-4">
                      <div className="space-y-0.5">
                        <Label className="text-base flex items-center gap-2">
                          <MonitorSmartphone className="w-4 h-4" />
                          Installable App
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Visitors can install the site as an app on their phone or computer (requires HTTPS)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="app-name" className="text-sm">App Name</Label>
                        <Input
                          id="app-name"
                          value={settings.appName}
                          onChange={e => handleSettingChange('appName', e.target.value, true)}
                          placeholder={getDisplayTitle(settings)}
                          maxLength={60}
                          className="bg-background/50"
                        />
                        <p className="text-xs text-muted-foreground">
                          Shown under the home screen icon and on the app window. Leave empty to use the title.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="app-icon-upload" className="text-sm">App Icon</Label>
                        <div className="flex items-center gap-3">
                          <img
                            src={appIconVersion === null ? defaultAppIconUrl("apple-touch-icon") : customAppIconUrl("apple-touch-icon", appIconVersion)}
                            alt="App icon preview"
                            className="w-14 h-14 shrink-0 rounded-[22%] border border-border"
                          />
                          <input
                            ref={iconInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            onChange={handleAppIconUpload}
                            className="hidden"
                            id="app-icon-upload"
                          />
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => iconInputRef.current?.click()}
                            disabled={isUploadingIcon}
                          >
                            {isUploadingIcon ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4 mr-2" />
                                {appIconVersion === null ? 'Upload Icon' : 'Replace Icon'}
                              </>
                            )}
                          </Button>
                          {appIconVersion !== null && (
                            <Button
                              variant="outline"
                              onClick={handleResetAppIcon}
                              className="text-destructive hover:text-destructive"
                              aria-label="Restore the default icon"
                              title="Restore the default icon"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          A square image of at least 512×512 works best (PNG, JPEG, WebP, SVG). Installed apps update their
                          icon after a while; on iPhone and iPad, add the app to the home screen again.
                        </p>
                      </div>
                    </div>

                    {/* Background music */}
                    <div className="p-4 rounded-lg bg-muted/50 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <Label htmlFor="music-enabled" className="text-base flex items-center gap-2">
                            <Music className="w-4 h-4" />
                            Background Music
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Play a song while visitors browse their stats, with a speaker button to mute it
                          </p>
                        </div>
                        <Switch
                          id="music-enabled"
                          checked={settings.musicEnabled}
                          onCheckedChange={checked => handleSettingChange('musicEnabled', checked)}
                        />
                      </div>

                      <AudioSetting
                        slot="music"
                        source={settings.musicSource}
                        custom={customAudio.music}
                        onSourceChange={source => handleSettingChange('musicSource', source)}
                        onCustomChange={(custom, saved) => handleCustomAudioChange('music', custom, saved)}
                        onPreviewPlay={pauseBackgroundMusic}
                      />

                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <Label htmlFor="music-start-unmuted" className="text-sm">Start Unmuted</Label>
                          <p className="text-xs text-muted-foreground">
                            Browsers only allow sound after the visitor's first click or tap, so the music starts then.
                            Visitors who mute it stay muted.
                          </p>
                        </div>
                        <Switch
                          id="music-start-unmuted"
                          checked={settings.musicStartUnmuted}
                          onCheckedChange={checked => handleSettingChange('musicStartUnmuted', checked)}
                          disabled={!settings.musicEnabled}
                        />
                      </div>
                    </div>

                    {/* Unwrap sound */}
                    <div className="p-4 rounded-lg bg-muted/50 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <Label htmlFor="unwrap-enabled" className="text-base flex items-center gap-2">
                            <Gift className="w-4 h-4" />
                            Unwrap Sound
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Played when visitors tap to unwrap their top movie and show
                          </p>
                        </div>
                        <Switch
                          id="unwrap-enabled"
                          checked={settings.unwrapSoundEnabled}
                          onCheckedChange={checked => handleSettingChange('unwrapSoundEnabled', checked)}
                        />
                      </div>

                      <AudioSetting
                        slot="unwrap"
                        source={settings.unwrapSoundSource}
                        custom={customAudio.unwrap}
                        onSourceChange={source => handleSettingChange('unwrapSoundSource', source)}
                        onCustomChange={(custom, saved) => handleCustomAudioChange('unwrap', custom, saved)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div className="space-y-0.5">
                        <Label htmlFor="normalize-anomalies" className="text-base">Normalize Tautulli Anomalies</Label>
                        <p className="text-sm text-muted-foreground">
                          Fix duration anomalies by capping watch times to actual runtime
                        </p>
                      </div>
                      <Switch
                        id="normalize-anomalies"
                        checked={settings.normalizeTautulliAnomalies}
                        onCheckedChange={checked => handleSettingChange('normalizeTautulliAnomalies', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div className="space-y-0.5">
                        <Label htmlFor="enable-geolocation" className="text-base flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          Streaming Locations
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Show a globe of where streams originated from (requires IP geolocation)
                        </p>
                      </div>
                      <Switch
                        id="enable-geolocation"
                        checked={settings.enableGeolocation}
                        onCheckedChange={checked => handleSettingChange('enableGeolocation', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div className="space-y-0.5">
                        <Label htmlFor="show-leaderboard" className="text-base flex items-center gap-2">
                          <Trophy className="w-4 h-4" />
                          Show Leaderboard
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Display the user leaderboard in "All Users" reports
                        </p>
                      </div>
                      <Switch
                        id="show-leaderboard"
                        checked={settings.showLeaderboard}
                        onCheckedChange={checked => handleSettingChange('showLeaderboard', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div className="space-y-0.5">
                        <Label htmlFor="show-viewer-rank" className="text-base flex items-center gap-2">
                          <Medal className="w-4 h-4" />
                          Show Viewer Ranking
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Tell viewers in the top half how they rank, e.g. "more than 82% of viewers"
                        </p>
                      </div>
                      <Switch
                        id="show-viewer-rank"
                        checked={settings.showViewerRank}
                        onCheckedChange={checked => handleSettingChange('showViewerRank', checked)}
                      />
                    </div>

                    <div className="flex flex-col gap-3 p-4 rounded-lg bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="current-year-month" className="text-base flex items-center gap-2">
                          <CalendarDays className="w-4 h-4" />
                          Default Year
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Reports open on the previous year until this date, then on the current year
                          (right now: {getDefaultYear(settings.currentYearFrom)}). Visitors can still pick any year.
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Select value={String(yearFrom.month)} onValueChange={value => handleCurrentYearFromChange(Number(value), yearFrom.day)}>
                          <SelectTrigger id="current-year-month" aria-label="Month" className="w-36 bg-background/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MONTHS.map((name, i) => (
                              <SelectItem key={name} value={String(i + 1)}>{name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={String(yearFrom.day)} onValueChange={value => handleCurrentYearFromChange(yearFrom.month, Number(value))}>
                          <SelectTrigger aria-label="Day" className="w-20 bg-background/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: DAYS_IN_MONTH[yearFrom.month - 1] }, (_, i) => (
                              <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="users" className="space-y-4 mt-4">
                    <div className="p-4 rounded-lg bg-muted/50 space-y-4">
                      <h3 className="font-semibold">Plex to Tautulli User Mappings</h3>
                      <p className="text-sm text-muted-foreground">Matching usernames work automatically. Add an override when a Plex username differs from its Tautulli username.</p>
                      <div className="flex flex-wrap gap-2">
                        <Input aria-label="Plex username" placeholder="Plex username" value={mappingUsername} onChange={e => setMappingUsername(e.target.value)} className="flex-1" />
                        <Select value={mappingUserId} onValueChange={setMappingUserId}>
                          <SelectTrigger className="w-56"><SelectValue placeholder="Tautulli user" /></SelectTrigger>
                          <SelectContent>{users.map(user => <SelectItem key={user.user_id} value={String(user.user_id)}>{user.friendly_name || user.username} ({user.username})</SelectItem>)}</SelectContent>
                        </Select>
                        <Button disabled={savingMapping || !mappingUsername.trim() || !mappingUserId} onClick={() => saveMappings([
                          ...userMappings.filter(m => m.plexUsername.toLowerCase() !== mappingUsername.trim().toLowerCase()),
                          { plexUsername: mappingUsername.trim(), tautulliUserId: Number(mappingUserId) },
                        ])}>Save Mapping</Button>
                      </div>
                      <Table>
                        <TableHeader><TableRow><TableHead>Plex username</TableHead><TableHead>Tautulli user</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                        <TableBody>{userMappings.map(mapping => <TableRow key={mapping.plexUsername}>
                          <TableCell>{mapping.plexUsername}</TableCell>
                          <TableCell>{users.find(u => u.user_id === mapping.tautulliUserId)?.username || mapping.tautulliUserId}</TableCell>
                          <TableCell><Button variant="ghost" size="sm" disabled={savingMapping} onClick={() => saveMappings(userMappings.filter(m => m !== mapping))}>Remove</Button></TableCell>
                        </TableRow>)}</TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="cache" className="space-y-4 mt-4">
                    <div className="p-4 rounded-lg bg-muted/50 space-y-4">
                      <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold">Stats Cache</h3>
                        {cacheStatus && (cacheRunning ? <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              {cacheStatus.phase}
                              {cacheStatus.progress ? cacheStatus.progress.total > 0 ? ` ${cacheStatus.progress.done}/${cacheStatus.progress.total}` : ` (${cacheStatus.progress.done.toLocaleString()})` : ""}
                            </span> : <span className="text-xs bg-green/20 text-green px-2 py-0.5 rounded-full">Idle</span>)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Watch history, metadata and streaming locations are cached on the server so reports load instantly.
                        Only new sessions and titles are fetched: every night, and automatically during the day.
                        Once a week the full history is re-read to pick up anything deleted in Tautulli.
                      </p>

                      {cacheStatus && <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                          <span className="text-muted-foreground">History sessions</span>
                          <span>{cacheStatus.rows.toLocaleString()}</span>
                          <span className="text-muted-foreground">Users</span>
                          <span>{cacheStatus.users}</span>
                          <span className="text-muted-foreground">Cached metadata items</span>
                          <span>{cacheStatus.metadataEntries.toLocaleString()}</span>
                          <span className="text-muted-foreground">Cached IP locations</span>
                          <span>{cacheStatus.geolocationEntries.toLocaleString()}</span>
                          <span className="text-muted-foreground">Last full sync</span>
                          <span>{formatTime(cacheStatus.lastFullSync)}</span>
                          <span className="text-muted-foreground">Last update</span>
                          <span>{formatTime(cacheStatus.lastIncrementalSync)}</span>
                          <span className="text-muted-foreground">Next nightly sync</span>
                          <span>{formatTime(cacheStatus.nextRun)}</span>
                        </div>}

                      {cacheStatus?.lastError && <p className="text-sm text-destructive">Last sync failed: {cacheStatus.lastError}</p>}

                      <div className="flex items-center justify-between gap-4 pt-2">
                        <div className="space-y-0.5">
                          <Label htmlFor="nightly-sync" className="text-base">Nightly sync time</Label>
                          <p className="text-sm text-muted-foreground">Server time (set with the TZ environment variable)</p>
                        </div>
                        <Input
                          id="nightly-sync"
                          type="time"
                          value={settings.nightlySyncTime}
                          onChange={e => e.target.value && handleSettingChange('nightlySyncTime', e.target.value, true)}
                          className="w-32 bg-background/50"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" disabled={!connected || cacheRunning} onClick={() => runCacheAction(() => api.admin.cacheSync(false), "Sync started")}>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Sync now
                        </Button>
                        <Button variant="outline" disabled={!connected || cacheRunning} onClick={() => runCacheAction(() => api.admin.cacheSync(true), "Full rebuild started")}>
                          <Database className="w-4 h-4 mr-2" />
                          Full rebuild
                        </Button>
                        <Button variant="outline" disabled={cacheRunning} onClick={() => window.confirm("Clear all cached metadata (runtimes, genres, cast)? It will be fetched again from Tautulli.") && runCacheAction(() => api.admin.cacheClear("metadata"), "Metadata cache cleared")}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Clear metadata
                        </Button>
                        <Button variant="outline" disabled={cacheRunning} onClick={() => window.confirm("Clear all cached IP locations? They will be looked up again.") && runCacheAction(() => api.admin.cacheClear("geolocation"), "Location cache cleared")}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Clear locations
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div className="space-y-0.5">
                        <Label className="text-base">Viewer sessions</Label>
                        <p className="text-sm text-muted-foreground">Sign out everyone who signed in with Plex</p>
                      </div>
                      <Button variant="outline" onClick={handleRevokeSessions}>
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign out all
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="export" className="space-y-4 mt-4">
                    <div className="p-4 rounded-lg bg-muted/50 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Image className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold">Export as Images</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">Generate beautiful PNG images of Plex Wrapped reports for selected users.</p>

                      {!connected ? <div className="text-center py-4">
                          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Connect to Tautulli first to export images
                          </p>
                        </div> : users.length === 0 ? <div className="text-center py-4">
                          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            No users found
                          </p>
                        </div> : <Button onClick={() => setShowImageExport(true)} className="w-full">
                          <Image className="w-4 h-4 mr-2" />
                          Select Users & Export Images
                        </Button>}
                    </div>

                    <div className="text-xs text-muted-foreground/70 p-3 bg-muted/30 rounded-lg space-y-1">
                      <p className="font-medium text-muted-foreground">🖼️ Export Info:</p>
                      <p>• High-quality PNG images with all charts and visuals</p>
                      <p>• Single user exports as PNG, multiple users as ZIP</p>
                      <p>• Perfect for viewing on phones, tablets, or sharing</p>
                      {settings.useCustomLogo && logoExists && (
                        <p>• Your custom logo will appear on the first and last slides</p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                <DialogFooter className="gap-2">
                  <Button variant="ghost" onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </Button>
                  <Button variant="outline" onClick={onClose}>Close</Button>
                </DialogFooter>
              </motion.div>}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      {/* Image Export Dialog */}
      {connected && <ImageExportDialog isOpen={showImageExport} onClose={() => setShowImageExport(false)} users={exportUsers} oldestYear={cacheStatus?.oldestYear ?? undefined} />}
    </>;
};
