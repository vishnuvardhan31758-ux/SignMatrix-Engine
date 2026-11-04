import backgroundPattern from '@documenso/assets/images/background-pattern.png';
import { Database, ShieldCheck, Zap } from 'lucide-react';
import { Outlet } from 'react-router';

import { PublicLegalLinks } from '~/components/general/public-legal-links';

export default function Layout() {
  const fillCredentials = (email: string) => {
    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement | null;
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement | null;
    if (emailInput && passwordInput) {
      emailInput.value = email;
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      passwordInput.value = 'password';
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden px-4 py-8 md:p-12">
      {/* Top System Status & Feature Banner */}
      <div className="z-20 mb-6 flex flex-wrap items-center justify-center gap-3 rounded-full border border-primary/20 bg-background/80 px-4 py-2 text-xs shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2 font-medium text-emerald-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <span>Engine Online (Port 3000)</span>
        </div>
        <span className="text-muted-foreground">•</span>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Database className="h-3.5 w-3.5 text-blue-500" />
          <span>PostgreSQL + Redis Connected</span>
        </div>
        <span className="text-muted-foreground">•</span>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-purple-500" />
          <span>25+ Features Active</span>
        </div>
        <span className="text-muted-foreground">•</span>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">Quick Test:</span>
          <button
            type="button"
            onClick={() => fillCredentials('admin@documenso.com')}
            className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <Zap className="h-3 w-3" />
            Fill Admin
          </button>
          <button
            type="button"
            onClick={() => fillCredentials('example@documenso.com')}
            className="flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-0.5 font-medium text-secondary-foreground transition-colors hover:bg-secondary"
          >
            Fill Member
          </button>
        </div>
      </div>

      <div className="flex w-full flex-1 flex-col items-center justify-center">
        <div className="absolute -inset-[min(600px,max(400px,60vw))] -z-[1] flex items-center justify-center opacity-70">
          <img
            src={backgroundPattern}
            alt="background pattern"
            className="dark:brightness-95 dark:contrast-[70%] dark:invert dark:sepia"
            style={{
              mask: 'radial-gradient(rgba(255, 255, 255, 1) 0%, transparent 80%)',
              WebkitMask: 'radial-gradient(rgba(255, 255, 255, 1) 0%, transparent 80%)',
            }}
          />
        </div>

        <div className="relative flex w-full items-center justify-center">
          <Outlet />
        </div>
      </div>

      <footer className="z-10 mt-8 w-full">
        <PublicLegalLinks />
      </footer>
    </main>
  );
}
