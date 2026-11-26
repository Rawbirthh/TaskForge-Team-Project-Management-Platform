import type { VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { badgeVariants } from '@/components/ui/badge-variants';
import { cn } from '@/lib/cn';

export interface BadgeProps extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
