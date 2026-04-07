import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSharedTree, getSharedKinship } from '../api/client';
import TopBar from '../components/TopBar';
import TreeCanvas from '../components/TreeCanvas';
import VeruViewLogo from '../components/VeruViewLogo';

export default function SharedTreeView() {
  const { token } = useParams();
  const [tree, setTree] = useState(null);
  const [kinship, setKinship] = useState({});
  const [perspectiveId, setPerspectiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load shared tree
  useEffect(() => {
    getSharedTree(token)
      .then((res) => {
        const t = res.data;
        const people = Array.isArray(t.people) ? t.people : [];
        setTree({ ...t, people, relationships: Array.isArray(t.relationships) ? t.relationships : [] });
        if (people.length > 0) setPerspectiveId(people[0].id);
      })
      .catch(() => setError('This share link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  // Load kinship when perspective changes
  useEffect(() => {
    if (!perspectiveId || !tree) return;
    getSharedKinship(token, perspectiveId)
      .then((res) => setKinship(res.data))
      .catch(() => {});
  }, [perspectiveId, tree?.culture]);

  const perspectivePerson = tree?.people.find((p) => p.id === perspectiveId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-veru-light">
        <div className="w-10 h-10 border-4 border-veru-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-veru-light gap-6 p-4">
        <VeruViewLogo size={48} />
        <p className="text-red-500 text-sm">{error}</p>
        <Link to="/" className="text-veru-accent hover:underline text-sm">
          ← Go to VeruView
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-veru-light">
      <TopBar
        tree={tree}
        perspectiveName={perspectivePerson?.name}
        isReadOnly={true}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — people list for perspective switching */}
        <aside className="w-48 bg-earth-warmWhite border-r border-veru-mid flex flex-col z-10 flex-shrink-0">
          <div className="flex-1 overflow-y-auto p-2 pt-3">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold px-2 pb-1">
              People
            </p>
            {tree?.people.map((person) => (
              <button
                key={person.id}
                onClick={() => setPerspectiveId(person.id)}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm mb-0.5 transition-colors flex items-center gap-2 truncate
                  ${perspectiveId === person.id
                    ? 'bg-veru-accent text-white font-semibold'
                    : 'text-gray-700 hover:bg-veru-light'
                  }`}
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0
                    ${person.gender === 'MALE' ? 'bg-blue-300' : person.gender === 'FEMALE' ? 'bg-pink-300' : 'bg-gray-300'}`}
                />
                <span className="truncate">{person.name}</span>
              </button>
            ))}
          </div>
          <div className="p-3 border-t border-veru-light">
            <Link
              to="/"
              className="block text-center text-xs text-veru-accent hover:text-veru-dark font-medium"
            >
              Build your own tree →
            </Link>
          </div>
        </aside>

        <main className="flex-1 overflow-hidden">
          {tree?.people.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-400">This tree has no people yet.</p>
            </div>
          ) : (
            <TreeCanvas
              people={tree?.people ?? []}
              relationships={tree?.relationships ?? []}
              kinship={kinship}
              perspectiveId={perspectiveId}
              culture={tree?.culture}
              isReadOnly={true}
              onPerspectiveChange={setPerspectiveId}
            />
          )}
        </main>
      </div>
    </div>
  );
}
