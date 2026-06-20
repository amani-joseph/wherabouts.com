import {
	BarChart3Icon,
	BookOpenIcon,
	BriefcaseIcon,
	CodeIcon,
	CreditCardIcon,
	HelpCircleIcon,
	KeyRoundIcon,
	LayersIcon,
	LayoutGridIcon,
	MapIcon,
	NavigationIcon,
	SettingsIcon,
	TerminalIcon,
	UsersIcon,
	WebhookIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export interface SidebarNavItem {
	icon?: ReactNode;
	isActive?: boolean;
	path?: string;
	subItems?: SidebarNavItem[];
	title: string;
}

export interface SidebarNavGroup {
	items: SidebarNavItem[];
	label?: string;
}

export const navGroups: SidebarNavGroup[] = [
	{
		label: "Product",
		items: [
			{
				title: "Dashboard",
				path: "/dashboard",
				icon: <LayoutGridIcon />,
			},
			{
				title: "Analytics",
				path: "/analytics",
				icon: <BarChart3Icon />,
			},
			{
				title: "Projects",
				path: "/projects",
				icon: <BriefcaseIcon />,
			},
		],
	},
	{
		label: "Workspace",
		items: [
			{
				title: "Team",
				path: "/team",
				icon: <UsersIcon />,
			},
			// Integrations is hidden for now — feature to be built out later.
			{
				title: "API Keys",
				path: "/api-keys",
				icon: <KeyRoundIcon />,
			},
			{
				title: "API Docs",
				path: "/api-docs",
				icon: <CodeIcon />,
			},
			{
				title: "SDK Playground",
				path: "/sdk-playground",
				icon: <TerminalIcon />,
			},
			{
				title: "Component Library",
				path: "/components",
				icon: <LayersIcon />,
			},
		],
	},
	{
		label: "Geocoding",
		items: [
			{ title: "Zones", path: "/zones", icon: <MapIcon /> },
			{ title: "Webhooks", path: "/webhooks", icon: <WebhookIcon /> },
			{ title: "Batch", path: "/batch", icon: <LayersIcon /> },
			{ title: "Devices", path: "/devices", icon: <NavigationIcon /> },
		],
	},
	{
		label: "Administration",
		items: [
			{
				title: "Settings",
				path: "/settings",
				icon: <SettingsIcon />,
			},
			{
				title: "Billing",
				path: "/billing",
				icon: <CreditCardIcon />,
			},
		],
	},
];

export const footerNavLinks: SidebarNavItem[] = [
	{
		title: "Help Center",
		path: "/help",
		icon: <HelpCircleIcon />,
	},
	{
		title: "Documentation",
		path: "/docs",
		icon: <BookOpenIcon />,
	},
];

export const navLinks: SidebarNavItem[] = [
	...navGroups.flatMap((group) =>
		group.items.flatMap((item) =>
			item.subItems?.length ? [item, ...item.subItems] : [item]
		)
	),
	...footerNavLinks,
];
