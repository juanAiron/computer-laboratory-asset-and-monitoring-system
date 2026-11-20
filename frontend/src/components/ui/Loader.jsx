export function Loader({ label = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-700" />
      <p className="mt-3 text-sm font-medium">{label}</p>
    </div>
  )
}