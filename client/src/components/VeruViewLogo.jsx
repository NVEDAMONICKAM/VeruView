import React from 'react';

/**
 * VeruViewLogo — Option B
 * Two "V" letters side-by-side in Georgia serif, tight letter-spacing, #6BAF8C.
 * Two small leaves sprouting from the centre-top of the VV:
 *   - Left leaf leans upper-left, fill #A8D5B5
 *   - Right leaf leans upper-right, fill #6BAF8C
 * No trunk, no roots, no extra decoration.
 *
 * Props:
 *   size         — controls overall scale (default 40)
 *   showWordmark — show "VeruView" + tagline beside the icon (default true)
 *   light        — white/pale variant for dark backgrounds (default false)
 */
export default function VeruViewLogo({ size = 40, showWordmark = true, light = false }) {
  const green    = light ? '#D4EDDA' : '#6BAF8C';
  const midGreen = light ? '#ffffff' : '#A8D5B5';
  const nameColor = light ? '#ffffff' : '#3A7D5C';

  // Icon SVG — viewBox widened to 72×56 so Georgia serif edges are never clipped.
  // Font size reduced to 40 (from 46) and leaves repositioned to match.
  const iconW = size * 1.4;
  const iconH = size * 1.15;

  return (
    <div className="flex items-center gap-2 select-none">
      {/* ── Icon ───────────────────────────────────────────────────────────── */}
      <svg
        width={iconW}
        height={iconH}
        viewBox="0 0 72 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="VeruView icon"
        style={{ overflow: 'visible' }}
      >
        {/* Left leaf */}
        <ellipse
          cx="26"
          cy="12"
          rx="4"
          ry="9"
          fill={midGreen}
          transform="rotate(-32 26 12)"
        />

        {/* Right leaf */}
        <ellipse
          cx="46"
          cy="12"
          rx="4"
          ry="9"
          fill={green}
          transform="rotate(32 46 12)"
        />

        {/* VV — reduced to fontSize 40, centred on wider viewBox */}
        <text
          x="36"
          y="52"
          textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="40"
          fontWeight="bold"
          fill={green}
          letterSpacing="-3"
        >
          VV
        </text>
      </svg>

      {/* ── Wordmark ────────────────────────────────────────────────────────── */}
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              color: nameColor,
              fontSize: size * 0.52,
              fontWeight: 'bold',
              letterSpacing: '-0.3px',
            }}
          >
            VeruView
          </span>
          <span
            style={{
              color: green,
              fontSize: size * 0.23,
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.1px',
            }}
          >
            Family, in every language.
          </span>
        </div>
      )}
    </div>
  );
}
