import React from 'react';

/**
 * VeruView logo SVG — two overlapping "V" letters with a minimal tree above.
 * Branches and leaves grow upward; fine root lines below.
 *
 * Props:
 *  - size: pixel size (default 40)
 *  - showWordmark: whether to show "VeruView" text beside the icon (default true)
 *  - light: use white variant for dark backgrounds (default false)
 */
export default function Logo({ size = 40, showWordmark = true, light = false }) {
  const accent = light ? '#D4EDDA' : '#6BAF8C';
  const light1  = light ? '#ffffff' : '#A8D5B5';
  const text    = light ? '#ffffff' : '#3A7D5C';

  return (
    <div className="flex items-center gap-2 select-none">
      {/* ── Icon ─────────────────────────────────────────────────────────── */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="VeruView logo"
      >
        {/* Fine root lines (below) */}
        <line x1="50" y1="78" x2="38" y2="95" stroke={accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <line x1="50" y1="78" x2="50" y2="97" stroke={accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <line x1="50" y1="78" x2="62" y2="95" stroke={accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <line x1="38" y1="95" x2="30" y2="100" stroke={accent} strokeWidth="1" strokeLinecap="round" opacity="0.4" />
        <line x1="62" y1="95" x2="70" y2="100" stroke={accent} strokeWidth="1" strokeLinecap="round" opacity="0.4" />

        {/* Tree branches (above V letters) */}
        {/* Central trunk up from V apex */}
        <line x1="50" y1="38" x2="50" y2="18" stroke={accent} strokeWidth="2" strokeLinecap="round" />
        {/* Left branch */}
        <line x1="50" y1="24" x2="34" y2="12" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
        {/* Right branch */}
        <line x1="50" y1="24" x2="66" y2="12" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
        {/* Sub-left branch */}
        <line x1="38" y1="17" x2="28" y2="8" stroke={accent} strokeWidth="1.4" strokeLinecap="round" />
        {/* Sub-right branch */}
        <line x1="62" y1="17" x2="72" y2="8" stroke={accent} strokeWidth="1.4" strokeLinecap="round" />

        {/* Leaf dots at branch tips */}
        <circle cx="50" cy="17" r="3.5" fill={accent} />
        <circle cx="33" cy="11" r="3" fill={light1} />
        <circle cx="67" cy="11" r="3" fill={light1} />
        <circle cx="27" cy="7"  r="2.5" fill={accent} opacity="0.7" />
        <circle cx="73" cy="7"  r="2.5" fill={accent} opacity="0.7" />

        {/* Back V — slightly offset, lighter color */}
        <path
          d="M 28 38 L 50 72 L 72 38"
          stroke={light1}
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Front V — accent color, slightly offset left */}
        <path
          d="M 22 38 L 44 72 L 66 38"
          stroke={accent}
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      {/* ── Wordmark ─────────────────────────────────────────────────────── */}
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span
            style={{ fontFamily: 'Georgia, serif', color: text, fontSize: size * 0.5 }}
            className="font-bold tracking-tight"
          >
            VeruView
          </span>
          <span
            style={{ color: accent, fontSize: size * 0.22 }}
            className="tracking-wide uppercase font-sans"
          >
            Your roots. Your culture.
          </span>
        </div>
      )}
    </div>
  );
}
