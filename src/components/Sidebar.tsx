'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ApiKeySettings from '@/components/ApiKeySettings';

const NAV_ITEMS = [
  { href: '/', label: '上传简历' },
  { href: '/optimize', label: '优化简历' },
  { href: '/setup', label: '模拟面试' },
  { href: '/history', label: '面试记录' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0 h-full">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <span className="w-7 h-7 bg-gray-900 text-white rounded-lg flex items-center justify-center text-xs font-bold">I</span>
          <span className="font-bold text-base text-gray-900">IntervYOU</span>
        </Link>
        <button className="md:hidden text-gray-400" onClick={() => setMobileOpen(false)}>&times;</button>
      </div>

      <nav className="p-3 space-y-0.5 border-t border-gray-100">
        {NAV_ITEMS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === href || (href !== '/' && pathname.startsWith(href))
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${pathname === href || (href !== '/' && pathname.startsWith(href)) ? 'bg-blue-500' : 'bg-current opacity-40'}`} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <ApiKeySettings />
      <div className="flex-1" />

      <div className="p-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 leading-relaxed">
          先诊断简历，再模拟面试。面试暴露的弱点会反馈到简历建议中。
        </p>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block shrink-0">{sidebar}</div>

      {/* Mobile hamburger + drawer */}
      <div className="md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-3 left-3 z-40 w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center shadow-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
            <div className="relative z-10">{sidebar}</div>
          </div>
        )}
      </div>
    </>
  );
}
