import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import UserAnalytics from './UserAnalytics';
import ConsensusHealth from './ConsensusHealth';
import AuditLog from './AuditLog';
import SystemStatus from './SystemStatus';

const TABS = [
  { id: 'users', label: 'User Analytics' },
  { id: 'consensus', label: 'Consensus Health' },
  { id: 'audit', label: 'Audit Log' },
  { id: 'system', label: 'System' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState('users');

  return (
    <>
      <PageHeader title="Admin" description="User analytics, consensus health, audit trail, and system status" />

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

      {tab === 'users' && <UserAnalytics />}
      {tab === 'consensus' && <ConsensusHealth />}
      {tab === 'audit' && <AuditLog />}
      {tab === 'system' && <SystemStatus />}
    </>
  );
}
