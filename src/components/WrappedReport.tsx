import { useEffect, useState, useCallback, useRef } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Settings, Loader2, ChevronDown, X, Shield, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserSelector } from "./UserSelector";
import { UsernameInput } from "./UsernameInput";
import {
  YearSelector,
  YearSelection,
  getDateRangeFromSelection,
  getDisplayYear,
  getDefaultYear,
  getYearsCount,
} from "./YearSelector";
import { TotalStats } from "./stats/TotalStats";
import { TopMedia } from "./stats/TopMedia";
import { TopLists } from "./stats/TopLists";
import { WatchHeatmap } from "./stats/WatchHeatmap";
import { MonthlyTrends } from "./stats/MonthlyTrends";
import { YearlyTrends } from "./stats/YearlyTrends";
import { FunFacts } from "./stats/FunFacts";
import { JourneyStats } from "./stats/JourneyStats";
import { PlatformStats } from "./stats/PlatformStats";
import { Leaderboard } from "./stats/Leaderboard";
import { ContentDecades } from "./stats/ContentDecades";
import { PopularWithGroup } from "./stats/PopularWithGroup";
import { MostRewatched } from "./stats/MostRewatched";
import { GenreStats } from "./stats/GenreStats";
import { ActorStats } from "./stats/ActorStats";
import { PeakConcurrent } from "./stats/PeakConcurrent";
import { AdminPanel } from "./AdminPanel";
import { ExportableStorySlides } from "./ExportableStorySlides";
import { TautulliConfig, TautulliUser, WrappedStats, UserStats, WatchHistory } from "@/types/tautulli";
import { getUsers, getHistory, calculateWrappedStats, fetchMetadataStats, getOldestHistoryYear } from "@/lib/tautulli";
import { AdminSettings } from "@/lib/adminStorage";
import { getServerAdminSettings } from "@/lib/serverConfig";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { createRoot } from "react-dom/client";

interface WrappedReportProps {
  config: TautulliConfig | null;
  onDisconnect?: () => void;
}

export const WrappedReport = ({ config, onDisconnect }: WrappedReportProps) => {
  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">
            Plex Wrapped is not configured yet
          </h2>
          <p className="text-muted-foreground">
            Please contact the server administrator.
          </p>
        </div>
      </div>
    );
  }

  const [users, setUsers] = useState<TautulliUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [yearSelection, setYearSelection] = useState<YearSelection>({
    type: "year",
    year: getDefaultYear(),
  });
  const [oldestYear, setOldestYear] = useState<number | undefined>(undefined);
  const [stats, setStats] = useState<WrappedStats | null>(null);
  const [allUserStats, setAllUserStats] = useState<UserStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminSettings, setAdminSettings] = useState<AdminSettings>(getServerAdminSettings());
  const [userAuthenticated, setUserAuthenticated] = useState(false);
  const [isExportingSlides, setIsExportingSlides] = useState(false);

  // Get the display title based on settings
  const getTitle = () => {
    if (adminSettings.useCustomTitle && adminSettings.customTitle) {
      return adminSettings.customTitle;
    }
    return "Plex Wrapped";
  };

  useEffect(() => {
    if (showControls) {
      const freshSettings = getServerAdminSettings();
      setAdminSettings(freshSettings);
    }
  }, [showControls]);

  useEffect(() => {
    const loadUsersAndOldestYear = async () => {
      const [fetchedUsers, oldest] = await Promise.all([getUsers(config), getOldestHistoryYear(config)]);
      setUsers(fetchedUsers);
      if (oldest) setOldestYear(oldest);
    };
    loadUsersAndOldestYear();
  }, [config]);

  const loadStats = useCallback(async () => {
    // Don't load stats if in discreet mode and no user selected
    if (adminSettings.discreetMode && selectedUserId === null) {
      return;
    }

    // Don't load stats if password protection is enabled and user not authenticated
    if (adminSettings.passwordProtectUsers && !userAuthenticated && selectedUserId !== null) {
      return;
    }

    setIsLoading(true);
    try {
      const { startDate, endDate } = getDateRangeFromSelection(yearSelection);
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");
      
      // Get normalization setting
      const normalizeAnomalies = adminSettings.normalizeTautulliAnomalies || false;
      
      if (selectedUserId !== null) {
        const history = await getHistory(config, selectedUserId, startStr, endStr, 5000, normalizeAnomalies);
        const calculatedStats = calculateWrappedStats(history);
        
        fetchMetadataStats(config, history).then((metaStats) => {
          setStats((prev) =>
            prev
              ? {
                  ...prev,
                  ...metaStats,
                }
              : prev,
          );
        });
        
        setStats(calculatedStats);
        setAllUserStats([]);
      } else {
        const allHistory = await getHistory(config, undefined, startStr, endStr, 5000, normalizeAnomalies);
        const overallStats = calculateWrappedStats(allHistory);
        
        fetchMetadataStats(config, allHistory).then((metaStats) => {
          setStats((prev) =>
            prev
              ? {
                  ...prev,
                  ...metaStats,
                }
              : prev,
          );
        });
        
        setStats(overallStats);
        
        const userHistories: Record<
          number,
          {
            history: WatchHistory[];
            friendlyName: string;
            username: string;
          }
        > = {};
        
        allHistory.forEach((h) => {
          if (!userHistories[h.user_id]) {
            userHistories[h.user_id] = {
              history: [],
              friendlyName: h.friendly_name || h.user || "Unknown",
              username: h.user || "unknown",
            };
          }
          userHistories[h.user_id].history.push(h);
        });
        
        const userStatsArray: UserStats[] = Object.entries(userHistories).map(([id, userData]) => {
          const userStats = calculateWrappedStats(userData.history);
          return {
            ...userStats,
            userId: parseInt(id),
            username: userData.username,
            friendlyName: userData.friendlyName,
          };
        });
        
        setAllUserStats(userStatsArray);
      }
    } catch (error) {
      toast.error("Failed to load watch history");
      console.error(error);
    }
    setIsLoading(false);
  }, [config, selectedUserId, yearSelection, adminSettings.discreetMode, adminSettings.passwordProtectUsers, adminSettings.normalizeTautulliAnomalies, userAuthenticated]);

  useEffect(() => {
    // Only auto-load stats if:
    // 1. Not in discreet mode, OR
    // 2. A user is selected (and authenticated if password protection is on)
    if (!adminSettings.discreetMode || (selectedUserId !== null && (!adminSettings.passwordProtectUsers || userAuthenticated))) {
      loadStats();
    }
  }, [loadStats, adminSettings.discreetMode, adminSettings.passwordProtectUsers, selectedUserId, userAuthenticated]);

  const handleUserSelect = (userId: number | null) => {
    setSelectedUserId(userId);
    setUserAuthenticated(userId !== null);
  };

  const scrollToContent = () => {
    window.scrollTo({
      top: window.innerHeight,
      behavior: "smooth",
    });
  };

  const handleExportSlides = async () => {
    const selectedUser = selectedUserId !== null ? users.find((u) => u.user_id === selectedUserId) : null;
    
    if (!stats || !selectedUser || selectedUserId === null) {
      toast.error("Please select a user first");
      return;
    }

    setIsExportingSlides(true);
    
    try {
      const displayYear = getDisplayYear(yearSelection);
      const userName = selectedUser.friendly_name || selectedUser.username;
      const safeFileName = userName.replace(/[^a-zA-Z0-9]/g, "_");
      const title = getTitle();

      // Create a temporary container
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-10000px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '540px';
      tempContainer.style.backgroundColor = '#0a0a0f';
      document.body.appendChild(tempContainer);

      const root = createRoot(tempContainer);
      
      await new Promise<void>((resolve) => {
        root.render(
          <ExportableStorySlides
            user={selectedUser}
            stats={stats}
            yearSelection={yearSelection}
            config={config!}
            onReady={() => {
              setTimeout(resolve, 500);
            }}
          />
        );
      });

      // Wait for images to load
      const images = tempContainer.querySelectorAll('img');
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

      await new Promise(resolve => setTimeout(resolve, 300));

      // Capture each slide
      const slides = tempContainer.querySelectorAll('.story-slide');
      const zip = new JSZip();

      for (let i = 0; i < slides.length; i++) {
        const slideElement = slides[i] as HTMLElement;
        
        const canvas = await html2canvas(slideElement, {
          backgroundColor: '#0a0a0f',
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          width: 540,
          height: 960,
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

        zip.file(`slide_${String(i + 1).padStart(2, '0')}.png`, blob);
      }

      // Cleanup
      root.unmount();
      document.body.removeChild(tempContainer);

      // Download
      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, `${safeFileName}_${title.replace(/\s/g, '_')}_${displayYear.replace(/\s/g, '_')}_Slides.zip`);

      toast.success("Slides exported successfully!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export slides. Please try again.");
    } finally {
      setIsExportingSlides(false);
    }
  };

  const selectedUser = selectedUserId !== null ? users.find((u) => u.user_id === selectedUserId) : null;
  const displayName = selectedUser?.friendly_name || selectedUser?.username || "Everyone";
  const displayYear = getDisplayYear(yearSelection);
  const isAllTime = yearSelection.type === "alltime";
  const yearsCount = getYearsCount(oldestYear);
  const title = getTitle();

  // Show welcome screen if in discreet mode and no user selected
  const showWelcomeScreen = adminSettings.discreetMode && selectedUserId === null && !stats;

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 bg-noise pointer-events-none z-0" />

      {/* Hero Section */}
      <section className="min-h-screen flex flex-col items-center justify-center relative px-4">
        <motion.div
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="text-center"
        >
          {showWelcomeScreen ? (
            <>
              <motion.h1
                initial={{
                  scale: 0.9,
                  opacity: 0,
                }}
                animate={{
                  scale: 1,
                  opacity: 1,
                }}
                transition={{
                  delay: 0.2,
                }}
                className="text-5xl md:text-7xl lg:text-8xl font-extrabold mb-4"
              >
                <span className="gradient-text glow-text">{title}</span>
              </motion.h1>
              <motion.p
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: 1,
                }}
                transition={{
                  delay: 0.4,
                }}
                className="text-xl text-muted-foreground mb-8"
              >
                Enter your username to view your stats
              </motion.p>
              <motion.div
                initial={{
                  opacity: 0,
                  y: 20,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: 0.6,
                }}
              >
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setShowControls(true)}
                  className="text-lg px-8"
                >
                  <Settings className="w-5 h-5 mr-2" />
                  Get Started
                </Button>
              </motion.div>
            </>
          ) : (
            <>
              <motion.div
                initial={{
                  opacity: 0,
                  scale: 0.8,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                }}
                transition={{
                  delay: 0.1,
                }}
                className="text-sm font-medium text-primary mb-4 tracking-wider uppercase"
              >
                {displayName}'s
              </motion.div>
              <motion.h1
                initial={{
                  scale: 0.9,
                  opacity: 0,
                }}
                animate={{
                  scale: 1,
                  opacity: 1,
                }}
                transition={{
                  delay: 0.2,
                }}
                className="text-5xl md:text-7xl lg:text-8xl font-extrabold mb-4"
              >
                <span className="gradient-text glow-text">{displayYear}</span>
              </motion.h1>
              <motion.h2
                initial={{
                  y: 20,
                  opacity: 0,
                }}
                animate={{
                  y: 0,
                  opacity: 1,
                }}
                transition={{
                  delay: 0.4,
                }}
                className="text-3xl md:text-5xl font-bold text-foreground mb-6"
              >
                {title}
              </motion.h2>
              <motion.p
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: 1,
                }}
                transition={{
                  delay: 0.6,
                }}
                className="text-xl text-muted-foreground"
              >
                Let's see what you've been watching
              </motion.p>
            </>
          )}
        </motion.div>

        {!showWelcomeScreen && (
          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            transition={{
              delay: 1,
            }}
            className="absolute bottom-12"
          >
            <Button
              variant="ghost"
              size="lg"
              onClick={scrollToContent}
              className="animate-bounce text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className="w-8 h-8" />
            </Button>
          </motion.div>
        )}

        <motion.div
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            delay: 0.8,
          }}
          className="absolute top-4 right-4 flex items-center gap-2"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowControls(!showControls)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </motion.div>

        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{
                opacity: 0,
                y: -10,
                scale: 0.95,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: -10,
                scale: 0.95,
              }}
              className="absolute top-16 right-4 stat-card p-4 space-y-4 z-50 min-w-[300px]"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-foreground">Settings</span>
                <Button variant="ghost" size="icon" onClick={() => setShowControls(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {adminSettings.discreetMode ? (
                <UsernameInput
                  users={users}
                  onSelectUser={handleUserSelect}
                  passwordProtectionEnabled={adminSettings.passwordProtectUsers}
                />
              ) : (
                <UserSelector users={users} selectedUserId={selectedUserId} onSelectUser={handleUserSelect} />
              )}
              <YearSelector selection={yearSelection} onSelectionChange={setYearSelection} oldestYear={oldestYear} />
              <div className="flex gap-2 pt-2">
                <Button onClick={loadStats} disabled={isLoading} size="sm" className="flex-1">
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button onClick={() => setShowAdminPanel(true)} variant="outline" size="sm">
                  <Shield className="w-4 h-4" />
                </Button>
                {onDisconnect && (
                  <Button onClick={onDisconnect} variant="outline" size="sm">
                    Disconnect
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Stats Sections */}
      {isLoading ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Unwrapping your year...</p>
          </div>
        </div>
      ) : stats && stats.totalWatchTime > 0 ? (
        <div className="max-w-4xl mx-auto px-4 pb-20 space-y-24">
          <section>
            <TotalStats
              totalWatchTime={stats.totalWatchTime}
              totalMovies={stats.totalMovies}
              totalShows={stats.totalShows}
              totalEpisodes={stats.totalEpisodes}
              isAllTime={isAllTime}
              yearsCount={yearsCount}
            />
          </section>
          {(stats.topMovie || stats.topShow) && (
            <section>
              <TopMedia topMovie={stats.topMovie} topShow={stats.topShow} config={config} />
            </section>
          )}
          {(stats.topMovies.length > 0 || stats.topShows.length > 0) && (
            <section>
              <TopLists topMovies={stats.topMovies} topShows={stats.topShows} />
            </section>
          )}
          {yearSelection.type === "alltime" && stats.watchByYear && stats.watchByYear.length > 1 ? (
            <section>
              <YearlyTrends watchByYear={stats.watchByYear} />
            </section>
          ) : (
            stats.watchByMonth.some((m) => m.hours > 0) && (
              <section>
                <MonthlyTrends watchByMonth={stats.watchByMonth} />
              </section>
            )
          )}
          {stats.watchByDay.some((d) => d.hours > 0) && (
            <section>
              <WatchHeatmap watchByDay={stats.watchByDay} watchByHour={stats.watchByHour} />
            </section>
          )}
          <section>
            <FunFacts
              lateNightSessions={stats.lateNightSessions}
              weekendPercentage={stats.weekendPercentage}
              mostActiveDay={stats.mostActiveDay}
              uniqueTitles={stats.uniqueTitles}
              avgDailyWatchTime={stats.avgDailyWatchTime}
              mostBingedDay={stats.mostBingedDay}
              earlyBirdSessions={stats.earlyBirdSessions}
              isGroup={selectedUserId === null}
              peakHour={stats.peakHour}
              morningWatchTime={stats.morningWatchTime}
              afternoonWatchTime={stats.afternoonWatchTime}
              eveningWatchTime={stats.eveningWatchTime}
              nightWatchTime={stats.nightWatchTime}
              totalSessions={stats.totalSessions}
              avgSessionLength={stats.avgSessionLength}
            />
          </section>
          <section>
            <JourneyStats
              firstWatch={stats.firstWatch}
              lastWatch={stats.lastWatch}
              longestStreak={stats.longestStreak}
              totalSessions={stats.totalSessions}
              isAllTime={isAllTime}
            />
          </section>
          {stats.platforms.length > 0 && (
            <section>
              <PlatformStats platforms={stats.platforms} />
            </section>
          )}
          {stats.contentDecades.length > 0 && (
            <section>
              <ContentDecades decades={stats.contentDecades} />
            </section>
          )}
          {stats.mostRewatched && (
            <section>
              <MostRewatched mostRewatched={stats.mostRewatched} />
            </section>
          )}
          {stats.topGenres.length > 0 && (
            <section>
              <GenreStats genres={stats.topGenres} />
            </section>
          )}
          {(stats.topActors.length > 0 || stats.topDirectors.length > 0) && (
            <section>
              <ActorStats actors={stats.topActors} directors={stats.topDirectors} />
            </section>
          )}
          {selectedUserId === null && (stats.topMoviesByUsers.length > 0 || stats.topShowsByUsers.length > 0) && (
            <section>
              <PopularWithGroup topMoviesByUsers={stats.topMoviesByUsers} topShowsByUsers={stats.topShowsByUsers} />
            </section>
          )}
          {selectedUserId === null && stats.peakConcurrentStreams && (
            <section>
              <PeakConcurrent peakConcurrentStreams={stats.peakConcurrentStreams} />
            </section>
          )}
          {allUserStats.length > 1 && (
            <section>
              <Leaderboard userStats={allUserStats} />
            </section>
          )}
          <motion.footer
            initial={{
              opacity: 0,
            }}
            whileInView={{
              opacity: 1,
            }}
            viewport={{
              once: true,
            }}
            className="text-center py-12 border-t border-border"
          >
            {selectedUserId !== null && stats && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mb-8"
              >
                <Button
                  onClick={handleExportSlides}
                  disabled={isExportingSlides}
                  size="lg"
                  className="bg-gradient-to-r from-cyan to-pink hover:opacity-90 transition-opacity text-lg px-8 py-6 h-auto"
                >
                  {isExportingSlides ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 mr-2" />
                      Export Slides
                    </>
                  )}
                </Button>
                <p className="text-sm text-muted-foreground mt-3">
                  Download your wrapped report as shareable story slides
                </p>
              </motion.div>
            )}
            <p className="text-sm text-muted-foreground/50">Powered by Tautulli</p>
          </motion.footer>
        </div>
      ) : !showWelcomeScreen ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center stat-card max-w-md mx-4">
            <p className="text-foreground text-lg font-semibold mb-2">No watch history found</p>
            <p className="text-muted-foreground mb-4">Try adjusting the date range or selecting a different user.</p>
            <Button onClick={() => setShowControls(true)} variant="outline">
              <Settings className="w-4 h-4 mr-2" />
              Open Settings
            </Button>
          </div>
        </div>
      ) : null}

      <AdminPanel
        isOpen={showAdminPanel}
        onClose={() => {
          // Reload settings when admin panel closes
          setAdminSettings(getServerAdminSettings());
          setShowAdminPanel(false);
        }}
        users={users}
        onSettingsChange={(settings) => {
          setAdminSettings(settings);
        }}
      />
    </div>
  );
};