import { useState, useEffect } from "react";
import { getServerAdminSettings, getLogoUrl, checkLogoExists } from "@/lib/serverConfig";

interface CustomLogoProps {
  className?: string;
  style?: React.CSSProperties;
  maxHeight?: number;
  fallback?: React.ReactNode;
}

export const CustomLogo = ({ className, style, maxHeight, fallback }: CustomLogoProps) => {
  const [logoExists, setLogoExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string>("");
  
  const adminSettings = getServerAdminSettings();
  const effectiveMaxHeight = maxHeight || adminSettings.logoMaxHeight || 80;

  useEffect(() => {
    const checkLogo = async () => {
      if (adminSettings.useCustomLogo) {
        const exists = await checkLogoExists();
        setLogoExists(exists);
        if (exists) {
          setLogoUrl(getLogoUrl());
        }
      }
      setLoading(false);
    };
    checkLogo();
  }, [adminSettings.useCustomLogo]);

  if (loading) {
    return null;
  }

  if (!adminSettings.useCustomLogo || !logoExists) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={logoUrl}
      alt="Custom Logo"
      className={className}
      style={{
        maxHeight: `${effectiveMaxHeight}px`,
        width: 'auto',
        objectFit: 'contain',
        ...style,
      }}
      crossOrigin="anonymous"
    />
  );
};

// For export components that need inline styles (html2canvas compatibility)
export const useCustomLogo = () => {
  const [logoExists, setLogoExists] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  
  const adminSettings = getServerAdminSettings();

  useEffect(() => {
    const checkLogo = async () => {
      if (adminSettings.useCustomLogo) {
        const exists = await checkLogoExists();
        setLogoExists(exists);
        if (exists) {
          setLogoUrl(getLogoUrl());
        }
      }
      setLoading(false);
    };
    checkLogo();
  }, [adminSettings.useCustomLogo]);

  return {
    useCustomLogo: adminSettings.useCustomLogo,
    logoExists,
    logoUrl,
    logoMaxHeight: adminSettings.logoMaxHeight || 80,
    loading,
  };
};