import { useId } from 'react';

/*
 * Animated Edupla brand mark — v3, "Prism & Ascent".
 *
 * Browser tab favicons are rasterized once and can't actually animate in
 * any real browser — so this lives as a real component instead, for use
 * anywhere the motion will actually be visible: the nav header, splash /
 * loading screens, empty states, the sign-in page, etc.
 *
 * Same visual design as public/favicon-v2.svg (violet -> indigo badge, a
 * faceted prism-shard highlight, an embossed "E" monogram that doubles as
 * an ascending bar chart, a dotted "growth path" running to a four-point
 * achievement spark) with several subtle looping animations layered on
 * top:
 *   - a slow "breathing" glass highlight
 *   - a soft diagonal prism-shard sweep across the badge
 *   - the dotted growth path flowing upward toward the spark
 *   - a twinkling, gently rotating gold sparkle
 *   - a single tiny particle orbiting the sparkle, like a stray idea
 *     catching the light
 * plus a spring-y scale/tilt and a brightened glow on hover. All motion is
 * disabled when the viewer has `prefers-reduced-motion` set, and every
 * gradient/filter id is unique per instance (via useId) so multiple copies
 * can safely render on the same page (e.g. header + mobile menu) without
 * colliding.
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
    shard: `em-shard-${uid}`,
    glyph: `em-glyph-${uid}`,
    rim: `em-rim-${uid}`,
    gold: `em-gold-${uid}`,
    path: `em-path-${uid}`,
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
          transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
                      filter 0.35s ease;
          transform-origin: center;
        }
        .edupla-mark--animated:hover .em-badge {
          transform: scale(1.08) rotate(-4deg);
          filter: drop-shadow(0 0 3.5px rgba(245, 185, 74, 0.55));
        }

        .edupla-mark--animated .em-glow { animation: em-breathe 4s ease-in-out infinite; }
        .edupla-mark--animated .em-shard { animation: em-sweep 5.5s ease-in-out infinite; }

        .edupla-mark--animated .em-path-dash {
          stroke-dasharray: 0.4 2.4;
          animation: em-flow 1.6s linear infinite;
        }

        .edupla-mark--animated .em-sparkle {
          animation: em-twinkle 2.6s ease-in-out infinite;
          transform-origin: 23.1px 10.1px;
        }
        .edupla-mark--animated .em-orbit {
          animation: em-orbit 4.8s linear infinite;
          transform-origin: 23.1px 10.1px;
        }

        @keyframes em-breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes em-sweep {
          0% { opacity: 0; transform: translate(-7px, -7px); }
          18% { opacity: 0.9; }
          45% { opacity: 0; transform: translate(7px, 7px); }
          100% { opacity: 0; transform: translate(7px, 7px); }
        }
        @keyframes em-flow { to { stroke-dashoffset: -5.6; } }
        @keyframes em-twinkle {
          0%, 100% { opacity: 0.6; transform: scale(0.85) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.2) rotate(18deg); }
        }
        @keyframes em-orbit {
          0% { transform: rotate(0deg) translateX(3.6px) rotate(0deg); opacity: 0; }
          10%, 85% { opacity: 0.9; }
          100% { transform: rotate(360deg) translateX(3.6px) rotate(-360deg); opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .edupla-mark--animated .em-glow,
          .edupla-mark--animated .em-shard,
          .edupla-mark--animated .em-path-dash,
          .edupla-mark--animated .em-sparkle,
          .edupla-mark--animated .em-orbit { animation: none; }
          .edupla-mark--animated:hover .em-badge { transform: none; filter: none; }
        }
      `}</style>

      <svg viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id={ids.bg} x1="1" y1="0" x2="30" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#A78BFA" />
            <stop offset="0.3" stopColor="#7C3AED" />
            <stop offset="0.62" stopColor="#4338CA" />
            <stop offset="1" stopColor="#1E1B4B" />
          </linearGradient>

          <radialGradient id={ids.glow} cx="10" cy="7" r="20" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
            <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.08" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>

          <radialGradient id={ids.vignette} cx="25" cy="27" r="17" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#1E1B4B" stopOpacity="0.5" />
            <stop offset="1" stopColor="#1E1B4B" stopOpacity="0" />
          </radialGradient>

          <linearGradient id={ids.shard} x1="0" y1="20" x2="20" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.5" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>

          <linearGradient id={ids.glyph} x1="7" y1="7" x2="24" y2="25" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#DCD3FF" />
          </linearGradient>

          <linearGradient id={ids.rim} x1="7" y1="7" x2="15" y2="15" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>

          <linearGradient id={ids.gold} x1="19.6" y1="6.2" x2="26.8" y2="13.4" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FDE9B0" />
            <stop offset="0.45" stopColor="#F5B94A" />
            <stop offset="1" stopColor="#E0791E" />
          </linearGradient>

          <linearGradient id={ids.path} x1="9" y1="22" x2="23" y2="10" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#7DD3FC" stopOpacity="0" />
            <stop offset="0.5" stopColor="#A5F3FC" stopOpacity="0.85" />
            <stop offset="1" stopColor="#FDE9B0" stopOpacity="0.95" />
          </linearGradient>

          <clipPath id={ids.clip}>
            <rect width="32" height="32" rx="9" />
          </clipPath>

          <filter id={ids.glyphShadow} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0.9" stdDeviation="1" floodColor="#1E1B4B" floodOpacity="0.4" />
          </filter>

          <filter id={ids.lift} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1.2" stdDeviation="1.4" floodColor="#2E1065" floodOpacity="0.4" />
          </filter>
        </defs>

        <g className="em-badge" filter={`url(#${ids.lift})`}>
          <rect width="32" height="32" rx="9" fill={`url(#${ids.bg})`} />

          <g clipPath={`url(#${ids.clip})`}>
            <rect width="32" height="32" fill={`url(#${ids.vignette})`} />
            <rect className="em-glow" width="32" height="32" fill={`url(#${ids.glow})`} />
            <path className="em-shard" d="M0 13 L13 0 L20 0 L0 20 Z" fill={`url(#${ids.shard})`} />
            <rect x="0.6" y="0.6" width="30.8" height="30.8" rx="8.5" fill="none" stroke="#FFFFFF" strokeOpacity="0.16" strokeWidth="0.9" />
          </g>

          {/* Ascending growth path: a quiet dotted thread from the
              monogram's base to the achievement spark. */}
          <path
            className="em-path-dash"
            d="M17.1 22.6 C19.4 21.4 20.9 19.4 21.6 16.6 C22.1 14.6 22.4 12.6 23 10.9"
            fill="none"
            stroke={`url(#${ids.path})`}
            strokeWidth="1"
            strokeLinecap="round"
          />

          {/* Monogram: a stylised "E" built from four bars, doubling as an
              upward growth / progress mark. */}
          <g filter={`url(#${ids.glyphShadow})`}>
            <rect x="7.6" y="8.4" width="12.6" height="2.9" rx="1.45" fill={`url(#${ids.glyph})`} />
            <rect x="7.6" y="14.55" width="9.6" height="2.9" rx="1.45" fill={`url(#${ids.glyph})`} />
            <rect x="7.6" y="20.7" width="12.6" height="2.9" rx="1.45" fill={`url(#${ids.glyph})`} />
            <rect x="7.6" y="8.4" width="2.9" height="15.2" rx="1.45" fill={`url(#${ids.glyph})`} />
            <rect x="7.6" y="8.4" width="2.9" height="15.2" rx="1.45" fill={`url(#${ids.rim})`} />
          </g>

          <circle className="em-orbit" cx="23.1" cy="10.1" r="0.42" fill="#FFFFFF" fillOpacity="0.9" />

          <g className="em-sparkle" filter={`url(#${ids.glyphShadow})`}>
            <path d="M23.1 6.5 L24.15 9.05 L26.7 10.1 L24.15 11.15 L23.1 13.7 L22.05 11.15 L19.5 10.1 L22.05 9.05 Z" fill={`url(#${ids.gold})`} />
            <circle cx="23.1" cy="10.1" r="0.5" fill="#FFFFFF" fillOpacity="0.9" />
          </g>
        </g>
      </svg>
    </span>
  );
}