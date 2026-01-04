// src/components/ImageExportDialog.tsx

import { useState, useRef, useEffect } from "react";
import { Image, Loader2, Check, Calendar, ImageIcon, LayoutGrid, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { TautulliConfig, TautulliUser, WrappedStats, StreamingLocation } from "@/types/tautulli";
import { getHistory, calculateWrappedStats, fetchMetadataStats, getOldestHistoryYear } from "@/lib/tautulli";
import { extractUniqueIPs, geolocateIPs } from "@/lib/geolocation";
import { YearSelector, YearSelection, getDateRangeFromSelection, getDisplayYear, getDefaultYear } from "./YearSelector";
import { getServerAdminSettings } from "@/lib/serverConfig";
import { format } from "date-fns";
import html2canvas from "html2canvas";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { ExportableWrappedReport } from "./ExportableWrappedReport";
import { ExportableStorySlides } from "./ExportableStorySlides";

interface ImageExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  users: TautulliUser[];
  config: TautulliConfig;
}

type ExportMode = 'single' | 'slides' | 'both';
type SelectionMode = 'individual' | 'combined';

export const ImageExportDialog = ({
  isOpen,
  onClose,
  users,
  config,
}: ImageExportDialogProps) => {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('individual');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentUser, setCurrentUser] = useState("");
  const [currentPhase, setCurrentPhase] = useState("");
  const [exportMode, setExportMode] = useState<ExportMode>('single');
  const [yearSelection, setYearSelection] = useState<YearSelection>({
    type: 'year',
    year: getDefaultYear()
  });
  const [oldestYear, setOldestYear] = useState<number | undefined>(undefined);
  const [renderData, setRenderData] = useState<{ user: TautulliUser; stats: WrappedStats; geoLocations: StreamingLocation[] } | null>(null);
  const [renderMode, setRenderMode] = useState<'full' | 'slides'>('full');
  const renderContainerRef = useRef<HTMLDivElement>(null);
  const slidesContainerRef = useRef<HTMLDivElement>(null);
  const isRenderReadyRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      getOldestHistoryYear(config).then(oldest => {
        if (oldest) setOldestYear(oldest);
      });
    }
  }, [isOpen, config]);

  // Reset selection when switching modes
  useEffect(() => {
    setSelectedUserIds(new Set());
  }, [selectionMode]);

  const toggleUser = (userId: number) => {
    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUserIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedUserIds.size === users.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(users.map(u => u.user_id)));
    }
  };

  const waitForRender = (mode: 'full' | 'slides'): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 200;
      const checkReady = () => {
        attempts++;
        const container = mode === 'full' ? renderContainerRef.current : slidesContainerRef.current;
        
        // Check if ready flag is set AND container exists AND has content
        if (isRenderReadyRef.current && container) {
          const hasContent = container.querySelector('.export-report') || container.querySelector('.story-slide');
          if (hasContent) {
            console.log(`[waitForRender] ${mode} ready after ${attempts} attempts`);
            resolve();
            return;
          }
        }
        
        if (attempts >= maxAttempts) {
          console.error(`[waitForRender] Timeout for ${mode}:`, {
            ready: isRenderReadyRef.current,
            container: !!container,
            children: container?.children.length,
            innerHTML: container?.innerHTML.substring(0, 200)
          });
          reject(new Error(`Render timeout for ${mode}`));
        } else {
          setTimeout(checkReady, 50);
        }
      };
      checkReady();
    });
  };

  const captureFullImage = async (element: HTMLElement): Promise<Blob> => {
    // Wait for any images to load
    const images = element.querySelectorAll('img');
    await Promise.all(
      Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          setTimeout(() => resolve(), 3000);
        });
      })
    );

    // Give extra time for rendering
    await new Promise(resolve => setTimeout(resolve, 300));

    const canvas = await html2canvas(element, {
      backgroundColor: '#0a0a0f',
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      width: element.scrollWidth,
      height: element.scrollHeight,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      x: 0,
      y: 0,
    });

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to create image"));
        },
        'image/png',
        1.0
      );
    });
  };

  const captureSlides = async (container: HTMLElement): Promise<Blob[]> => {
    const slides = container.querySelectorAll('.story-slide');
    console.log(`[captureSlides] Found ${slides.length} slides`);
    const blobs: Blob[] = [];

    for (let i = 0; i < slides.length; i++) {
      const slideElement = slides[i] as HTMLElement;
      
      // Wait for any images in this slide
      const images = slideElement.querySelectorAll('img');
      await Promise.all(
        Array.from(images).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            setTimeout(() => resolve(), 2000);
          });
        })
      );

      try {
        const canvas = await html2canvas(slideElement, {
          backgroundColor: '#0a0a0f',
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          width: 540,
          height: 960,
          x: 0,
          y: 0,
        });

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => {
              if (b) resolve(b);
              else reject(new Error(`Failed to create slide ${i + 1}`));
            },
            'image/png',
            1.0
          );
        });

        blobs.push(blob);
        console.log(`[captureSlides] Captured slide ${i + 1}/${slides.length}`);
      } catch (err) {
        console.error(`[captureSlides] Failed to capture slide ${i + 1}:`, err);
      }
    }

    return blobs;
  };

  // Helper to merge stats from multiple users
  const mergeStats = (statsArray: WrappedStats[]): WrappedStats => {
    if (statsArray.length === 0) {
      // Return empty stats
      return {
        totalWatchTime: 0,
        totalMovies: 0,
        totalShows: 0,
        totalEpisodes: 0,
        topMovies: [],
        topShows: [],
        topGenres: [],
        topActors: [],
        watchByMonth: [],
        watchByDay: [],
        watchByHour: [],
        platforms: [],
        uniqueTitles: 0,
        avgDailyWatchTime: 0,
        longestStreak: 0,
        weekendPercentage: 0,
        lateNightSessions: 0,
        earlyBirdSessions: 0,
      };
    }

    if (statsArray.length === 1) {
      return statsArray[0];
    }

    // Merge all stats
    const merged: WrappedStats = {
      totalWatchTime: 0,
      totalMovies: 0,
      totalShows: 0,
      totalEpisodes: 0,
      topMovies: [],
      topShows: [],
      topGenres: [],
      topActors: [],
      watchByMonth: [],
      watchByDay: [],
      watchByHour: [],
      platforms: [],
      uniqueTitles: 0,
      avgDailyWatchTime: 0,
      longestStreak: 0,
      weekendPercentage: 0,
      lateNightSessions: 0,
      earlyBirdSessions: 0,
      morningWatchTime: 0,
      afternoonWatchTime: 0,
      eveningWatchTime: 0,
      nightWatchTime: 0,
    };

    // Sum up simple numeric values
    statsArray.forEach(s => {
      merged.totalWatchTime += s.totalWatchTime || 0;
      merged.totalMovies += s.totalMovies || 0;
      merged.totalShows += s.totalShows || 0;
      merged.totalEpisodes += s.totalEpisodes || 0;
      merged.uniqueTitles += s.uniqueTitles || 0;
      merged.lateNightSessions += s.lateNightSessions || 0;
      merged.earlyBirdSessions += s.earlyBirdSessions || 0;
      merged.morningWatchTime = (merged.morningWatchTime || 0) + (s.morningWatchTime || 0);
      merged.afternoonWatchTime = (merged.afternoonWatchTime || 0) + (s.afternoonWatchTime || 0);
      merged.eveningWatchTime = (merged.eveningWatchTime || 0) + (s.eveningWatchTime || 0);
      merged.nightWatchTime = (merged.nightWatchTime || 0) + (s.nightWatchTime || 0);
    });

    // Average for avgDailyWatchTime
    merged.avgDailyWatchTime = statsArray.reduce((sum, s) => sum + (s.avgDailyWatchTime || 0), 0) / statsArray.length;

    // Max for longestStreak
    merged.longestStreak = Math.max(...statsArray.map(s => s.longestStreak || 0));

    // Average for weekendPercentage
    merged.weekendPercentage = statsArray.reduce((sum, s) => sum + (s.weekendPercentage || 0), 0) / statsArray.length;

    // Merge topMovies by title
    const movieMap = new Map<string, { title: string; watchCount: number; thumb?: string }>();
    statsArray.forEach(s => {
      s.topMovies?.forEach(m => {
        const existing = movieMap.get(m.title);
        if (existing) {
          existing.watchCount += m.watchCount;
        } else {
          movieMap.set(m.title, { ...m });
        }
      });
    });
    merged.topMovies = Array.from(movieMap.values())
      .sort((a, b) => b.watchCount - a.watchCount)
      .slice(0, 10);

    // Merge topShows by title
    const showMap = new Map<string, { title: string; episodeCount: number; thumb?: string }>();
    statsArray.forEach(s => {
      s.topShows?.forEach(sh => {
        const existing = showMap.get(sh.title);
        if (existing) {
          existing.episodeCount += sh.episodeCount;
        } else {
          showMap.set(sh.title, { ...sh });
        }
      });
    });
    merged.topShows = Array.from(showMap.values())
      .sort((a, b) => b.episodeCount - a.episodeCount)
      .slice(0, 10);

    // Set topMovie and topShow
    if (merged.topMovies.length > 0) {
      merged.topMovie = merged.topMovies[0];
    }
    if (merged.topShows.length > 0) {
      merged.topShow = merged.topShows[0];
    }

    // Merge topGenres
    const genreMap = new Map<string, { genre: string; count: number; watchTime: number }>();
    statsArray.forEach(s => {
      s.topGenres?.forEach(g => {
        const existing = genreMap.get(g.genre);
        if (existing) {
          existing.count += g.count;
          existing.watchTime += g.watchTime;
        } else {
          genreMap.set(g.genre, { ...g });
        }
      });
    });
    merged.topGenres = Array.from(genreMap.values())
      .sort((a, b) => b.watchTime - a.watchTime)
      .slice(0, 10);

    // Merge topActors
    const actorMap = new Map<string, { name: string; titleCount: number }>();
    statsArray.forEach(s => {
      s.topActors?.forEach(a => {
        const existing = actorMap.get(a.name);
        if (existing) {
          existing.titleCount += a.titleCount;
        } else {
          actorMap.set(a.name, { ...a });
        }
      });
    });
    merged.topActors = Array.from(actorMap.values())
      .sort((a, b) => b.titleCount - a.titleCount)
      .slice(0, 10);

    // Merge watchByMonth
    const monthMap = new Map<string, { month: string; hours: number }>();
    statsArray.forEach(s => {
      s.watchByMonth?.forEach(m => {
        const existing = monthMap.get(m.month);
        if (existing) {
          existing.hours += m.hours;
        } else {
          monthMap.set(m.month, { ...m });
        }
      });
    });
    // Sort by month order
    const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    merged.watchByMonth = monthOrder
      .map(m => monthMap.get(m) || { month: m, hours: 0 });

    // Merge watchByDay
    const dayMap = new Map<string, { day: string; hours: number }>();
    statsArray.forEach(s => {
      s.watchByDay?.forEach(d => {
        const existing = dayMap.get(d.day);
        if (existing) {
          existing.hours += d.hours;
        } else {
          dayMap.set(d.day, { ...d });
        }
      });
    });
    const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    merged.watchByDay = dayOrder
      .map(d => dayMap.get(d) || { day: d, hours: 0 });

    // Merge watchByHour
    const hourMap = new Map<number, { hour: number; minutes: number }>();
    statsArray.forEach(s => {
      s.watchByHour?.forEach(h => {
        const existing = hourMap.get(h.hour);
        if (existing) {
          existing.minutes += h.minutes;
        } else {
          hourMap.set(h.hour, { ...h });
        }
      });
    });
    merged.watchByHour = Array.from({ length: 24 }, (_, i) => 
      hourMap.get(i) || { hour: i, minutes: 0 }
    );

    // Merge platforms
    const platformMap = new Map<string, { name: string; count: number }>();
    statsArray.forEach(s => {
      s.platforms?.forEach(p => {
        const existing = platformMap.get(p.name);
        if (existing) {
          existing.count += p.count;
        } else {
          platformMap.set(p.name, { ...p });
        }
      });
    });
    merged.platforms = Array.from(platformMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Find mostBingedDay (max across all users)
    const allBingedDays = statsArray
      .filter(s => s.mostBingedDay)
      .map(s => s.mostBingedDay!);
    if (allBingedDays.length > 0) {
      merged.mostBingedDay = allBingedDays.reduce((max, d) => 
        d.duration > max.duration ? d : max
      );
    }

    // Find mostActiveDay (max hours)
    const allActiveDays = statsArray
      .filter(s => s.mostActiveDay)
      .map(s => s.mostActiveDay!);
    if (allActiveDays.length > 0) {
      merged.mostActiveDay = allActiveDays.reduce((max, d) => 
        d.hours > max.hours ? d : max
      );
    }

    return merged;
  };

  const handleExport = async () => {
    if (selectionMode === 'individual' && selectedUserIds.size === 0) {
      toast.error("Please select at least one user");
      return;
    }

    setIsExporting(true);
    setProgress(0);

    const zip = new JSZip();
    const { startDate, endDate } = getDateRangeFromSelection(yearSelection);
    const startStr = format(startDate, "yyyy-MM-dd");
    const endStr = format(endDate, "yyyy-MM-dd");
    const displayYear = getDisplayYear(yearSelection);

    // Get admin settings
    const adminSettings = getServerAdminSettings();
    const normalizeAnomalies = adminSettings.normalizeTautulliAnomalies || false;
    const enableGeolocation = adminSettings.enableGeolocation || false;

    try {
      if (selectionMode === 'combined') {
        // Export all users combined
        setCurrentUser("All Users Combined");
        setCurrentPhase("Fetching all users' watch history...");

        const allStats: WrappedStats[] = [];
        const allGeoLocations: StreamingLocation[] = [];

        for (let i = 0; i < users.length; i++) {
          const user = users[i];
          setCurrentPhase(`Fetching ${user.friendly_name || user.username} (${i + 1}/${users.length})...`);
          
          const history = await getHistory(config, user.user_id, startStr, endStr, 5000, normalizeAnomalies);
          let stats = calculateWrappedStats(history);
          try {
            const metaStats = await fetchMetadataStats(config, history);
            stats = { ...stats, ...metaStats };
          } catch (e) {
            console.warn("Failed to fetch metadata:", e);
          }
          allStats.push(stats);

          if (enableGeolocation) {
            try {
              const ipData = extractUniqueIPs(history);
              if (ipData.size > 0) {
                const geoLocs = await geolocateIPs(ipData);
                allGeoLocations.push(...geoLocs);
              }
            } catch (e) {
              console.warn("Failed to fetch geolocation:", e);
            }
          }

          setProgress(((i + 1) / users.length) * 50); // First 50% for data fetching
        }

        setCurrentPhase("Merging statistics...");
        const combinedStats = mergeStats(allStats);
        
        // Deduplicate geo locations by city+country
        const geoMap = new Map<string, StreamingLocation>();
        allGeoLocations.forEach(loc => {
          const key = `${loc.city}-${loc.country}`;
          const existing = geoMap.get(key);
          if (existing) {
            existing.sessionCount += loc.sessionCount;
            if (loc.sessionDates) {
              existing.sessionDates = [...(existing.sessionDates || []), ...loc.sessionDates];
            }
          } else {
            geoMap.set(key, { ...loc });
          }
        });
        const combinedGeoLocations = Array.from(geoMap.values());

        // Create a pseudo-user for "All Users Combined"
        const combinedUser: TautulliUser = {
          user_id: -999,
          username: "all_users",
          friendly_name: "All Users",
          email: "",
          is_active: 1,
          is_admin: 0,
          is_home_user: 0,
          is_allow_sync: 0,
          is_restricted: 0,
          thumb: "",
        };

        // Capture full image for combined
        if (exportMode === 'single' || exportMode === 'both') {
          setCurrentPhase("Rendering combined full report...");
          isRenderReadyRef.current = false;
          setRenderMode('full');
          setRenderData({ user: combinedUser, stats: combinedStats, geoLocations: combinedGeoLocations });
          
          await new Promise(resolve => setTimeout(resolve, 200));
          
          try {
            await waitForRender('full');
            await new Promise(resolve => setTimeout(resolve, 300));

            if (renderContainerRef.current) {
              setCurrentPhase("Capturing combined full image...");
              const reportElement = renderContainerRef.current.querySelector('.export-report') as HTMLElement;
              if (reportElement) {
                const imageBlob = await captureFullImage(reportElement);
                zip.file(`All_Users_Combined_Plex_Wrapped_${displayYear.replace(/\s/g, '_')}.png`, imageBlob);
              }
            }
          } catch (e) {
            console.error("Combined full image capture failed:", e);
            toast.error("Failed to capture combined full image");
          }
        }

        setProgress(75);

        // Capture slides for combined
        if (exportMode === 'slides' || exportMode === 'both') {
          setCurrentPhase("Rendering combined story slides...");
          isRenderReadyRef.current = false;
          setRenderMode('slides');
          setRenderData(null);
          await new Promise(resolve => setTimeout(resolve, 100));
          setRenderData({ user: combinedUser, stats: combinedStats, geoLocations: combinedGeoLocations });
          
          await new Promise(resolve => setTimeout(resolve, 200));
          
          try {
            await waitForRender('slides');
            await new Promise(resolve => setTimeout(resolve, 300));

            if (slidesContainerRef.current) {
              setCurrentPhase("Capturing combined story slides...");
              const slides = await captureSlides(slidesContainerRef.current);
              if (slides.length > 0) {
                const slidesFolder = zip.folder("All_Users_Combined_Slides");
                slides.forEach((blob, i) => {
                  slidesFolder?.file(`slide_${String(i + 1).padStart(2, '0')}.png`, blob);
                });
              }
            }
          } catch (e) {
            console.error("Combined slides capture failed:", e);
            toast.error("Failed to capture combined slides");
          }
        }

        setProgress(100);

      } else {
        // Export individual users
        const selectedUsers = users.filter(u => selectedUserIds.has(u.user_id));
        let completed = 0;

        for (const user of selectedUsers) {
          const userName = user.friendly_name || user.username;
          const safeFileName = userName.replace(/[^a-zA-Z0-9]/g, "_");
          setCurrentUser(userName);
          setCurrentPhase("Fetching watch history...");

          const history = await getHistory(config, user.user_id, startStr, endStr, 5000, normalizeAnomalies);
          let stats = calculateWrappedStats(history);
          
          setCurrentPhase("Loading metadata...");
          try {
            const metaStats = await fetchMetadataStats(config, history);
            stats = { ...stats, ...metaStats };
          } catch (e) {
            console.warn("Failed to fetch metadata:", e);
          }

          // Fetch geolocation data if enabled
          let geoLocations: StreamingLocation[] = [];
          if (enableGeolocation) {
            setCurrentPhase("Locating streaming sessions...");
            try {
              const ipData = extractUniqueIPs(history);
              if (ipData.size > 0) {
                geoLocations = await geolocateIPs(ipData);
                console.log(`[ImageExport] Found ${geoLocations.length} locations for ${userName}`);
              }
            } catch (e) {
              console.warn("Failed to fetch geolocation:", e);
            }
          }

          // Capture full image
          if (exportMode === 'single' || exportMode === 'both') {
            setCurrentPhase("Rendering full report...");
            isRenderReadyRef.current = false;
            setRenderMode('full');
            setRenderData({ user, stats, geoLocations });
            
            await new Promise(resolve => setTimeout(resolve, 200));
            
            try {
              await waitForRender('full');
              await new Promise(resolve => setTimeout(resolve, 300));

              if (renderContainerRef.current) {
                setCurrentPhase("Capturing full image...");
                const reportElement = renderContainerRef.current.querySelector('.export-report') as HTMLElement;
                if (reportElement) {
                  const imageBlob = await captureFullImage(reportElement);
                  zip.file(`${safeFileName}_Plex_Wrapped_${displayYear.replace(/\s/g, '_')}.png`, imageBlob);
                } else {
                  throw new Error("Report element not found");
                }
              }
            } catch (e) {
              console.error("Full image capture failed:", e);
              toast.error(`Failed to capture full image for ${userName}`);
            }
          }

          // Capture slides
          if (exportMode === 'slides' || exportMode === 'both') {
            setCurrentPhase("Rendering story slides...");
            isRenderReadyRef.current = false;
            setRenderMode('slides');
            setRenderData(null);
            await new Promise(resolve => setTimeout(resolve, 100));
            setRenderData({ user, stats, geoLocations });
            
            await new Promise(resolve => setTimeout(resolve, 200));
            
            try {
              await waitForRender('slides');
              await new Promise(resolve => setTimeout(resolve, 300));

              if (slidesContainerRef.current) {
                setCurrentPhase("Capturing story slides...");
                const slides = await captureSlides(slidesContainerRef.current);
                if (slides.length > 0) {
                  const slidesFolder = zip.folder(`${safeFileName}_Slides`);
                  slides.forEach((blob, i) => {
                    slidesFolder?.file(`slide_${String(i + 1).padStart(2, '0')}.png`, blob);
                  });
                } else {
                  throw new Error("No slides captured");
                }
              }
            } catch (e) {
              console.error("Slides capture failed:", e);
              toast.error(`Failed to capture slides for ${userName}`);
            }
          }

          completed++;
          setProgress((completed / selectedUsers.length) * 100);
        }
      }

      // Clear render data
      setRenderData(null);
      isRenderReadyRef.current = false;

      // Download
      const fileCount = Object.keys(zip.files).length;
      if (fileCount === 0) {
        toast.error("No images were captured");
        return;
      }

      const totalItems = selectionMode === 'combined' ? 1 : selectedUserIds.size;

      if (totalItems === 1 && exportMode === 'single') {
        const files = Object.keys(zip.files);
        if (files.length > 0) {
          const blob = await zip.files[files[0]].async('blob');
          saveAs(blob, files[0]);
        }
      } else {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, `Plex_Wrapped_${displayYear.replace(/\s/g, '_')}_Export.zip`);
      }

      toast.success(`Successfully exported ${totalItems} report(s)`);
      onClose();
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export images. Please try again.");
    } finally {
      setIsExporting(false);
      setProgress(0);
      setCurrentUser("");
      setCurrentPhase("");
      setRenderData(null);
      isRenderReadyRef.current = false;
    }
  };

  const handleRenderReady = () => {
    console.log(`[handleRenderReady] Called for mode: ${renderMode}`);
    isRenderReadyRef.current = true;
  };

  const handleClose = () => {
    if (!isExporting) {
      onClose();
    }
  };

  // Offscreen container styles - must NOT use visibility:hidden
  const offscreenStyle: React.CSSProperties = {
    position: 'absolute',
    left: '-10000px',
    top: '0px',
    opacity: 1, // Must be visible for html2canvas
    pointerEvents: 'none',
    zIndex: -9999,
  };

  const canExport = selectionMode === 'combined' || selectedUserIds.size > 0;
  const exportCount = selectionMode === 'combined' ? 1 : selectedUserIds.size;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Image className="w-5 h-5 text-primary" />
              Export as Images
            </DialogTitle>
            <DialogDescription>
              Generate PNG images of the Wrapped report.
            </DialogDescription>
          </DialogHeader>

          {isExporting ? (
            <div className="py-8 space-y-4">
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                <p className="text-sm font-medium text-foreground">{currentUser}</p>
                <p className="text-xs text-muted-foreground mt-1">{currentPhase}</p>
              </div>
              <Progress value={progress} className="w-full" />
              <p className="text-xs text-center text-muted-foreground">{Math.round(progress)}% complete</p>
            </div>
          ) : (
            <>
              {/* Export Mode */}
              <div className="py-3 border-b">
                <Label className="text-sm font-medium mb-3 block">Export Format</Label>
                <RadioGroup value={exportMode} onValueChange={(v) => setExportMode(v as ExportMode)} className="grid grid-cols-3 gap-2">
                  <div>
                    <RadioGroupItem value="single" id="single" className="peer sr-only" />
                    <Label
                      htmlFor="single"
                      className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer text-center"
                    >
                      <ImageIcon className="w-5 h-5 mb-1" />
                      <span className="text-xs">Full Image</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="slides" id="slides" className="peer sr-only" />
                    <Label
                      htmlFor="slides"
                      className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer text-center"
                    >
                      <LayoutGrid className="w-5 h-5 mb-1" />
                      <span className="text-xs">Story Slides</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="both" id="both" className="peer sr-only" />
                    <Label
                      htmlFor="both"
                      className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer text-center"
                    >
                      <Check className="w-5 h-5 mb-1" />
                      <span className="text-xs">Both</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Year Selector */}
              <div className="flex items-center gap-2 py-2 border-b">
                <Calendar className="w-4 h-4 text-primary" />
                <Label className="text-sm font-medium">Time Period</Label>
                <div className="ml-auto">
                  <YearSelector 
                    selection={yearSelection} 
                    onSelectionChange={setYearSelection}
                    oldestYear={oldestYear}
                  />
                </div>
              </div>

              {/* Selection Mode Toggle */}
              <div className="py-3 border-b">
                <Label className="text-sm font-medium mb-3 block">Export Type</Label>
                <RadioGroup value={selectionMode} onValueChange={(v) => setSelectionMode(v as SelectionMode)} className="grid grid-cols-2 gap-2">
                  <div>
                    <RadioGroupItem value="individual" id="individual" className="peer sr-only" />
                    <Label
                      htmlFor="individual"
                      className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer text-center"
                    >
                      <ImageIcon className="w-5 h-5 mb-1" />
                      <span className="text-xs">Individual Users</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="combined" id="combined" className="peer sr-only" />
                    <Label
                      htmlFor="combined"
                      className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer text-center"
                    >
                      <Users className="w-5 h-5 mb-1" />
                      <span className="text-xs">All Users Combined</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {selectionMode === 'individual' ? (
                <>
                  <div className="flex items-center justify-between py-2 border-b">
                    <Label className="text-sm font-medium">
                      Select Users ({selectedUserIds.size} of {users.length})
                    </Label>
                    <Button variant="ghost" size="sm" onClick={toggleAll}>
                      {selectedUserIds.size === users.length ? "Deselect All" : "Select All"}
                    </Button>
                  </div>

                  <ScrollArea className="h-[200px] pr-4">
                    <div className="space-y-2 py-2">
                      {users.map((user) => (
                        <div
                          key={user.user_id}
                          className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                          onClick={() => toggleUser(user.user_id)}
                        >
                          <Checkbox
                            id={`user-${user.user_id}`}
                            checked={selectedUserIds.has(user.user_id)}
                            onCheckedChange={() => toggleUser(user.user_id)}
                          />
                          <div className="flex-1">
                            <Label htmlFor={`user-${user.user_id}`} className="text-sm font-medium cursor-pointer">
                              {user.friendly_name || user.username}
                            </Label>
                            {user.friendly_name && user.friendly_name !== user.username && (
                              <p className="text-xs text-muted-foreground">@{user.username}</p>
                            )}
                          </div>
                          {selectedUserIds.has(user.user_id) && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="py-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">All Users Combined</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Aggregate statistics from all {users.length} users into a single report
                  </p>
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={handleExport} disabled={!canExport}>
                  <Image className="w-4 h-4 mr-2" />
                  Export {exportCount} Report{exportCount !== 1 ? 's' : ''}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden render containers - positioned offscreen but NOT hidden */}
      {renderData && renderMode === 'full' && (
        <div style={{ ...offscreenStyle, width: '800px' }}>
          <div ref={renderContainerRef} style={{ backgroundColor: '#0a0a0f' }}>
            <ExportableWrappedReport
              user={renderData.user}
              stats={renderData.stats}
              yearSelection={yearSelection}
              config={config}
              geoLocations={renderData.geoLocations}
              onReady={handleRenderReady}
            />
          </div>
        </div>
      )}
      
      {renderData && renderMode === 'slides' && (
        <div style={{ ...offscreenStyle, width: '540px' }}>
          <div ref={slidesContainerRef} style={{ backgroundColor: '#0a0a0f' }}>
            <ExportableStorySlides
              user={renderData.user}
              stats={renderData.stats}
              yearSelection={yearSelection}
              config={config}
              geoLocations={renderData.geoLocations}
              onReady={handleRenderReady}
            />
          </div>
        </div>
      )}
    </>
  );
};