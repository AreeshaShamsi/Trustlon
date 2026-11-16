'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { cn, Combobox, focusRing, inputClass, TextField } from '@/design-system';
import { useI18n } from '@/lib/i18n/language-provider';
import { countryName, locationApi, type CountryInfo, type PincodeSuggestion } from '@/lib/location';
import { PINCODE_PATTERN } from '@/lib/validation';

/** Countries with their postal rules, loaded once. */
export function useCountries(): CountryInfo[] | null {
  const [countries, setCountries] = useState<CountryInfo[] | null>(null);
  useEffect(() => {
    let active = true;
    locationApi
      .countries()
      .then((items) => active && setCountries(items))
      .catch(() => active && setCountries([]));
    return () => {
      active = false;
    };
  }, []);
  return countries;
}

/** States or provinces of a country; empty when the country has none listed. */
export function useStates(country: string): string[] | null {
  const [states, setStates] = useState<string[] | null>(null);
  useEffect(() => {
    let active = true;
    setStates(null);
    locationApi
      .states(country)
      .then((items) => active && setStates(items))
      .catch(() => active && setStates([]));
    return () => {
      active = false;
    };
  }, [country]);
  return states;
}

function SelectField({
  label,
  value,
  onChange,
  error,
  children,
  disabled,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  children: React.ReactNode;
  disabled?: boolean;
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-navy">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(inputClass(Boolean(error)), focusRing)}
      >
        {children}
      </select>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/** Country picker with names in the visitor's language. India is listed first. */
export function CountrySelect({
  value,
  onChange,
  countries,
  label = 'Country',
  error,
}: {
  value: string;
  onChange: (code: string) => void;
  countries: CountryInfo[] | null;
  label?: string;
  error?: string;
}) {
  const { language } = useI18n();
  const sorted = useMemo(() => {
    const named = (countries ?? []).map((c) => ({
      ...c,
      label: countryName(c.code, language, c.name),
    }));
    named.sort((a, b) => a.label.localeCompare(b.label, language));
    const india = named.filter((c) => c.code === 'IN');
    return [...india, ...named.filter((c) => c.code !== 'IN')];
  }, [countries, language]);
  return (
    <SelectField
      label={label}
      value={value}
      onChange={onChange}
      error={error}
      autoComplete="country"
    >
      {!countries && <option value={value}>{value}</option>}
      {sorted.map((country) => (
        <option key={country.code} value={country.code}>
          {country.label}
        </option>
      ))}
    </SelectField>
  );
}

/** State list for the country, or a text field when the country has no list. */
export function StateField({
  country,
  value,
  onChange,
  label = 'State',
  optional = false,
  error,
}: {
  country: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  optional?: boolean;
  error?: string;
}) {
  const states = useStates(country);
  if (states && states.length === 0) {
    return (
      <TextField
        label={optional ? `${label} (optional)` : label}
        autoComplete="address-level1"
        maxLength={60}
        value={value}
        error={error}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  const inList = !value || !states || states.includes(value);
  return (
    <SelectField
      label={optional ? `${label} (optional)` : label}
      value={inList ? value : ''}
      onChange={onChange}
      error={error}
      disabled={!states}
      autoComplete="address-level1"
    >
      <option value="">{states ? 'Choose' : 'Loading…'}</option>
      {states?.map((state) => (
        <option key={state} value={state}>
          {state}
        </option>
      ))}
    </SelectField>
  );
}

/** City or town with suggestions for the country. Free text is always allowed. */
export function CityField({
  country,
  value,
  onChange,
  label = 'City',
  error,
}: {
  country: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
}) {
  return (
    <Combobox<string>
      label={label}
      autoComplete="address-level2"
      maxLength={80}
      value={value}
      error={error}
      onChange={onChange}
      onPick={(option) => onChange(option.value)}
      loadOptions={async (text, signal) =>
        (await locationApi.cities(country, text, signal)).map((city) => ({
          key: city,
          label: city,
          value: city,
        }))
      }
    />
  );
}

/**
 * Indian pincode with suggestions. Typing 2+ digits lists matching pincodes; typing a place
 * name ("kora") finds its pincode. Picking one, or completing six digits, fills city and state.
 */
export function PincodeField({
  value,
  onChange,
  onResolved,
  label = 'Pincode',
  error,
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  onResolved: (place: PincodeSuggestion | null) => void;
  label?: string;
  error?: string;
  hint?: React.ReactNode;
}) {
  useEffect(() => {
    if (!PINCODE_PATTERN.test(value)) return;
    const controller = new AbortController();
    locationApi
      .pincode(value, controller.signal)
      .then(onResolved)
      .catch(() => !controller.signal.aborted && onResolved(null));
    return () => controller.abort();
    // onResolved is a fresh callback each render; the lookup only depends on the pincode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Combobox<PincodeSuggestion>
      label={label}
      inputMode="search"
      autoComplete="postal-code"
      maxLength={40}
      placeholder="e.g. 560034 or Koramangala"
      value={value}
      error={error}
      hint={hint}
      emptyText="No matching pincode"
      onChange={(text) =>
        onChange(/^\d+$/.test(text.trim()) ? text.replace(/\D/g, '').slice(0, 6) : text)
      }
      onPick={(option) => {
        onChange(option.value.pincode);
        onResolved(option.value);
      }}
      loadOptions={async (text, signal) =>
        (await locationApi.searchPincodes(text, signal)).map((place) => ({
          key: place.pincode,
          label: `${place.pincode}${place.area ? ` · ${place.area}` : ''}`,
          detail: `${place.city}, ${place.state}`,
          value: place,
        }))
      }
    />
  );
}
