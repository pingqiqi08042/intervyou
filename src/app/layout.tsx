import type { Metadata } from 'next';
import { ToastProvider } from '@/components/Toast';
import Sidebar from '@/components/Sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: 'IntervYOU — AI 面试教练',
  description: '从简历出发，模拟真实面试，帮你拿到心仪 offer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex">
        <ToastProvider>
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-gray-50">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
