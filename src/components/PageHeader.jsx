export default function PageHeader({ title, description }) {
  return (
    <div className="mb-6">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
    </div>
  );
}
