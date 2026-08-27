import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import UpdateBanner from './UpdateBanner';

export default function AppShell() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Above everything: a stale tab has stale guards, and the guards are
            most of what this tool is. */}
        <UpdateBanner />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
