import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@wherabouts.com/ui/components/select";

export interface ProjectOption {
	id: string;
	name: string;
}

export interface ActiveProjectSelectorProps {
	projects: ProjectOption[];
	activeId: string | null;
	onSelect: (projectId: string) => void;
}

export function ActiveProjectSelector({
	projects,
	activeId,
	onSelect,
}: ActiveProjectSelectorProps) {
	if (projects.length === 0) {
		return <p className="text-muted-foreground text-sm">No projects yet.</p>;
	}
	return (
		<Select onValueChange={(value) => onSelect(value as string)} value={activeId ?? undefined}>
			<SelectTrigger className="w-56">
				<SelectValue placeholder="Select a project" />
			</SelectTrigger>
			<SelectContent>
				{projects.map((project) => (
					<SelectItem key={project.id} value={project.id}>
						{project.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
