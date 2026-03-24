import PageHeader from '../../components/PageHeader';

export default function SeedingPage() {
  return (
    <>
      <PageHeader
        title="Registry Seeding"
        description="Manage registry seed runs — status, triggers, and history"
      />
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-sm text-gray-500">
        Seeding dashboard coming in Phase 1.2 (#207).
        <br />
        <br />
        For now, use the CLI:
        <pre className="mt-2 bg-gray-50 rounded p-3 text-xs font-mono">
{`railway run --service listgem-platform node scripts/seed-all.js
railway run --service listgem-platform node scripts/seed-status.js`}
        </pre>
      </div>
    </>
  );
}
