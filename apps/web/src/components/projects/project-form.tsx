import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ProjectFormValues } from '@/features/projects/project-form-utils';
import type { EditableProjectStatus, ProjectVisibility } from '@/types/project';

interface ProjectFormProps {
  initialValues: ProjectFormValues;
  isKeyEditable: boolean;
  isPending: boolean;
  submitLabel: string;
  error: string | null;
  fieldErrors: Record<string, string>;
  onSubmit: (values: ProjectFormValues) => void;
}

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-red-700">
      {message}
    </p>
  );
}

export function ProjectForm({
  initialValues,
  isKeyEditable,
  isPending,
  submitLabel,
  error,
  fieldErrors,
  onSubmit,
}: ProjectFormProps) {
  const [values, setValues] = useState<ProjectFormValues>(initialValues);

  function update<K extends keyof ProjectFormValues>(field: K, value: ProjectFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    onSubmit(values);
  }

  const selectClass =
    'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}

      <div>
        <label htmlFor="project-name" className="mb-1 block text-sm font-medium text-ink">
          Name
        </label>
        <Input
          id="project-name"
          value={values.name}
          maxLength={120}
          disabled={isPending}
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? 'project-name-error' : undefined}
          onChange={(event) => update('name', event.target.value)}
        />
        <FieldError id="project-name-error" message={fieldErrors.name} />
      </div>

      <div>
        <label htmlFor="project-key" className="mb-1 block text-sm font-medium text-ink">
          Key
        </label>
        <Input
          id="project-key"
          value={values.key}
          maxLength={16}
          disabled={isPending || !isKeyEditable}
          aria-invalid={Boolean(fieldErrors.key)}
          aria-describedby={fieldErrors.key ? 'project-key-error' : undefined}
          onChange={(event) => update('key', event.target.value)}
        />
        <FieldError id="project-key-error" message={fieldErrors.key} />
        {!isKeyEditable ? (
          <p className="mt-1 text-xs text-muted">Project keys cannot be changed.</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="project-description" className="mb-1 block text-sm font-medium text-ink">
          Description
        </label>
        <textarea
          id="project-description"
          value={values.description}
          maxLength={2000}
          rows={4}
          disabled={isPending}
          aria-invalid={Boolean(fieldErrors.description)}
          aria-describedby={fieldErrors.description ? 'project-description-error' : undefined}
          onChange={(event) => update('description', event.target.value)}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-70"
        />
        <FieldError id="project-description-error" message={fieldErrors.description} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="project-visibility" className="mb-1 block text-sm font-medium text-ink">
            Visibility
          </label>
          <select
            id="project-visibility"
            value={values.visibility}
            disabled={isPending}
            aria-invalid={Boolean(fieldErrors.visibility)}
            aria-describedby={fieldErrors.visibility ? 'project-visibility-error' : undefined}
            onChange={(event) => update('visibility', event.target.value as ProjectVisibility)}
            className={selectClass}
          >
            <option value="WORKSPACE">Workspace</option>
            <option value="PRIVATE">Private</option>
          </select>
          <FieldError id="project-visibility-error" message={fieldErrors.visibility} />
        </div>

        <div>
          <label htmlFor="project-status" className="mb-1 block text-sm font-medium text-ink">
            Initial status
          </label>
          <select
            id="project-status"
            value={values.status}
            disabled={isPending}
            aria-invalid={Boolean(fieldErrors.status)}
            aria-describedby={fieldErrors.status ? 'project-status-error' : undefined}
            onChange={(event) => update('status', event.target.value as EditableProjectStatus)}
            className={selectClass}
          >
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <FieldError id="project-status-error" message={fieldErrors.status} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="project-start-date" className="mb-1 block text-sm font-medium text-ink">
            Start date
          </label>
          <Input
            id="project-start-date"
            type="date"
            value={values.startDate}
            disabled={isPending}
            aria-invalid={Boolean(fieldErrors.startDate)}
            aria-describedby={fieldErrors.startDate ? 'project-start-date-error' : undefined}
            onChange={(event) => update('startDate', event.target.value)}
          />
          <FieldError id="project-start-date-error" message={fieldErrors.startDate} />
        </div>

        <div>
          <label htmlFor="project-target-date" className="mb-1 block text-sm font-medium text-ink">
            Target date
          </label>
          <Input
            id="project-target-date"
            type="date"
            value={values.targetDate}
            disabled={isPending}
            aria-invalid={Boolean(fieldErrors.targetDate)}
            aria-describedby={fieldErrors.targetDate ? 'project-target-date-error' : undefined}
            onChange={(event) => update('targetDate', event.target.value)}
          />
          <FieldError id="project-target-date-error" message={fieldErrors.targetDate} />
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
