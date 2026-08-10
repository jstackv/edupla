import { useId } from 'react';

/*
 * Animated Edupla brand mark.
 *
 * Browser tab favicons are rasterized once and can't actually animate in
 * any real browser — so this lives as a real component instead, for use
 * anywhere the motion will actually be visible: the nav header, splash /
 * loading screens, empty states, the sign-in page, etc.
 *
 * Same visual design as public/favicon-v2.svg (gradient badge, embossed
 * "E" monogram, gold sparkle) with three subtle looping animations layered
 * on top:
 *   - a slow "breathing" glass highlight
 *   - a soft diagonal streak that sweeps across every few seconds
 *   - a twinkling gold sparkle accent
 * plus a spring-y scale/tilt on hover. All animation is disabled when the
 * viewer has `prefers-reduced-motion` set, and gradient/filter ids are
 * unique per instance (via useId) so multiple copies can safely render on
 * the same page (e.g. header + mobile menu) without colliding.
 *
 * Props:
 *   size      - rendered width/height in px (default 38, matches the old
 *               header badge)
 *   animated  - set false for a fully static render (e.g. inside a PDF/
 *               print view, or anywhere motion isn't wanted)
 *   className - extra class names passed through to the wrapper
 */
export default function BrandMark({ size = 38, animated = true, className = '' }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const ids = {
    bg: `em-bg-${uid}`,
    glow: `em-glow-${uid}`,
    vignette: `em-vig-${uid}`,
    streak: `em-streak-${uid}`,
    glyph: `em-glyph-${uid}`,
    rim: `em-rim-${uid}`,
    gold: `em-gold-${uid}`,
    clip: `em-clip-${uid}`,
    glyphShadow: `em-gshadow-${uid}`,
    lift: `em-lift-${uid}`,
  };

  return (
    <span
      className={`edupla-mark ${animated ? 'edupla-mark--animated' : ''} ${className}`}
      style={{ width: size, height: size, display: 'inline-block', lineHeight: 0 }}
    >
      <style>{`
        .edupla-mark svg { display: block; width: 100%; height: 100%; overflow: visible; }
        .edupla-mark--animated .em-badge {
          transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
          transform-origin: center;
        }
        .edupla-mark--animated:hover .em-badge { transform: scale(1.08) rotate(-4deg); }
        .edupla-mark--animated .em-glow { animation: em-breathe 4s ease-in-out infinite; }
        .edupla-mark--animated .em-streak { animation: em-sweep 5.5s ease-in-out infinite; }
        .edupla-mark--animated .em-sparkle {
          animation: em-twinkle 2.6s ease-in-out infinite;
          transform-origin: 23.1px 10.1px;
        }
        @keyframes em-breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes em-sweep {
          0% { opacity: 0; transform: translate(-7px, -7px); }
          18% { opacity: 0.9; }
          45% { opacity: 0; transform: translate(7px, 7px); }
          100% { opacity: 0; transform: translate(7px, 7px); }
        }
        @keyframes em-twinkle {
          0%, 100% { opacity: 0.55; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.18); }
        }
        @media (prefers-reduced-motion: reduce) {
          .edupla-mark--animated .em-glow,
          .edupla-mark--animated .em-streak,
          .edupla-mark--animated .em-sparkle { animation: none; }
          .edupla-mark--animated:hover .em-badge { transform: none; }
        }
      `}</style>

      <svg viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id={ids.bg} x1="1" y1="0" x2="31" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#A78BFA" />
            <stop offset="0.32" stopColor="#7C3AED" />
            <stop offset="0.68" stopColor="#4F46E5" />
            <stop offset="1" stopColor="#26215E" />
          </linearGradient>

          <radialGradient id={ids.glow} cx="10" cy="7" r="19" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
            <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.08" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>

          <radialGradient id={ids.vignette} cx="24" cy="27" r="16" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#1E1B4B" stopOpacity="0.45" />
            <stop offset="1" stopColor="#1E1B4B" stopOpacity="0" />
          </radialGradient>

          <linearGradient id={ids.streak} x1="2" y1="10" x2="14" y2="1" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.5" />
          </linearGradient>

          <linearGradient id={ids.glyph} x1="7" y1="7" x2="24" y2="25" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#DCD3FF" />
          </linearGradient>

          <linearGradient id={ids.rim} x1="7" y1="7" x2="16" y2="16" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>

          <linearGradient id={ids.gold} x1="20" y1="6.5" x2="26.5" y2="13" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FCEFC7" />
            <stop offset="0.5" stopColor="#F0C75E" />
            <stop offset="1" stopColor="#C99A2E" />
          </linearGradient>

          <clipPath id={ids.clip}>
            <rect width="32" height="32" rx="8.5" />
          </clipPath>

          <filter id={ids.glyphShadow} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0.9" stdDeviation="1" floodColor="#1E1B4B" floodOpacity="0.4" />
          </filter>

          <filter id={ids.lift} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1.1" stdDeviation="1.3" floodColor="#2E1065" floodOpacity="0.45" />
          </filter>
        </defs>

        <g className="em-badge" filter={`url(#${ids.lift})`}>
          <rect width="32" height="32" rx="8.5" fill={`url(#${ids.bg})`} />

          <g clipPath={`url(#${ids.clip})`}>
            <rect width="32" height="32" fill={`url(#${ids.vignette})`} />
            <rect className="em-glow" width="32" height="32" fill={`url(#${ids.glow})`} />
            <path className="em-streak" d="M0 12 L12 0 L18 0 L0 18 Z" fill={`url(#${ids.streak})`} />
            <rect x="0.6" y="0.6" width="30.8" height="30.8" rx="8" fill="none" stroke="#FFFFFF" strokeOpacity="0.16" strokeWidth="0.9" />
          </g>

          {/* Monogram: a stylised "E" built from four bars, doubling as an
              upward growth / progress mark. */}
          <g filter={`url(#${ids.glyphShadow})`}>
            <rect x="7.6" y="8.4" width="12.6" height="2.9" rx="1.45" fill={`url(#${ids.glyph})`} />
            <rect x="7.6" y="14.55" width="9.6" height="2.9" rx="1.45" fill={`url(#${ids.glyph})`} />
            <rect x="7.6" y="20.7" width="12.6" height="2.9" rx="1.45" fill={`url(#${ids.glyph})`} />
            <rect x="7.6" y="8.4" width="2.9" height="15.2" rx="1.45" fill={`url(#${ids.glyph})`} />
            <rect x="7.6" y="8.4" width="2.9" height="15.2" rx="1.45" fill={`url(#${ids.rim})`} />
          </g>

          <g className="em-sparkle" filter={`url(#${ids.glyphShadow})`}>
            <path d="M23.1 6.7 L24.05 9.15 L26.5 10.1 L24.05 11.05 L23.1 13.5 L22.15 11.05 L19.7 10.1 L22.15 9.15 Z" fill={`url(#${ids.gold})`} />
            <circle cx="23.1" cy="10.1" r="0.55" fill="#FFFFFF" fillOpacity="0.85" />
          </g>
        </g>
      </svg>
    </span>
  );
}