export function StatusPill({ status }: { status: string }) {
  const style =
    status === 'ACTIVE'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'TARGET_REACHED'
        ? 'bg-indigo-50 text-indigo-700'
        : status === 'FAILED' || status === 'CANCELLED'
          ? 'bg-rose-50 text-rose-700'
          : 'bg-amber-50 text-amber-800';

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style}`}>
      {status.replaceAll('_', ' ').toLowerCase()}
    </span>
  );
}
