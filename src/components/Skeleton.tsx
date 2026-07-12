export function SkeletonBar({ w = 'full', h = '4' }: { w?: string; h?: string }) {
  return <div className={`w-${w} h-${h} bg-gray-200 rounded animate-pulse`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border space-y-3 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-2/3" />
      <div className="h-3 bg-gray-100 rounded w-full" />
      <div className="h-3 bg-gray-100 rounded w-4/5" />
    </div>
  );
}

export function SkeletonChat() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-start"><div className="bg-gray-200 rounded-2xl rounded-tl-sm h-12 w-2/3 animate-pulse" /></div>
      <div className="flex justify-end"><div className="bg-gray-200 rounded-2xl rounded-tr-sm h-16 w-3/4 animate-pulse" /></div>
      <div className="flex justify-start"><div className="bg-gray-200 rounded-2xl rounded-tl-sm h-10 w-1/2 animate-pulse" /></div>
      <div className="flex justify-end"><div className="bg-gray-200 rounded-2xl rounded-tr-sm h-20 w-2/3 animate-pulse" /></div>
    </div>
  );
}
