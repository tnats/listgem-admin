import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard' },
    ],
  },
  {
    label: 'Registry',
    items: [
      { to: '/seeding', label: 'Seeding' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/worker', label: 'Worker Health' },
      { to: '/pipeline', label: 'Pipeline Monitor' },
      { to: '/apis', label: 'APIs' },
      { to: '/emails', label: 'Email Templates' },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/moderation', label: 'Moderation' },
      { to: '/quality', label: 'Quality Metrics' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/settings', label: 'Settings' },
    ],
  },
];

function navLinkClass({ isActive }) {
  return `block px-3 py-1.5 rounded text-sm ${
    isActive
      ? 'bg-indigo-50 text-indigo-700 font-medium'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
  }`;
}

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col h-screen sticky top-0">
      <div className="px-4 py-4 border-b border-gray-200">
        <span className="text-base font-semibold text-gray-900">ListGem</span>
        <span className="ml-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Admin</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            <div className="px-3 mb-1 text-xs font-medium text-gray-400 uppercase tracking-wider">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map(item => (
                <NavLink key={item.to} to={item.to} className={navLinkClass} end={item.to === '/'}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-gray-200">
        <div className="text-sm text-gray-700 truncate">{user?.username || user?.email}</div>
        <button
          onClick={logout}
          className="mt-1 text-xs text-gray-400 hover:text-gray-600"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
