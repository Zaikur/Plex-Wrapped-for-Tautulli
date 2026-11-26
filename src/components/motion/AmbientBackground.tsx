/**
 * Soft colour fields drifting behind the whole page, with a vignette and film grain on top.
 * Fixed behind all content, and never part of an exported image.
 */
export const AmbientBackground = () => (
  <div aria-hidden data-html2canvas-ignore className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
    <div className="ambient-blob ambient-blob-1" />
    <div className="ambient-blob ambient-blob-2" />
    <div className="ambient-blob ambient-blob-3" />
    <div className="absolute inset-0 ambient-vignette" />
    <div className="absolute inset-0 bg-noise" />
  </div>
);
