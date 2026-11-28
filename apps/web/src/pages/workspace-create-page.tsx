import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api-client';
import { createWorkspace } from '@/features/workspaces/workspace-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const SELECTED_WORKSPACE_KEY = 'taskforge:selectedWorkspaceId';

export function WorkspaceCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): boolean {
    let ok = true;
    if (name.trim().length === 0 || name.trim().length > 80) {
      setNameError('Name must be between 1 and 80 characters.');
      ok = false;
    } else {
      setNameError(null);
    }
    if (slug.trim() && (slug.trim().length < 3 || slug.trim().length > 48)) {
      setSlugError('Slug must be between 3 and 48 characters.');
      ok = false;
    } else {
      setSlugError(null);
    }
    return ok;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const result = await createWorkspace({
        name: name.trim(),
        ...(slug.trim() ? { slug: slug.trim() } : {}),
      });
      window.localStorage.setItem(SELECTED_WORKSPACE_KEY, result.workspace.id);
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      void navigate('/app', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        const details = Array.isArray(error.details) ? error.details : [];
        let mapped = false;
        for (const detail of details) {
          if (!detail || typeof detail !== 'object') continue;
          const path = (detail as { path?: unknown }).path;
          const message = (detail as { message?: unknown }).message;
          if (typeof message !== 'string') continue;
          if (path === 'name') {
            setNameError(message);
            mapped = true;
          } else if (path === 'slug') {
            setSlugError(message);
            mapped = true;
          }
        }
        if (!mapped) {
          setFormError(error.message);
        }
      } else {
        setFormError('The request failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Create a workspace</CardTitle>
          <CardDescription>
            Workspaces are the home for your projects and team members.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <label htmlFor="workspace-name" className="text-sm font-medium text-ink">
                Name
              </label>
              <Input
                id="workspace-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? 'workspace-name-error' : undefined}
                disabled={isSubmitting}
              />
              {nameError ? (
                <p id="workspace-name-error" className="text-danger text-sm">
                  {nameError}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="workspace-slug" className="text-sm font-medium text-ink">
                Slug (optional)
              </label>
              <Input
                id="workspace-slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="my-workspace"
                aria-invalid={slugError ? true : undefined}
                aria-describedby={slugError ? 'workspace-slug-error' : undefined}
                disabled={isSubmitting}
              />
              {slugError ? (
                <p id="workspace-slug-error" className="text-danger text-sm">
                  {slugError}
                </p>
              ) : null}
              <p className="text-xs text-muted">
                Used in URLs. Lowercase letters, numbers, and hyphens only.
              </p>
            </div>

            {formError ? (
              <p role="alert" className="text-danger text-sm">
                {formError}
              </p>
            ) : null}

            <div className="flex items-center gap-3">
              <Button type="submit" isLoading={isSubmitting}>
                Create workspace
              </Button>
              <Link to="/app" className="text-sm text-muted hover:text-ink">
                Cancel
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
