import { useEffect, useRef, useState } from "react";

const POSTER = "/hero/signal/connection-orb-poster.jpg";

/** The supplied rotating number sphere, with the original GIF's timing. */
export function ConnectionOrb() {
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
          // Retain the still when autoplay is unavailable.
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
      className="signal-connection-orb"
      aria-hidden="true"
      data-ready={!reducedMotion && !failed && started}
    >
      <img
        src={POSTER}
        width="600"
        height="600"
        alt=""
        loading="lazy"
        decoding="async"
      />
      {!reducedMotion && !failed && (
        <video
          ref={media}
          width="600"
          height="600"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster={POSTER}
          disablePictureInPicture
          tabIndex={-1}
          onPlaying={() => setStarted(true)}
          onError={() => setFailed(true)}
        >
          <source
            src="/hero/signal/connection-orb.mp4"
            type="video/mp4"
            onError={(event) => event.stopPropagation()}
          />
          <source
            src="/hero/signal/connection-orb.webm"
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
