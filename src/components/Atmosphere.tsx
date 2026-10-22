import { useEffect, useRef, useState } from "react";

const POSTER = "/hero/signal/background-poster.jpg";

/** The supplied particle-wave GIF, encoded as a pausable native video loop. */
export function Atmosphere() {
  const media = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(preference.matches);
      setStarted(false);
    };
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const video = media.current;
    if (!video || reducedMotion || failed) return;
    let visible = true;
    const sync = () => {
      if (document.hidden || !visible) video.pause();
      else
        void video.play().catch(() => {
          // Keep the matching still when browser preferences block autoplay.
        });
    };
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      sync();
    });
    video.muted = true;
    observer.observe(video);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      video.pause();
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [reducedMotion, failed]);

  return (
    <div
      className="signal-atmosphere"
      aria-hidden="true"
      data-renderer={!reducedMotion && !failed && started ? "video" : "still"}
    >
      <img src={POSTER} width="600" height="600" alt="" decoding="async" />
      {!reducedMotion && !failed && (
        <video
          ref={media}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster={POSTER}
          disablePictureInPicture
          tabIndex={-1}
          onPlaying={() => setStarted(true)}
          onError={() => setFailed(true)}
        >
          <source
            src="/hero/signal/background.mp4"
            type="video/mp4"
            onError={(event) => event.stopPropagation()}
          />
          <source
            src="/hero/signal/background.webm"
            type="video/webm"
            onError={(event) => {
              event.stopPropagation();
              setFailed(true);
            }}
          />
        </video>
      )}
    </div>
  );
}
