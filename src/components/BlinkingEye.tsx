import { useEffect, useRef, useState } from "react";

const POSTER = "/hero/signal/eye-blink-poster.png";

/** A locally encoded loop of the user's four poses, with an accessible still fallback. */
export function BlinkingEye() {
  const media = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
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
          // Autoplay may be disabled by the browser; the matching still stays visible.
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
      className="signal-eye-animation"
      aria-hidden="true"
      data-ready={!reducedMotion && !failed && started}
    >
      <img
        className="signal-eye-poster"
        src={POSTER}
        width="1024"
        height="1024"
        alt=""
        fetchPriority="high"
      />
      {!reducedMotion && !failed && (
        <video
          ref={media}
          className="signal-eye-video"
          width="1024"
          height="1024"
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
            src="/hero/signal/eye-blink.webm"
            type="video/webm"
            onError={(event) => event.stopPropagation()}
          />
          <source
            src="/hero/signal/eye-blink.mp4"
            type="video/mp4"
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
