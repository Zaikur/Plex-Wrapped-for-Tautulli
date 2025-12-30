import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Eye, EyeOff, Lock, RefreshCw, Copy, Check, X, Users, Settings2, AlertCircle, Edit2, Server, Key, Loader2, Image, Type, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Slider } from "@/components/ui/slider";
import { TautulliConfig, TautulliUser } from "@/types/tautulli";
import { testConnection } from "@/lib/tautulli";
import { AdminSettings, UserPassword } from "@/lib/adminStorage";
import { ImageExportDialog } from "./ImageExportDialog";
import { isServerAdminPasswordSet, setServerAdminPassword, verifyServerAdminPassword, getServerAdminSettings, saveServerAdminSettings, getServerUserPasswords, generatePassword, setServerUserPassword, generatePasswordsForAllServerUsers, getTautulliConfig, setTautulliConfig, uploadLogo, deleteLogo, checkLogoExists, getLogoUrl } from "@/lib/serverConfig";
import { toast } from "sonner";

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  users: TautulliUser[];
  onSettingsChange: (settings: AdminSettings) => void;
  onTautulliConnect?: (config: TautulliConfig) => void;
}

export const AdminPanel = ({
  isOpen,
  onClose,
  users,
  onSettingsChange,
  onTautulliConnect
}: AdminPanelProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [settings, setSettings] = useState<AdminSettings>(getServerAdminSettings());
  const [userPasswords, setUserPasswords] = useState<UserPassword[]>([]);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [copiedUserId, setCopiedUserId] = useState<number | null>(null);

  // Tautulli connection state
  const [tautulliUrl, setTautulliUrl] = useState("");
  const [tautulliApiKey, setTautulliApiKey] = useState("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [currentTautulliConfig, setCurrentTautulliConfig] = useState<TautulliConfig | undefined>(getTautulliConfig());

  // Image Export state
  const [showImageExport, setShowImageExport] = useState(false);

  // Logo state
  const [logoExists, setLogoExists] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string>("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const needsSetup = !isServerAdminPasswordSet();
      setIsSettingPassword(needsSetup);
      setIsAuthenticated(false);
      setPassword("");
      setConfirmPassword("");
      loadUserPasswords();
      const tautulliConfig = getTautulliConfig();
      setCurrentTautulliConfig(tautulliConfig);
      if (tautulliConfig) {
        setTautulliUrl(tautulliConfig.url);
        setTautulliApiKey(tautulliConfig.apiKey);
      }
      // Reload settings
      setSettings(getServerAdminSettings());
      // Check logo
      checkLogoStatus();
    }
  }, [isOpen]);

  const checkLogoStatus = async () => {
    const exists = await checkLogoExists();
    setLogoExists(exists);
    if (exists) {
      setLogoPreviewUrl(getLogoUrl());
    } else {
      setLogoPreviewUrl("");
    }
  };

  const loadUserPasswords = () => {
    setUserPasswords(getServerUserPasswords());
  };

  const handleSetPassword = () => {
    if (password.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setServerAdminPassword(password);
    setIsAuthenticated(true);
    setIsSettingPassword(false);
    toast.success("Admin password set successfully");
  };

  const handleLogin = () => {
    if (verifyServerAdminPassword(password)) {
      setIsAuthenticated(true);
      setPassword("");
    } else {
      toast.error("Incorrect password");
    }
  };

  const handleSettingChange = (key: keyof AdminSettings, value: boolean | string | number) => {
    const newSettings = {
      ...settings,
      [key]: value
    };
    setSettings(newSettings);
    saveServerAdminSettings(newSettings);
    onSettingsChange(newSettings);

    // When enabling password protection, generate passwords for all users
    if (key === 'passwordProtectUsers' && value === true) {
      const usersToGenerate = users.map(u => ({
        userId: u.user_id,
        username: u.username,
        friendlyName: u.friendly_name
      }));
      generatePasswordsForAllServerUsers(usersToGenerate);
      loadUserPasswords();
      toast.success("Passwords generated for all users");
    }
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
    const result = await uploadLogo(file);
    
    if (result.success) {
      toast.success("Logo uploaded successfully");
      await checkLogoStatus();
      // Enable custom logo if not already enabled
      if (!settings.useCustomLogo) {
        handleSettingChange('useCustomLogo', true);
      }
    } else {
      toast.error(result.error || "Failed to upload logo");
    }
    
    setIsUploadingLogo(false);
    // Reset input
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
      // Disable custom logo setting
      handleSettingChange('useCustomLogo', false);
    } else {
      toast.error(result.error || "Failed to delete logo");
    }
  };

  const handleRegeneratePassword = (userId: number) => {
    const user = users.find(u => u.user_id === userId);
    if (!user) return;
    const userPwd = userPasswords.find(p => p.userId === userId);
    const newPass = generatePassword();
    setServerUserPassword(userId, user.username, user.friendly_name, newPass, userPwd?.email);
    loadUserPasswords();
    toast.success("Password regenerated");
  };

  const handleSavePassword = (userId: number) => {
    if (newPassword.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    const user = users.find(u => u.user_id === userId);
    if (!user) return;
    const userPwd = userPasswords.find(p => p.userId === userId);
    setServerUserPassword(userId, user.username, user.friendly_name, newPassword, userPwd?.email);
    loadUserPasswords();
    setEditingUserId(null);
    setNewPassword("");
    toast.success("Password updated");
  };

  const handleCopyPassword = async (userId: number, password: string) => {
    await navigator.clipboard.writeText(password);
    setCopiedUserId(userId);
    setTimeout(() => setCopiedUserId(null), 2000);
  };

  const handleTestTautulliConnection = async () => {
    if (!tautulliUrl || !tautulliApiKey) {
      toast.error("Please enter both URL and API key");
      return;
    }
    setIsTestingConnection(true);
    const config = {
      url: tautulliUrl.trim(),
      apiKey: tautulliApiKey.trim()
    };
    const result = await testConnection(config);
    if (result.success) {
      setTautulliConfig(config);
      setCurrentTautulliConfig(config);
      toast.success("Connected to Tautulli! Configuration saved.");
      if (onTautulliConnect) {
        onTautulliConnect(config);
      }
    } else {
      toast.error(result.error || "Failed to connect. Check your URL and API key.", {
        duration: 8000
      });
    }
    setIsTestingConnection(false);
  };

  if (!isOpen) return null;

  return <>
      <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Admin Panel
            </DialogTitle>
            <DialogDescription>
              Configure admin settings, Tautulli connection, and user access
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {isSettingPassword ? <motion.div key="setup" initial={{
            opacity: 0,
            y: 10
          }} animate={{
            opacity: 1,
            y: 0
          }} exit={{
            opacity: 0,
            y: -10
          }} className="space-y-4 py-4">
                <div className="text-center mb-6">
                  <Lock className="w-12 h-12 text-primary mx-auto mb-2" />
                  <h3 className="text-lg font-semibold">Set Admin Password</h3>
                  <p className="text-sm text-muted-foreground">
                    Create a password to protect the admin panel
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="new-password">Password</Label>
                  <div className="relative">
                    <Input id="new-password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input id="confirm-password" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm password" onKeyDown={e => e.key === 'Enter' && handleSetPassword()} />
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={onClose}>Cancel</Button>
                  <Button onClick={handleSetPassword}>Set Password</Button>
                </DialogFooter>
              </motion.div> : !isAuthenticated ? <motion.div key="login" initial={{
            opacity: 0,
            y: 10
          }} animate={{
            opacity: 1,
            y: 0
          }} exit={{
            opacity: 0,
            y: -10
          }} className="space-y-4 py-4">
                <div className="text-center mb-6">
                  <Lock className="w-12 h-12 text-primary mx-auto mb-2" />
                  <h3 className="text-lg font-semibold">Enter Admin Password</h3>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Input id="login-password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={onClose}>Cancel</Button>
                  <Button onClick={handleLogin}>Login</Button>
                </DialogFooter>
              </motion.div> : <motion.div key="settings" initial={{
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
                          {currentTautulliConfig && <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full">
                              Connected
                            </span>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Configure your Tautulli connection here. This will be used for all users accessing the app.
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
                            </> : currentTautulliConfig ? <>
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
                              onValueChange={([value]) => handleSettingChange('logoMaxHeight', value)}
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
                            onChange={e => handleSettingChange('customTitle', e.target.value)}
                            placeholder="Plex Wrapped"
                            className="bg-background/50"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div className="space-y-0.5">
                        <Label htmlFor="discreet-mode" className="text-base">Discreet Mode</Label>
                        <p className="text-sm text-muted-foreground">
                          Replace user dropdown with a username input field
                        </p>
                      </div>
                      <Switch id="discreet-mode" checked={settings.discreetMode} onCheckedChange={checked => handleSettingChange('discreetMode', checked)} />
                    </div>
                  
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div className="space-y-0.5">
                        <Label htmlFor="password-protect" className="text-base">Password Protect Users</Label>
                        <p className="text-sm text-muted-foreground">
                          Require password to view individual user stats
                        </p>
                      </div>
                      <Switch id="password-protect" checked={settings.passwordProtectUsers} onCheckedChange={checked => handleSettingChange('passwordProtectUsers', checked)} />
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
                  </TabsContent>

                  <TabsContent value="users" className="space-y-4 mt-4">
                    {!settings.passwordProtectUsers ? <div className="text-center py-8 text-muted-foreground">
                        <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Enable "Password Protect Users" in Settings to manage user passwords</p>
                      </div> : users.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                        <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No users found. Connect to Tautulli first to see users.</p>
                      </div> : <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>User</TableHead>
                              <TableHead>Username</TableHead>
                              <TableHead>Password</TableHead>
                              <TableHead className="w-[100px]">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {users.map(user => {
                        const userPwd = userPasswords.find(p => p.userId === user.user_id);
                        const isEditingPwd = editingUserId === user.user_id;
                        return <TableRow key={user.user_id}>
                                  <TableCell className="font-medium">
                                    {user.friendly_name || user.username}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {user.username}
                                  </TableCell>
                                  <TableCell>
                                    {isEditingPwd ? <div className="flex items-center gap-2">
                                        <Input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" className="h-8 w-28" />
                                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleSavePassword(user.user_id)}>
                                          <Check className="w-4 h-4 text-green-500" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
                                setEditingUserId(null);
                                setNewPassword("");
                              }}>
                                          <X className="w-4 h-4 text-destructive" />
                                        </Button>
                                      </div> : <div className="flex items-center gap-2">
                                        <code className="bg-muted px-2 py-1 rounded text-sm">
                                          {userPwd?.password || 'Not set'}
                                        </code>
                                        {userPwd && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleCopyPassword(user.user_id, userPwd.password)}>
                                            {copiedUserId === user.user_id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                          </Button>}
                                      </div>}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
                                setEditingUserId(user.user_id);
                                setNewPassword(userPwd?.password || "");
                              }} title="Edit password">
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleRegeneratePassword(user.user_id)} title="Generate new password">
                                        <RefreshCw className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>;
                      })}
                          </TableBody>
                        </Table>
                      </div>}
                  </TabsContent>

                  <TabsContent value="export" className="space-y-4 mt-4">
                    <div className="p-4 rounded-lg bg-muted/50 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Image className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold">Export as Images</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">Generate beautiful PNG images of Plex Wrapped reports for selected users.</p>
                      
                      {!currentTautulliConfig ? <div className="text-center py-4">
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

                <DialogFooter>
                  <Button variant="outline" onClick={onClose}>Close</Button>
                </DialogFooter>
              </motion.div>}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      {/* Image Export Dialog */}
      {currentTautulliConfig && <ImageExportDialog isOpen={showImageExport} onClose={() => setShowImageExport(false)} users={users} config={currentTautulliConfig} />}
    </>;
};