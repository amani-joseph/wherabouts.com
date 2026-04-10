import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";

/** Use TanStack `Link` for app routes; plain anchor or inert link for placeholders. */
export function sidebarNavRender(path: string | undefined): ReactElement {
	if (path?.startsWith("/")) {
		return <Link to={path} />;
	}
	return (
		// biome-ignore lint/a11y/useAnchorContent: SidebarMenuButton useRender merges icon and title as children.
		<a
			href={path ?? "#"}
			onClick={(event) => {
				if (!path || path === "#") {
					event.preventDefault();
				}
			}}
		/>
	);
}
