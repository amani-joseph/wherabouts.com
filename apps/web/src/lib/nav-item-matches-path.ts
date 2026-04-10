/** True when `path` is a real app route and the current URL matches it (exact or nested). */
export function navItemMatchesPath(pathname: string, path?: string): boolean {
	if (!path?.startsWith("/")) {
		return false;
	}
	return pathname === path || pathname.startsWith(`${path}/`);
}
