'use client';

import { forwardRef, useId } from 'react';
import { mobileDigits } from '@/lib/validation';
import { cn as cx } from '../../utils/cn';
import { Field } from '../Field';

export type MobileFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  aside?: React.ReactNode;
};

/**
 * Indian mobile number: a fixed +91 prefix and 10 digits. Spaces, dashes and a pasted +91 or
 * leading 0 are removed as the customer types.
 */
export const MobileField = forwardRef<HTMLInputElement, MobileFieldProps>(function MobileField(
  { label, error, hint, aside, id, className, onChange, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <Field id={inputId} label={label} error={error} hint={hint} aside={aside}>
      <div
        className={cx(
          'flex h-11 w-full rounded-lg border bg-white shadow-sm transition focus-within:ring-4',
          error
            ? 'border-red-600 focus-within:ring-red-600/15'
            : 'border-slate-300 hover:border-slate-400 focus-within:border-teal focus-within:ring-teal/15',
          props.disabled && 'opacity-60',
        )}
      >
        <span
          className="flex shrink-0 items-center gap-1.5 border-r border-slate-200 pl-3 pr-3 text-sm text-navy"
          aria-hidden
        >
          <span className="font-medium">IN</span>
          <span className="text-slate-500">+91</span>
        </span>
        <input
          ref={ref}
          id={inputId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cx(
            'h-full min-w-0 flex-1 rounded-r-lg bg-transparent px-3 text-sm tracking-wide text-navy outline-none placeholder:tracking-normal placeholder:text-slate-400',
            className,
          )}
          {...props}
          onChange={(event) => {
            const clean = mobileDigits(event.target.value);
            if (clean !== event.target.value) event.target.value = clean;
            onChange?.(event);
          }}
        />
      </div>
    </Field>
  );
});
