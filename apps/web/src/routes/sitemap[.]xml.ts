import { createFileRoute } from "@tanstack/react-router";

/** Public indexable paths (omit auth-only and API routes). */
const PUBLIC_PATHS: readonly { path: string; priority: string }[] = [
	{ path: "/", priority: "1.0" },
	{ path: "/sign-in", priority: "0.5" },
	{ path: "/sign-up", priority: "0.5" },
];

function escapeXml(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: ({ request }) => {
				const origin = new URL(request.url).origin;
				const urlEntries = PUBLIC_PATHS.map(({ path, priority }) => {
					const loc = path === "/" ? `${origin}/` : `${origin}${path}`;
					return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
				}).join("\n");

				const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;

				return new Response(body, {
					headers: {
						"Content-Type": "application/xml; charset=utf-8",
						"Cache-Control": "public, max-age=3600",
					},
				});
			},
		},
	},
});
