# @wherabouts/react

React hooks for the [Wherabouts](https://wherabouts.com) location API, built on
[`@wherabouts/sdk`](https://www.npmjs.com/package/@wherabouts/sdk).

```bash
npm install @wherabouts/react @wherabouts/sdk
```

`react` (>=18) and `@wherabouts/sdk` are peer dependencies.

## Create (and memoize) the client

Every hook takes a `WheraboutsClient` as its first argument. **Create the client
once and keep a stable reference** — module scope, or `useMemo`. The hooks list
`client` in their effect dependencies, so passing a freshly-created client on
each render restarts the request (and debounce) every render.

```ts
import { createWheraboutsClient } from "@wherabouts/sdk";

// ✅ Module scope — created once for the app.
export const wherabouts = createWheraboutsClient({
  apiKey: import.meta.env.VITE_WHERABOUTS_KEY,
});
```

```tsx
// ✅ Or memoize inside a component / provider.
const client = useMemo(
  () => createWheraboutsClient({ apiKey }),
  [apiKey]
);

// ❌ Do NOT create it inline — new identity every render refires the hook.
// const client = createWheraboutsClient({ apiKey });
```

## `useAutocomplete`

Debounced (300ms), abortable address autocomplete with a `status` state machine.

```tsx
import { useAutocomplete } from "@wherabouts/react";
import { newSessionToken } from "@wherabouts/sdk";

function AddressSearch() {
  const { query, setQuery, results, status, rateLimited, reset } =
    useAutocomplete(wherabouts, {
      minLength: 2, // default; below this no request fires (API requires q>=2)
      country: "AU",
      // optional: proximity boosting
      lat: -33.865,
      lng: 151.209,
      // optional: group keystrokes into one billable search
      sessionToken: newSessionToken(),
      // optional: keep results visible while the next search loads
      keepPreviousData: true,
      // optional: cache repeated queries for 60s
      cache: { storage: sessionStorage, ttlMs: 60_000 },
    });

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      {status === "loading" && <Spinner />}
      {rateLimited && <p>Slow down — rate limited.</p>}
      <ul>
        {results.map((r) => (
          <li key={r.id}>{r.formattedAddress}</li>
        ))}
      </ul>
    </div>
  );
}
```

`status` is one of `idle | loading | success | empty | error`.

## `useCombobox`

Headless WAI-ARIA combobox helpers for accessible autocomplete dropdowns —
keyboard navigation (↑/↓/Home/End/Enter/Esc) and ARIA wiring. Bring your own
markup; pair it with `useAutocomplete`.

```tsx
import { useAutocomplete, useCombobox } from "@wherabouts/react";

function AddressCombobox() {
  const { query, setQuery, results } = useAutocomplete(wherabouts);
  const { getInputProps, getListboxProps, getItemProps, activeIndex } =
    useCombobox({
      id: "address",
      count: results.length,
      onSelect: (i) => setQuery(results[i].formattedAddress),
    });

  return (
    <>
      <input
        {...getInputProps()}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul {...getListboxProps()}>
        {results.map((r, i) => (
          <li
            key={r.id}
            {...getItemProps(i)}
            data-active={i === activeIndex}
          >
            {r.formattedAddress}
          </li>
        ))}
      </ul>
    </>
  );
}
```

## Routing hooks

`useDirections`, `useMatrix`, and `useIsochrone` fetch on param change and abort
the previous request. Pass `null` params to stay idle.

```tsx
import { useDirections } from "@wherabouts/react";

const { data, loading, error } = useDirections(wherabouts, {
  from: "-33.865,151.209",
  to: "-33.8,151.0",
  profile: "driving",
});
```

## Other hooks

- `useReverseGeocode(client, coords | null)`
- `useZoneContains(client, params | null)`

## License

UNLICENSED — © Wherabouts.
