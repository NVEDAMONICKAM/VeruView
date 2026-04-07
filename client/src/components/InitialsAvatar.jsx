import React from 'react';

const COLORS = [
  ['#D4EDDA', '#3A7D5C'],
  ['#A8D5B5', '#2A5E42'],
  ['#6BAF8C', '#ffffff'],
  ['#B5D5C5', '#3A7D5C'],
  ['#C8E6C9', '#2E7D4F'],
];

function getColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function InitialsAvatar({ name, size = 48, className = '' }) {
  const [bg, fg] = getColor(name);
  const initials = getInitials(name);

  return (
    <div
      className={`flex items-center justify-center rounded-full font-semibold flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        color: fg,
        fontSize: size * 0.36,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {initials}
    </div>
  );
}
