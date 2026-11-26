import { forwardRef, type ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const Input = forwardRef<HTMLInputElement, ComponentProps<'input'>>(function Input(
  { className, type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink shadow-sm transition-colors placeholder:text-muted/70 focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 aria-[invalid=true]:border-red-500',
        className,
      )}
      {...props}
    />
  );
});
