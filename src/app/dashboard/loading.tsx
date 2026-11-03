export default function DashboardLoading() {
  return (
    <div className="grid gap-7 2xl:grid-cols-[minmax(0,1fr)_340px]" aria-busy="true">
      <div className="space-y-7">
        <div className="skeleton h-72 rounded-[28px]" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-32 rounded-3xl" />
          ))}
        </div>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-16 rounded-2xl" />
        ))}
      </div>
      <div className="space-y-7">
        <div className="skeleton h-44 rounded-3xl" />
        <div className="skeleton h-72 rounded-3xl" />
        <div className="skeleton h-56 rounded-3xl" />
      </div>
    </div>
  );
}
