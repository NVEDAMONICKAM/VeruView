import React, { useEffect, useRef } from 'react';
import { GUIDE_CONTENT } from '../content/guide';
import VeruViewLogo from './VeruViewLogo';

// ---------------------------------------------------------------------------
// Section renderers
// ---------------------------------------------------------------------------
function Para({ text }) {
  return <p className="text-sm text-gray-700 leading-relaxed">{text}</p>;
}

function SubHeading({ text }) {
  return <p className="text-xs font-semibold text-veru-dark uppercase tracking-wide mt-3 mb-1">{text}</p>;
}

function BulletList({ items }) {
  return (
    <ul className="space-y-1.5 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-gray-700 leading-snug">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-veru-accent flex-shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function NumberedList({ items }) {
  return (
    <ol className="space-y-3 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="w-5 h-5 rounded-full bg-veru-accent text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
            {i + 1}
          </span>
          <div>
            <span className="font-semibold text-veru-dark">{item.label}: </span>
            <span className="text-gray-600">{item.detail}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function NoteBlock({ title, text }) {
  return (
    <div className="bg-veru-light border border-veru-mid rounded-xl px-3 py-2.5">
      <p className="text-xs font-semibold text-veru-dark mb-1">{title}</p>
      <p className="text-xs text-gray-600 leading-relaxed">{text}</p>
    </div>
  );
}

function TamilTable({ columns, rows }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-veru-mid">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-veru-mid">
            {columns.map((col, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left font-semibold text-veru-dark border-b border-veru-mid"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={ri % 2 === 0 ? 'bg-[#FDFAF5]' : 'bg-[#F7FDF9]'}
            >
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-gray-700 border-b border-veru-light last:border-b-0">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderBlock(block, i) {
  switch (block.type) {
    case 'para':       return <Para key={i} text={block.text} />;
    case 'subheading': return <SubHeading key={i} text={block.text} />;
    case 'list':       return <BulletList key={i} items={block.items} />;
    case 'numbered':   return <NumberedList key={i} items={block.items} />;
    case 'note':       return <NoteBlock key={i} title={block.title} text={block.text} />;
    case 'table':      return <TamilTable key={i} columns={block.columns} rows={block.rows} />;
    default:           return null;
  }
}

// ---------------------------------------------------------------------------
// Main InfoGuide drawer / bottom-sheet
// ---------------------------------------------------------------------------
export default function InfoGuide({ culture = 'ENGLISH', onClose }) {
  const content = GUIDE_CONTENT[culture] ?? GUIDE_CONTENT.ENGLISH;
  const scrollRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer — right side on desktop, bottom sheet on mobile */}
      <div
        className="
          fixed z-50
          bottom-0 left-0 right-0 h-[85vh]
          sm:bottom-auto sm:top-0 sm:right-0 sm:left-auto sm:h-full sm:w-[420px]
          bg-earth-warmWhite flex flex-col shadow-2xl
          rounded-t-2xl sm:rounded-none sm:rounded-l-2xl
          sm:animate-slide-in animate-slide-up
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-veru-mid flex-shrink-0">
          <VeruViewLogo size={28} showWordmark={false} />
          <h2
            className="flex-1 text-base font-semibold text-veru-dark leading-tight"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            {content.drawerTitle}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-veru-light hover:text-gray-700 transition-colors text-xl leading-none"
            aria-label="Close guide"
          >
            ×
          </button>
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {content.sections.map((section, si) => (
            <div key={si}>
              <h3
                className="text-sm font-bold text-veru-dark border-b border-veru-mid pb-1.5 mb-3"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                {section.heading}
              </h3>
              <div className="space-y-3">
                {section.body.map((block, bi) => renderBlock(block, bi))}
              </div>
            </div>
          ))}

          {/* Footer */}
          <p className="text-[10px] text-gray-400 text-center pt-2 pb-1">
            Last updated: {content.lastUpdated}
          </p>
        </div>
      </div>
    </>
  );
}
