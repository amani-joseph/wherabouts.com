// Minimal ImportMeta.env typing for this package's own `tsc --noEmit` run.
// Consumers (apps/web) get the richer declaration from vite/client instead;
// this file is only in the program when tsc runs inside packages/env, so the
// two never merge.
interface ImportMeta {
	readonly env: Record<string, string | boolean | undefined>;
}
