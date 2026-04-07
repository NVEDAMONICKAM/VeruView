import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import VeruViewLogo from './VeruViewLogo';
import { updateTree, shareTree } from '../api/client';

export default function TopBar({ tree, perspectiveName, onTreeUpdate, isReadOnly = false }) {
  const [shareMsg, setShareMsg]       = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput]     = useState(tree?.name ?? '');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleCultureToggle() {
    if (isReadOnly || !tree) return;
    const next = tree.culture === 'TAMIL' ? 'ENGLISH' : 'TAMIL';
    try {
      const res = await updateTree(tree.id, { culture: next });
      onTreeUpdate?.(res.data);
    } catch { /* silently fail */ }
  }

  async function handleShare() {
    if (!tree) return;
    try {
      const res = await shareTree(tree.id);
      const url = `${window.location.origin}/share/${res.data.shareToken}`;
      await navigator.clipboard.writeText(url);
      setShareMsg('Link copied!');
      setTimeout(() => setShareMsg(''), 2500);
    } catch {
      setShareMsg('Failed to copy link');
      setTimeout(() => setShareMsg(''), 2500);
    }
  }

  async function handleNameSave() {
    if (!nameInput.trim() || nameInput === tree.name) { setEditingName(false); return; }
    try {
      const res = await updateTree(tree.id, { name: nameInput.trim() });
      onTreeUpdate?.(res.data);
    } catch { setNameInput(tree.name); }
    finally { setEditingName(false); }
  }

  // Shared control: culture toggle button content
  const cultureToggle = (
    <button
      onClick={() => { handleCultureToggle(); setMobileMenuOpen(false); }}
      disabled={isReadOnly}
      className={`flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors
        ${tree?.culture === 'TAMIL'
          ? 'bg-veru-accent text-white border-veru-accent'
          : 'bg-earth-warmWhite text-veru-dark border-veru-mid hover:bg-veru-light'
        }
        ${isReadOnly ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
      title="Toggle between English and Tamil kinship labels"
    >
      {tree?.culture === 'TAMIL'
        ? <><span>தமிழ்</span><span className="opacity-70"> · Tamil</span></>
        : <span>English</span>
      }
    </button>
  );

  // Shared control: share button
  const shareButton = !isReadOnly && (
    <button
      onClick={() => { handleShare(); setMobileMenuOpen(false); }}
      className="flex items-center gap-1.5 text-xs font-semibold text-veru-dark bg-veru-light hover:bg-veru-mid border border-veru-mid rounded-full px-3 py-1.5 transition-colors"
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
        <path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5z"/>
      </svg>
      {shareMsg || 'Share'}
    </button>
  );

  return (
    <>
      <header className="h-14 bg-earth-warmWhite border-b border-veru-mid flex items-center px-4 gap-3 shadow-sm z-20 flex-shrink-0">
        {/* Logo */}
        <Link to="/" className="flex-shrink-0">
          <VeruViewLogo size={32} showWordmark={false} />
        </Link>

        {/* Tree name — always visible */}
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {editingName && !isReadOnly ? (
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSave();
                if (e.key === 'Escape') setEditingName(false);
              }}
              className="border border-veru-accent rounded px-2 py-0.5 text-sm font-semibold text-gray-900 bg-white focus:outline-none max-w-[160px] sm:max-w-xs"
            />
          ) : (
            <button
              onClick={() => !isReadOnly && setEditingName(true)}
              className={`text-sm font-semibold text-veru-dark truncate max-w-[130px] sm:max-w-[200px] ${!isReadOnly ? 'hover:underline' : ''}`}
              title={isReadOnly ? tree?.name : 'Click to rename'}
            >
              {tree?.name ?? '…'}
            </button>
          )}
          {isReadOnly && (
            <span className="ml-1 text-[10px] font-medium bg-veru-light text-veru-dark px-2 py-0.5 rounded-full border border-veru-mid flex-shrink-0">
              Read-only
            </span>
          )}
        </div>

        {/* Desktop: perspective indicator */}
        {perspectiveName && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 bg-veru-light border border-veru-mid rounded-full px-3 py-1 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-veru-accent inline-block" />
            Viewing as <span className="font-semibold text-veru-dark">{perspectiveName}</span>
          </div>
        )}

        {/* Desktop: culture toggle + share */}
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          {cultureToggle}
          {shareButton}
        </div>

        {/* Mobile: hamburger */}
        <button
          className="sm:hidden flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-veru-mid text-veru-dark hover:bg-veru-light transition-colors"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label="Open menu"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="2" y1="4.5" x2="16" y2="4.5"/>
            <line x1="2" y1="9"   x2="16" y2="9"/>
            <line x1="2" y1="13.5" x2="16" y2="13.5"/>
          </svg>
        </button>
      </header>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden fixed inset-0 z-30" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="absolute top-14 left-0 right-0 bg-earth-warmWhite border-b border-veru-mid shadow-lg px-4 py-4 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Perspective */}
            {perspectiveName && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-2 h-2 rounded-full bg-veru-accent inline-block flex-shrink-0" />
                <span>Viewing as <strong className="text-veru-dark">{perspectiveName}</strong></span>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              {cultureToggle}
              {shareButton}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
