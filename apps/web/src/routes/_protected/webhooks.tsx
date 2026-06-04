import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@wherabouts.com/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@wherabouts.com/ui/components/card";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ActiveProjectSelector } from "@/components/active-project-selector";
import {
	WebhookCreateDialog,
	type WebhookCreateValues,
	type WebhookZoneOption,
} from "@/components/webhooks/webhook-create-dialog";
import { WebhookList, type WebhookRow } from "@/components/webhooks/webhook-list";
import { WebhookSecretReveal } from "@/components/webhooks/webhook-secret-reveal";
import { useActiveProject } from "@/lib/active-project";
import { orpcClient } from "@/lib/orpc";

export const Route = createFileRoute("/_protected/webhooks")({ component: RouteComponent });

function RouteComponent() {
	const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
	const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);
	const { activeId, select } = useActiveProject(projectIds);

	const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
	const [zones, setZones] = useState<WebhookZoneOption[]>([]);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

	// Load projects once
	useEffect(() => {
		orpcClient.projects.list({}).then((res) => setProjects(res.projects)).catch(() => {
			toast.error("Failed to load projects.");
		});
	}, []);

	const refresh = useCallback(async (projectId: string) => {
		const [whRes, zRes] = await Promise.all([
			orpcClient.webhooks.list({ projectId }),
			orpcClient.zones.list({ projectId }),
		]);
		setWebhooks(
			whRes.webhooks.map((w) => ({
				...w,
				createdAt: typeof w.createdAt === "string" ? w.createdAt : new Date(w.createdAt).toISOString(),
			}))
		);
		setZones(zRes.zones.map((z) => ({ id: z.id, name: z.name })));
	}, []);

	useEffect(() => {
		if (activeId) {
			refresh(activeId).catch(() => {
				toast.error("Failed to load webhooks.");
			});
		} else {
			setWebhooks([]);
			setZones([]);
		}
	}, [activeId, refresh]);

	const handleCreate = async (values: WebhookCreateValues) => {
		if (!activeId) {
			return;
		}
		setSaving(true);
		try {
			const created = await orpcClient.webhooks.create({ projectId: activeId, ...values });
			setDialogOpen(false);
			setRevealedSecret(created.secret);
			await refresh(activeId);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to create webhook.");
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (id: number) => {
		if (!activeId) {
			return;
		}
		try {
			await orpcClient.webhooks.delete({ projectId: activeId, id });
			toast.success("Webhook deleted.");
			await refresh(activeId);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to delete webhook.");
		}
	};

	const handleReactivate = async (id: number) => {
		if (!activeId) {
			return;
		}
		try {
			await orpcClient.webhooks.reactivate({ projectId: activeId, id });
			toast.success("Webhook reactivated.");
			await refresh(activeId);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to reactivate.");
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<ActiveProjectSelector activeId={activeId} onSelect={select} projects={projects} />
				<Button disabled={!activeId} onClick={() => setDialogOpen(true)}>Create webhook</Button>
			</div>
			<Card>
				<CardHeader><CardTitle className="text-sm">Webhooks ({webhooks.length})</CardTitle></CardHeader>
				<CardContent>
					<WebhookList
						onDelete={handleDelete}
						onReactivate={handleReactivate}
						onViewDeliveries={() => toast.info("Delivery timeline lands in the next step.")}
						webhooks={webhooks}
					/>
				</CardContent>
			</Card>
			<WebhookCreateDialog
				onCancel={() => setDialogOpen(false)}
				onSubmit={handleCreate}
				open={dialogOpen}
				saving={saving}
				zones={zones}
			/>
			<WebhookSecretReveal onClose={() => setRevealedSecret(null)} secret={revealedSecret} />
		</div>
	);
}
