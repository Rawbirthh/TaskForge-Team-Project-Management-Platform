import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Server } from 'lucide-react';
import { ApiError, apiRequest } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/page-state';
import { Skeleton } from '@/components/ui/skeleton';

interface HealthResponse {
  status: string;
  service: string;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`;
  }
  return `${Math.floor(seconds / 3600)}h`;
}

export function ApiStatusCard() {
  const healthQuery = useQuery({
    queryKey: ['api-health'],
    queryFn: () => apiRequest<HealthResponse>('/health'),
    refetchInterval: 30_000,
    retry: 0,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand">
            <Server className="size-4" aria-hidden="true" />
          </span>
          {healthQuery.isSuccess ? <Badge variant="success">Online</Badge> : null}
          {healthQuery.isError ? <Badge variant="danger">Unreachable</Badge> : null}
        </div>
        <CardTitle className="mt-2">API status</CardTitle>
      </CardHeader>

      <CardContent>
        {healthQuery.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : null}

        {healthQuery.isError ? (
          <ErrorState
            title="API is not reachable"
            description={
              healthQuery.error instanceof ApiError
                ? healthQuery.error.message
                : 'Start the API with pnpm dev:api and check the database configuration.'
            }
            onRetry={() => void healthQuery.refetch()}
          />
        ) : null}

        {healthQuery.isSuccess ? (
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Service</dt>
              <dd className="font-medium text-ink">{healthQuery.data.service}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Version</dt>
              <dd className="font-medium text-ink">{healthQuery.data.version}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Uptime</dt>
              <dd className="font-medium text-ink">
                {formatUptime(healthQuery.data.uptimeSeconds)}
              </dd>
            </div>
          </dl>
        ) : null}
      </CardContent>

      <CardFooter>
        <p className="text-xs text-muted">GET /api/v1/health</p>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => void healthQuery.refetch()}
          isLoading={healthQuery.isFetching}
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Refresh
        </Button>
      </CardFooter>
    </Card>
  );
}
