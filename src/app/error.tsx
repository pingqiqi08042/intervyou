'use client';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center max-w-sm">
        <p className="text-gray-500 text-sm mb-4">页面加载出错</p>
        <button
          onClick={reset}
          className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-black transition-colors"
        >
          重试
        </button>
      </div>
    </div>
  );
}
