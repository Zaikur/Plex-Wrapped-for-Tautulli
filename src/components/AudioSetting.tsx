import { useRef, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { AdminSettings, AudioSource } from "@/lib/adminStorage";
import { AUDIO_ACCEPT, AUDIO_FORMATS, AUDIO_SLOTS, MAX_AUDIO_SIZE, audioUrl, type AudioSlot } from "@/lib/audio";
import { api, ApiError } from "@/lib/api";
import type { CustomAudioInfo } from "@/types/api";
import { toast } from "sonner";

const MAX_AUDIO_MB = MAX_AUDIO_SIZE / (1024 * 1024);

interface AudioSettingProps {
  slot: AudioSlot;
  /** The selected source setting */
  source: AudioSource;
  /** The uploaded file, kept while the default is selected */
  custom: CustomAudioInfo | null;
  onSourceChange: (source: AudioSource) => void;
  /** After an upload or delete, which also switch the source on the server */
  onCustomChange: (custom: CustomAudioInfo | null, settings: AdminSettings) => void;
  onPreviewPlay?: () => void;
}

/** Admin panel controls for a replaceable sound: default or uploaded file, upload/delete, and a player to listen */
export const AudioSetting = ({ slot, source, custom, onSourceChange, onCustomChange, onPreviewPlay }: AudioSettingProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { noun, defaultName } = AUDIO_SLOTS[slot];
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
  const selected: AudioSource = source === "custom" && custom ? "custom" : "default";
  const previewUrl = audioUrl(slot, selected === "custom" && custom ? custom.version : null);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_AUDIO_SIZE) {
      toast.error(`File size must be less than ${MAX_AUDIO_MB}MB`);
      return;
    }

    setIsUploading(true);
    try {
      const result = await api.admin.uploadAudio(slot, file);
      onCustomChange(result.customAudio, result.settings);
      toast.success(`${Noun} uploaded`);
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.status === 413
          ? "The file is too large for your reverse proxy. Raise its upload size limit (e.g. client_max_body_size in nginx)."
          : (error as Error).message || `Failed to upload the ${noun}`
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${custom?.fileName}"? The default ${noun} will be used again.`)) return;
    try {
      const { settings } = await api.admin.deleteAudio(slot);
      onCustomChange(null, settings);
      toast.success(`Custom ${noun} deleted`);
    } catch (error) {
      toast.error((error as Error).message || `Failed to delete the ${noun}`);
    }
  };

  return (
    <>
      <RadioGroup
        value={selected}
        onValueChange={value => onSourceChange(value as AudioSource)}
        aria-label={Noun}
        className="space-y-2"
      >
        <label
          htmlFor={`${slot}-default`}
          className="flex items-center gap-3 p-3 rounded-md border border-border bg-background/40 cursor-pointer"
        >
          <RadioGroupItem id={`${slot}-default`} value="default" />
          <div className="min-w-0">
            <span className="font-medium">Default</span>
            <p className="text-sm text-muted-foreground truncate">{defaultName}</p>
          </div>
        </label>
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-md border border-border bg-background/40">
          <label
            htmlFor={`${slot}-custom`}
            className={`flex items-center gap-3 flex-1 min-w-[10rem] ${custom ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
          >
            <RadioGroupItem id={`${slot}-custom`} value="custom" disabled={!custom} />
            <div className="min-w-0">
              <span className="font-medium">Custom {Noun}</span>
              <p className="text-sm text-muted-foreground truncate" title={custom?.fileName}>
                {custom ? custom.fileName : `Upload a ${noun} to use it`}
              </p>
            </div>
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={AUDIO_ACCEPT}
              onChange={handleUpload}
              className="hidden"
              id={`${slot}-upload`}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  {custom ? 'Replace' : `Upload ${Noun}`}
                </>
              )}
            </Button>
            {custom && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                className="text-destructive hover:text-destructive"
                aria-label={`Delete the custom ${noun}`}
                title={`Delete the custom ${noun}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </RadioGroup>

      <p className="text-xs text-muted-foreground">
        Supported formats: {AUDIO_FORMATS} (max {MAX_AUDIO_MB}MB). MP3 plays in every browser.
      </p>

      <div className="space-y-2">
        <Label htmlFor={`${slot}-preview`} className="text-sm">Listen</Label>
        <audio
          key={previewUrl}
          id={`${slot}-preview`}
          controls
          preload="none"
          src={previewUrl}
          onPlay={onPreviewPlay}
          className="w-full h-10 [color-scheme:dark]"
        />
      </div>
    </>
  );
};
