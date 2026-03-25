import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import ReportQueue from './ReportQueue';
import UserManagement from './UserManagement';
import FeaturedList from './FeaturedList';

const TABS = [
  { id: 'reports', label: 'Report Queue' },
  { id: 'users', label: 'Users' },
  { id: 'featured', label: 'Featured List' },
];

export default function ModerationPage() {
  const [tab, setTab] = useState('reports');

  return (
    <>
      <PageHeader title="Moderation" description="Content reports, user management, and featured list" />

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'reports' && <ReportQueue />}
      {tab === 'users' && <UserManagement />}
      {tab === 'featured' && <FeaturedList />}
    </>
  );
}
