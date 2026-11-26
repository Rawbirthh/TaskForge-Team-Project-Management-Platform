import { Check, Copy, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const commands = [
  { command: 'pnpm install', description: 'Install workspace dependencies.' },
  {
    command: 'pnpm db:migrate',
    description: 'Apply the initial migration to the development database.',
  },
  { command: 'pnpm db:seed', description: 'Seed the schema version idempotently.' },
  { command: 'pnpm dev', description: 'Run the API and web app together.' },
];

function CommandBlock({ command, description }: { command: string; description: string }) {
  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(command);
      toast.success('Command copied');
    } catch {
      toast.error('Could not copy the command');
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-muted/40 p-3">
      <Terminal className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <code className="block text-sm font-medium break-all text-ink">{command}</code>
        <p className="text-xs leading-5 text-muted">{description}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        aria-label={`Copy ${command}`}
        onClick={() => void copyCommand()}
      >
        <Copy className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}

export function SetupCommandsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Check className="size-4" aria-hidden="true" />
          Setup commands
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Local setup</DialogTitle>
          <DialogDescription>
            Create the development database and user first, copy{' '}
            <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">
              apps/api/.env.example
            </code>{' '}
            to <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">apps/api/.env</code>,
            then run these commands from the repository root.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5 space-y-2">
          {commands.map((item) => (
            <CommandBlock key={item.command} {...item} />
          ))}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
