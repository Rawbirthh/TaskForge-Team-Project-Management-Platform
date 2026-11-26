import { Link } from 'react-router';
import { cn } from '@/lib/cn';

interface BrandProps {
  className?: string;
  showName?: boolean;
}

export function Brand({ className, showName = true }: BrandProps) {
  return (
    <Link
      to="/"
      aria-label="TaskForge home"
      className={cn('inline-flex items-center gap-2.5 rounded-md', className)}
    >
      <span className="grid size-9 place-items-center rounded-lg bg-brand text-sm font-bold tracking-tight text-white shadow-sm">
        TF
      </span>
      {showName ? (
        <span className="text-base font-semibold tracking-tight text-ink">TaskForge</span>
      ) : null}
    </Link>
  );
}
