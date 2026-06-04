import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@wherabouts.com/ui/components/button";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ActiveProjectSelector } from "@/components/active-project-selector";
import { ZoneCreateDialog } from "@/components/zones/zone-create-dialog";
import { ZoneList } from "@/components/zones/zone-list";
import { ZoneMap } from "@/components/zones/zone-map";
import type { UseZoneDraw } from "@/components/zones/use-zone-draw";
import { useActiveProject } from "@/lib/active-project";
import { orpcClient } from "@/lib/orpc";

export const Route = createFileRoute("/_protected/zones")({
	component: RouteComponent,
});

type ZoneListItem = Awaited<ReturnType<typeof orpcClient.zones.list>>["zones"][number];

function RouteComponent() {
	const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
	const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);
	const { activeId, select } = useActiveProject(projectIds);

	const [zones, setZones] = useState<ZoneListItem[]>([]);
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [controls, setControls] = useState<UseZoneDraw | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		orpcClient.projects
			.list()
			.then((rows) => setProjects(rows.map((r) => ({ id: r.id, name: r.name }))))
			.catch(() => toast.error("Failed to load projects."));
	}, []);

	const refreshZones = useCallback(async (projectId: string) => {
		try {
			const res = await orpcClient.zones.list({ projectId });
			setZones(res.zones);
		} catch {
			toast.error("Failed to load zones.");
		}
	}, []);

	useEffect(() => {
		if (activeId) {
			refreshZones(activeId);
		}
	}, [activeId, refreshZones]);

	const drawn = controls?.drawnPolygon ?? null;
	useEffect(() => {
		if (drawn) {
			setDialogOpen(true);
		}
	}, [drawn]);

	const handleSave = async (values: { name: string; description?: string }) => {
		if (!(activeId && drawn)) {
			return;
		}
		setSaving(true);
		try {
			await orpcClient.zones.create({
				projectId: activeId,
				name: values.name,
				description: values.description,
				geometry: drawn,
			});
			toast.success("Zone created.");
			setDialogOpen(false);
			controls?.clear();
			controls?.resetDrawn();
			await refreshZones(activeId);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to create zone.");
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (id: number) => {
		if (!activeId) {
			return;
		}
		try {
			await orpcClient.zones.delete({ projectId: activeId, id });
			toast.success("Zone deleted.");
			await refreshZones(activeId);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to delete zone.");
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<ActiveProjectSelector activeId={activeId} onSelect={select} projects={projects} />
				<Button disabled={!(activeId && controls)} onClick={() => controls?.startDrawing()}>
					Draw zone
				</Button>
			</div>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
				<ZoneMap onReady={(c) => setControls(c)} zones={zones} />
				<ZoneList onDelete={handleDelete} onSelect={setSelectedId} selectedId={selectedId} zones={zones} />
			</div>
			<ZoneCreateDialog
				onCancel={() => {
					setDialogOpen(false);
					controls?.clear();
					controls?.resetDrawn();
				}}
				onSubmit={handleSave}
				open={dialogOpen}
				saving={saving}
			/>
		</div>
	);
}
