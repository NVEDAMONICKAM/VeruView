import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import InitialsAvatar from './InitialsAvatar';

/**
 * PersonNode — React Flow custom node for a family member.
 *
 * data props:
 *   person       — { id, name, dob, gender, photoUrl }
 *   kinship      — { kinshipKey, title: { script, transliteration, english } } | null
 *   culture      — "ENGLISH" | "TAMIL"
 *   isPerspective — boolean (highlighted when this is the viewpoint person)
 *   isReadOnly   — boolean
 *   onClickNode  — (personId) => void — switches perspective
 *   onEditNode   — (person) => void — opens edit modal
 */
function PersonNode({ data, selected }) {
  const { person, kinship, culture, isPerspective, isReadOnly, onClickNode, onEditNode } = data;

  const title = kinship?.title ?? null;
  const showTamil = culture === 'TAMIL' && title?.script;

  return (
    <div
      className={`
        relative group bg-earth-warmWhite rounded-2xl shadow-md border-2 transition-all cursor-pointer
        w-44 select-none min-h-[44px]
        ${isPerspective
          ? 'border-veru-accent shadow-veru-accent/30 shadow-lg scale-105'
          : person.gender === 'FEMALE'
            ? 'border-earth-rose hover:border-veru-accent hover:shadow-lg'
            : 'border-veru-mid hover:border-veru-accent hover:shadow-lg'
        }
        ${selected ? 'ring-2 ring-veru-dark ring-offset-1' : ''}
      `}
      onClick={() => onClickNode?.(person.id)}
      onDoubleClick={() => !isReadOnly && onEditNode?.(person)}
      title={isReadOnly ? person.name : `Click to set perspective · Double-click to edit`}
    >
      {/* React Flow handles — invisible connection points */}
      <Handle type="target" position={Position.Top}    className="!bg-veru-mid !w-2 !h-2 !border-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-veru-mid !w-2 !h-2 !border-0" />
      <Handle type="target" position={Position.Left}   className="!bg-veru-mid !w-2 !h-2 !border-0" />
      <Handle type="source" position={Position.Right}  className="!bg-veru-mid !w-2 !h-2 !border-0" />

      {/* Perspective indicator badge */}
      {isPerspective && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-veru-accent text-white text-[9px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap z-10">
          Viewing as
        </div>
      )}

      {/* Edit button (visible on hover, desktop only) */}
      {!isReadOnly && (
        <button
          className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity
                     bg-veru-light hover:bg-veru-mid text-veru-dark rounded-full w-6 h-6
                     flex items-center justify-center text-xs z-10"
          onClick={(e) => { e.stopPropagation(); onEditNode?.(person); }}
          title="Edit person"
        >
          ✎
        </button>
      )}

      <div className="p-3 flex flex-col items-center gap-1.5">
        {/* Avatar */}
        <div className="relative">
          {person.photoUrl ? (
            <img
              src={person.photoUrl}
              alt={person.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-veru-mid"
            />
          ) : (
            <InitialsAvatar name={person.name} size={56} />
          )}
          {/* Gender indicator dot */}
          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white
              ${person.gender === 'MALE' ? 'bg-blue-300' :
                person.gender === 'FEMALE' ? 'bg-pink-300' : 'bg-gray-300'}`}
          />
        </div>

        {/* Name */}
        <p
          className="text-sm font-semibold text-center text-gray-800 leading-tight w-full truncate px-1"
          style={{ fontFamily: 'Georgia, serif' }}
          title={person.name}
        >
          {person.name}
        </p>

        {/* Date of birth */}
        {person.dob && (
          <p className="text-[10px] text-gray-400 leading-none">
            {new Date(person.dob).getFullYear()}
          </p>
        )}

        {/* Kinship title area */}
        {title && (
          <div className="w-full border-t border-veru-light pt-1.5 mt-0.5 text-center">
            {showTamil ? (
              <>
                {/* Line 1: Tamil script — large */}
                <p className="text-base font-semibold text-veru-dark leading-tight">
                  {title.script}
                </p>
                {/* Line 2: Transliteration · English — small, muted */}
                <p className="text-[10px] text-gray-400 leading-snug">
                  {title.transliteration} · {title.english}
                </p>
              </>
            ) : (
              /* English-only — just the label */
              <p className="text-xs font-medium text-veru-dark">
                {title.english}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(PersonNode);
