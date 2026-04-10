import { Kbd, KbdGroup } from "@wherabouts.com/ui/components/kbd";
import { SidebarTrigger } from "@wherabouts.com/ui/components/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wherabouts.com/ui/components/tooltip";

export function CustomSidebarTrigger() {
	return (
		<Tooltip>
			<TooltipTrigger delay={1000} render={<SidebarTrigger />} />
			<TooltipContent className="px-2 py-1" side="right">
				Toggle Sidebar{" "}
				<KbdGroup>
					<Kbd>⌘</Kbd>
					<Kbd>b</Kbd>
				</KbdGroup>
			</TooltipContent>
		</Tooltip>
	);
}
