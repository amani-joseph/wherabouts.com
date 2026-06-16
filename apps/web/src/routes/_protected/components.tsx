import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@wherabouts.com/ui/components/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@wherabouts.com/ui/components/tabs";
import { Badge } from "@wherabouts.com/ui/components/badge";
import { Button } from "@wherabouts.com/ui/components/button";
import { Input } from "@wherabouts.com/ui/components/input";
import {
	Form,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	useFormField,
} from "@wherabouts.com/ui/components/form";
import { Skeleton } from "@wherabouts.com/ui/components/skeleton";
import { AlertCircle, CheckCircle2, Loader2, MapPin } from "lucide-react";
import { createWheraboutsClient } from "@wherabouts/sdk";
import type { WheraboutsClient } from "@wherabouts/sdk";
import { env } from "@wherabouts.com/env/web";

export const Route = createFileRoute("/_protected/components")({
	component: RouteComponent,
});

// Validation schemas
const addressAutocompleteSchema = z.object({
	query: z.string().min(1, "Enter an address to search"),
});

const addressFormFieldSchema = z.object({
	address: z.string().min(1, "Address is required"),
});

const addressFieldGroupSchema = z.object({
	street: z.string().min(1, "Street is required"),
	suburb: z.string().min(1, "Suburb is required"),
	state: z.string().min(1, "State is required"),
	postcode: z.string().min(1, "Postcode is required"),
});

const forwardGeocodeSchema = z.object({
	address: z.string().min(1, "Enter an address to geocode"),
});

const reverseGeocodeSchema = z.object({
	lat: z.coerce.number().min(-90).max(90, "Latitude must be between -90 and 90"),
	lng: z.coerce
		.number()
		.min(-180)
		.max(180, "Longitude must be between -180 and 180"),
});

type AddressAutocompleteInput = z.infer<typeof addressAutocompleteSchema>;
type AddressFormFieldInput = z.infer<typeof addressFormFieldSchema>;
type AddressFieldGroupInput = z.infer<typeof addressFieldGroupSchema>;
type ForwardGeocodeInput = z.infer<typeof forwardGeocodeSchema>;
type ReverseGeocodeInput = z.infer<typeof reverseGeocodeSchema>;

// Demo client factory
const createDemoClient = (): WheraboutsClient => {
	const apiKey = env.VITE_DEMO_API_KEY || "demo-key-not-configured";
	return createWheraboutsClient({
		apiKey,
		baseUrl: "https://api.wherabouts.com/api/v1",
	});
};

interface ResultState<T> {
	data: T | null;
	isLoading: boolean;
	error: string | null;
}

function ResultCard<T>({
	title,
	result,
	isLoading,
	error,
	renderData,
}: {
	title: string;
	result: ResultState<T>;
	isLoading: boolean;
	error?: string | null;
	renderData: (data: T) => React.ReactNode;
}) {
	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-sm flex items-center gap-2">
						<Loader2 className="w-4 h-4 animate-spin" />
						Loading...
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-3/4" />
				</CardContent>
			</Card>
		);
	}

	if (error || result.error) {
		return (
			<Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
				<CardHeader>
					<CardTitle className="text-sm flex items-center gap-2 text-red-600 dark:text-red-400">
						<AlertCircle className="w-4 h-4" />
						Error
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-red-600 dark:text-red-400">{error || result.error}</p>
				</CardContent>
			</Card>
		);
	}

	if (!result.data) {
		return (
			<Card className="border-dashed">
				<CardContent className="pt-6 text-center text-sm text-muted-foreground">
					Results will appear here after submission
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20">
			<CardHeader>
				<CardTitle className="text-sm flex items-center gap-2 text-green-600 dark:text-green-400">
					<CheckCircle2 className="w-4 h-4" />
					{title}
				</CardTitle>
			</CardHeader>
			<CardContent>{renderData(result.data)}</CardContent>
		</Card>
	);
}

function ComponentDocumentation({
	name,
	description,
	features,
	props,
	usage,
}: {
	name: string;
	description: string;
	features: string[];
	props: string;
	usage: string;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg">{name}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div>
					<h4 className="font-semibold text-sm mb-2">Features</h4>
					<div className="flex flex-wrap gap-2">
						{features.map((feature) => (
							<Badge key={feature} variant="outline" className="text-xs">
								{feature}
							</Badge>
						))}
					</div>
				</div>

				<div>
					<h4 className="font-semibold text-sm mb-1">Props</h4>
					<pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
						<code>{props}</code>
					</pre>
				</div>

				<div>
					<h4 className="font-semibold text-sm mb-1">Usage</h4>
					<pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
						<code>{usage}</code>
					</pre>
				</div>

				<p className="text-xs text-muted-foreground">
					<strong>Package:</strong>{" "}
					<code className="bg-black/20 px-1 rounded">@wherabouts/react-ui</code>
				</p>
			</CardContent>
		</Card>
	);
}

function AddressAutocompleteDemo() {
	const form = useForm<AddressAutocompleteInput>({
		resolver: zodResolver(addressAutocompleteSchema),
		defaultValues: { query: "" },
	});

	const [result, setResult] = useState<ResultState<any>>({
		data: null,
		isLoading: false,
		error: null,
	});

	const client = useMemo(() => createDemoClient(), []);

	const fetchAddress = useCallback(
		async (query: string) => {
			if (!query.trim()) {
				setResult({ data: null, isLoading: false, error: null });
				return;
			}
			setResult({ data: null, isLoading: true, error: null });
			try {
				const response = await client.addresses.autocomplete({ q: query });
				setResult({
					data: response.results?.[0] || null,
					isLoading: false,
					error: response.count === 0 ? "No addresses found" : null,
				});
			} catch (err) {
				setResult({
					data: null,
					isLoading: false,
					error: err instanceof Error ? err.message : "Failed to fetch address",
				});
			}
		},
		[client]
	);

	const onSubmit = useCallback(
		async (data: AddressAutocompleteInput) => {
			await fetchAddress(data.query);
		},
		[fetchAddress]
	);

	const queryValue = form.watch("query");
	useEffect(() => {
		if (!queryValue || queryValue.length < 3) return;
		const timer = setTimeout(() => {
			fetchAddress(queryValue);
		}, 300);
		return () => clearTimeout(timer);
	}, [queryValue, fetchAddress]);

	return (
		<>
			<Card className="border-2 border-blue-200 dark:border-blue-900">
				<CardHeader className="bg-blue-50 dark:bg-blue-950/30">
					<CardTitle className="text-base">Live Demo</CardTitle>
					<CardDescription>Interactive component — queries live database</CardDescription>
				</CardHeader>
				<CardContent className="pt-6 space-y-4">
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
							<FormField
								control={form.control}
								name="query"
								render={({ field }) => {
									const { formItemId, formDescriptionId, error } = useFormField();
									return (
										<FormItem>
											<FormLabel>Address Search</FormLabel>
											<Input
												id={formItemId}
												placeholder="e.g., 34 Boxgrove Avenue, Belmore NSW"
												disabled={result.isLoading}
												aria-describedby={formDescriptionId}
												aria-invalid={!!error}
												{...field}
											/>
											<FormDescription>
												Type an Australian address to search
											</FormDescription>
											<FormMessage />
										</FormItem>
									);
								}}
							/>
							<Button type="submit" disabled={result.isLoading} className="w-full">
								{result.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								Search Address
							</Button>
						</form>
					</Form>
				</CardContent>
			</Card>

			<ResultCard
				title="Address Result"
				result={result}
				isLoading={result.isLoading}
				error={result.error}
				renderData={(data) => (
					<div className="space-y-2 text-sm">
						<div>
							<span className="font-semibold">Street:</span> {data.streetAddress}
						</div>
						<div>
							<span className="font-semibold">Suburb:</span> {data.suburb}
						</div>
						<div>
							<span className="font-semibold">State:</span> {data.state}
						</div>
						<div>
							<span className="font-semibold">Postcode:</span> {data.postcode}
						</div>
					</div>
				)}
			/>
		</>
	);
}

function AddressFormFieldDemo() {
	const form = useForm<AddressFormFieldInput>({
		resolver: zodResolver(addressFormFieldSchema),
		defaultValues: { address: "" },
	});

	const [result, setResult] = useState<ResultState<any>>({
		data: null,
		isLoading: false,
		error: null,
	});

	const client = useMemo(() => createDemoClient(), []);

	const fetchAddress = useCallback(
		async (address: string) => {
			if (!address.trim()) {
				setResult({ data: null, isLoading: false, error: null });
				return;
			}
			setResult({ data: null, isLoading: true, error: null });
			try {
				const response = await client.addresses.autocomplete({ q: address });
				setResult({
					data: response.results?.[0] || null,
					isLoading: false,
					error: response.count === 0 ? "No addresses found" : null,
				});
			} catch (err) {
				setResult({
					data: null,
					isLoading: false,
					error: err instanceof Error ? err.message : "Failed to fetch address",
				});
			}
		},
		[client]
	);

	const onSubmit = useCallback(
		async (data: AddressFormFieldInput) => {
			await fetchAddress(data.address);
		},
		[fetchAddress]
	);

	const addressValue = form.watch("address");
	useEffect(() => {
		if (!addressValue || addressValue.length < 3) return;
		const timer = setTimeout(() => {
			fetchAddress(addressValue);
		}, 300);
		return () => clearTimeout(timer);
	}, [addressValue, fetchAddress]);

	return (
		<>
			<Card className="border-2 border-blue-200 dark:border-blue-900">
				<CardHeader className="bg-blue-50 dark:bg-blue-950/30">
					<CardTitle className="text-base">Live Demo</CardTitle>
					<CardDescription>Interactive component — queries live database</CardDescription>
				</CardHeader>
				<CardContent className="pt-6 space-y-4">
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
							<FormField
								control={form.control}
								name="address"
								render={({ field }) => {
									const { formItemId, error } = useFormField();
									return (
										<FormItem>
											<FormLabel>Address</FormLabel>
											<Input
												id={formItemId}
												placeholder="Enter your address"
												disabled={result.isLoading}
												aria-invalid={!!error}
												{...field}
											/>
											<FormMessage />
										</FormItem>
									);
								}}
							/>
							<Button type="submit" disabled={result.isLoading} className="w-full">
								{result.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								Search
							</Button>
						</form>
					</Form>
				</CardContent>
			</Card>

			<ResultCard
				title="Selected Address"
				result={result}
				isLoading={result.isLoading}
				error={result.error}
				renderData={(data) => (
					<div className="space-y-2 text-sm">
						<div className="flex items-start gap-2">
							<MapPin className="w-4 h-4 mt-1 flex-shrink-0 text-green-600" />
							<div>
								<div className="font-semibold">{data.streetAddress}</div>
								<div className="text-muted-foreground">
									{data.suburb}, {data.state} {data.postcode}
								</div>
							</div>
						</div>
					</div>
				)}
			/>
		</>
	);
}

function AddressFieldGroupDemo() {
	const form = useForm<AddressFieldGroupInput>({
		resolver: zodResolver(addressFieldGroupSchema),
		defaultValues: {
			street: "",
			suburb: "",
			state: "",
			postcode: "",
		},
	});

	const [result, setResult] = useState<ResultState<any>>({
		data: null,
		isLoading: false,
		error: null,
	});

	const onSubmit = useCallback(async (data: AddressFieldGroupInput) => {
		setResult({ data, isLoading: false, error: null });
	}, []);

	return (
		<>
			<Card className="border-2 border-blue-200 dark:border-blue-900">
				<CardHeader className="bg-blue-50 dark:bg-blue-950/30">
					<CardTitle className="text-base">Live Demo</CardTitle>
					<CardDescription>Interactive component — queries live database</CardDescription>
				</CardHeader>
				<CardContent className="pt-6 space-y-4">
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
							<FormField
								control={form.control}
								name="street"
								render={({ field }) => {
									const { formItemId, error } = useFormField();
									return (
										<FormItem>
											<FormLabel>Street Address</FormLabel>
											<Input
												id={formItemId}
												placeholder="e.g., 34 Boxgrove Avenue"
												aria-invalid={!!error}
												{...field}
											/>
											<FormMessage />
										</FormItem>
									);
								}}
							/>
							<FormField
								control={form.control}
								name="suburb"
								render={({ field }) => {
									const { formItemId, error } = useFormField();
									return (
										<FormItem>
											<FormLabel>Suburb</FormLabel>
											<Input
												id={formItemId}
												placeholder="e.g., Belmore"
												aria-invalid={!!error}
												{...field}
											/>
											<FormMessage />
										</FormItem>
									);
								}}
							/>
							<div className="grid grid-cols-2 gap-4">
								<FormField
									control={form.control}
									name="state"
									render={({ field }) => {
										const { formItemId, error } = useFormField();
										return (
											<FormItem>
												<FormLabel>State</FormLabel>
												<Input
													id={formItemId}
													placeholder="e.g., NSW"
													aria-invalid={!!error}
													{...field}
												/>
												<FormMessage />
											</FormItem>
										);
									}}
								/>
								<FormField
									control={form.control}
									name="postcode"
									render={({ field }) => {
										const { formItemId, error } = useFormField();
										return (
											<FormItem>
												<FormLabel>Postcode</FormLabel>
												<Input
													id={formItemId}
													placeholder="e.g., 2192"
													aria-invalid={!!error}
													{...field}
												/>
												<FormMessage />
											</FormItem>
										);
									}}
								/>
							</div>
							<Button type="submit" className="w-full">
								Validate Address
							</Button>
						</form>
					</Form>
				</CardContent>
			</Card>

			<ResultCard
				title="Parsed Address"
				result={result}
				isLoading={result.isLoading}
				error={result.error}
				renderData={(data) => (
					<div className="grid grid-cols-2 gap-4 text-sm">
						<div>
							<div className="font-semibold text-xs text-muted-foreground">Street</div>
							<div>{data.street}</div>
						</div>
						<div>
							<div className="font-semibold text-xs text-muted-foreground">Suburb</div>
							<div>{data.suburb}</div>
						</div>
						<div>
							<div className="font-semibold text-xs text-muted-foreground">State</div>
							<div>{data.state}</div>
						</div>
						<div>
							<div className="font-semibold text-xs text-muted-foreground">Postcode</div>
							<div>{data.postcode}</div>
						</div>
					</div>
				)}
			/>
		</>
	);
}

function ForwardGeocodeDemo() {
	const form = useForm<ForwardGeocodeInput>({
		resolver: zodResolver(forwardGeocodeSchema),
		defaultValues: { address: "" },
	});

	const [result, setResult] = useState<ResultState<any>>({
		data: null,
		isLoading: false,
		error: null,
	});

	const client = useMemo(() => createDemoClient(), []);

	const fetchCoords = useCallback(
		async (address: string) => {
			if (!address.trim()) {
				setResult({ data: null, isLoading: false, error: null });
				return;
			}
			setResult({ data: null, isLoading: true, error: null });
			try {
				const response = await client.addresses.autocomplete({ q: address });
				const addr = response.results?.[0];
				if (addr) {
					const coords = {
						lat: addr.latitude || 0,
						lng: addr.longitude || 0,
					};
					setResult({
						data: coords,
						isLoading: false,
						error: null,
					});
				} else {
					setResult({
						data: null,
						isLoading: false,
						error: "No addresses found",
					});
				}
			} catch (err) {
				setResult({
					data: null,
					isLoading: false,
					error: err instanceof Error ? err.message : "Failed to geocode address",
				});
			}
		},
		[client]
	);

	const onSubmit = useCallback(
		async (data: ForwardGeocodeInput) => {
			await fetchCoords(data.address);
		},
		[fetchCoords]
	);

	const addressValue = form.watch("address");
	useEffect(() => {
		if (!addressValue || addressValue.length < 3) return;
		const timer = setTimeout(() => {
			fetchCoords(addressValue);
		}, 300);
		return () => clearTimeout(timer);
	}, [addressValue, fetchCoords]);

	return (
		<>
			<Card className="border-2 border-blue-200 dark:border-blue-900">
				<CardHeader className="bg-blue-50 dark:bg-blue-950/30">
					<CardTitle className="text-base">Live Demo</CardTitle>
					<CardDescription>Interactive component — queries live database</CardDescription>
				</CardHeader>
				<CardContent className="pt-6 space-y-4">
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
							<FormField
								control={form.control}
								name="address"
								render={({ field }) => {
									const { formItemId, formDescriptionId, error } = useFormField();
									return (
										<FormItem>
											<FormLabel>Address</FormLabel>
											<Input
												id={formItemId}
												placeholder="Enter an address to geocode"
												disabled={result.isLoading}
												aria-describedby={formDescriptionId}
												aria-invalid={!!error}
												{...field}
											/>
											<FormDescription>
												Get latitude and longitude coordinates
											</FormDescription>
											<FormMessage />
										</FormItem>
									);
								}}
							/>
							<Button type="submit" disabled={result.isLoading} className="w-full">
								{result.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								Geocode
							</Button>
						</form>
					</Form>
				</CardContent>
			</Card>

			<ResultCard
				title="Coordinates"
				result={result}
				isLoading={result.isLoading}
				error={result.error}
				renderData={(data) => (
					<div className="space-y-2 text-sm">
						<div>
							<span className="font-semibold">Latitude:</span> {data.lat.toFixed(6)}
						</div>
						<div>
							<span className="font-semibold">Longitude:</span> {data.lng.toFixed(6)}
						</div>
						<div className="pt-2 text-xs text-muted-foreground">
							<code className="bg-muted px-2 py-1 rounded">
								[{data.lat.toFixed(6)}, {data.lng.toFixed(6)}]
							</code>
						</div>
					</div>
				)}
			/>
		</>
	);
}

function ReverseGeocodeDemo() {
	const form = useForm<ReverseGeocodeInput>({
		resolver: zodResolver(reverseGeocodeSchema),
		defaultValues: { lat: -33.9249, lng: 151.1753 },
	});

	const [result, setResult] = useState<ResultState<any>>({
		data: null,
		isLoading: false,
		error: null,
	});

	const client = useMemo(() => createDemoClient(), []);

	const fetchAddress = useCallback(
		async (lat: number, lng: number) => {
			setResult({ data: null, isLoading: true, error: null });
			try {
				const response = await client.addresses.reverse({
					lat,
					lng,
				});
				if (response.address) {
					setResult({
						data: response.address,
						isLoading: false,
						error: null,
					});
				} else {
					setResult({
						data: null,
						isLoading: false,
						error: "No address found at these coordinates",
					});
				}
			} catch (err) {
				setResult({
					data: null,
					isLoading: false,
					error: err instanceof Error ? err.message : "Failed to reverse geocode",
				});
			}
		},
		[client]
	);

	const onSubmit = useCallback(
		async (data: ReverseGeocodeInput) => {
			await fetchAddress(data.lat, data.lng);
		},
		[fetchAddress]
	);

	const latValue = form.watch("lat");
	const lngValue = form.watch("lng");
	useEffect(() => {
		if (typeof latValue !== "number" || typeof lngValue !== "number") return;
		const timer = setTimeout(() => {
			fetchAddress(latValue, lngValue);
		}, 300);
		return () => clearTimeout(timer);
	}, [latValue, lngValue, fetchAddress]);

	return (
		<>
			<Card className="border-2 border-blue-200 dark:border-blue-900">
				<CardHeader className="bg-blue-50 dark:bg-blue-950/30">
					<CardTitle className="text-base">Live Demo</CardTitle>
					<CardDescription>Interactive component — queries live database</CardDescription>
				</CardHeader>
				<CardContent className="pt-6 space-y-4">
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<FormField
									control={form.control}
									name="lat"
									render={({ field }) => {
										const { formItemId, error } = useFormField();
										return (
											<FormItem>
												<FormLabel>Latitude</FormLabel>
												<Input
													id={formItemId}
													type="number"
													step="0.0001"
													placeholder="-33.9249"
													disabled={result.isLoading}
													aria-invalid={!!error}
													{...field}
												/>
												<FormMessage />
											</FormItem>
										);
									}}
								/>
								<FormField
									control={form.control}
									name="lng"
									render={({ field }) => {
										const { formItemId, error } = useFormField();
										return (
											<FormItem>
												<FormLabel>Longitude</FormLabel>
												<Input
													id={formItemId}
													type="number"
													step="0.0001"
													placeholder="151.1753"
													disabled={result.isLoading}
													aria-invalid={!!error}
													{...field}
												/>
												<FormMessage />
											</FormItem>
										);
									}}
								/>
							</div>
							<Button type="submit" disabled={result.isLoading} className="w-full">
								{result.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								Reverse Geocode
							</Button>
						</form>
					</Form>
				</CardContent>
			</Card>

			<ResultCard
				title="Address Result"
				result={result}
				isLoading={result.isLoading}
				error={result.error}
				renderData={(data) => (
					<div className="space-y-2 text-sm">
						<div>
							<span className="font-semibold">Street:</span> {data.streetAddress}
						</div>
						<div>
							<span className="font-semibold">Suburb:</span> {data.suburb}
						</div>
						<div>
							<span className="font-semibold">State:</span> {data.state}
						</div>
						<div>
							<span className="font-semibold">Postcode:</span> {data.postcode}
						</div>
					</div>
				)}
			/>
		</>
	);
}

function RouteComponent() {
	const [activeTab, setActiveTab] = useState("react");

	return (
		<div className="flex flex-col gap-8 py-6">
			<div>
				<h1 className="font-semibold text-2xl tracking-tight">Component Library</h1>
				<p className="text-muted-foreground text-sm">
					Interactive components with live API demos and real-time validation
				</p>
			</div>

			<Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20">
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
						Live API Integration
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm">
					<p>
						These demos make <strong>real API calls</strong> to the Wherabouts API using a test
						publishable key. Each form submission is validated with Zod schemas and displays results
						in styled cards with loading and error states.
					</p>
					<div className="bg-white dark:bg-black/30 p-3 rounded border border-blue-100 dark:border-blue-900 mt-2">
						<p className="font-semibold mb-2 text-xs">Demo Features:</p>
						<ul className="text-xs space-y-1 ml-4 list-disc">
							<li>✓ Real API calls to Wherabouts service</li>
							<li>✓ Zod schema validation on client side</li>
							<li>✓ Loading states with spinners</li>
							<li>✓ Error handling with detailed messages</li>
							<li>✓ Result previews in styled cards</li>
							<li>✓ shadcn/ui Form components</li>
						</ul>
					</div>
				</CardContent>
			</Card>

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList>
					<TabsTrigger value="react">React UI (v0.1.0) — 5 Components</TabsTrigger>
					<TabsTrigger value="vue">Vue UI (Phase 2)</TabsTrigger>
				</TabsList>

				<TabsContent value="react" className="space-y-10 mt-6">
					<div className="space-y-8">
						<div className="grid lg:grid-cols-2 gap-6 items-start">
							<AddressAutocompleteDemo />
							<ComponentDocumentation
								name="AddressAutocomplete"
								description="Search and select addresses with autocomplete suggestions"
								features={["Geolocation", "Custom rendering", "i18n support", "Async validation"]}
								props={`{
  client: WheraboutsClient
  onSelect?: (address: AddressWithParsed) => void
  enableGeolocation?: boolean
  placeholder?: string
  debounceMs?: number
  sessionToken?: string
}`}
								usage={`import { AddressAutocomplete } from '@wherabouts/react-ui';
import { createWheraboutsClient } from '@wherabouts/sdk';

const client = createWheraboutsClient({
  apiKey: 'pk_...'
});

<AddressAutocomplete
  client={client}
  onSelect={(addr) => console.log(addr)}
/>`}
							/>
						</div>

						<div className="grid lg:grid-cols-2 gap-6 items-start">
							<AddressFormFieldDemo />
							<ComponentDocumentation
								name="AddressFormField"
								description="Wrapped autocomplete for form integration with labels"
								features={["Label support", "Error styling", "Required field", "Disabled state"]}
								props={`{
  client: WheraboutsClient
  onSelect?: (address: AddressWithParsed) => void
  placeholder?: string
  disabled?: boolean
}`}
								usage={`<AddressFormField
  client={client}
  placeholder="Enter your address"
  onSelect={handleAddressSelect}
/>`}
							/>
						</div>

						<div className="grid lg:grid-cols-2 gap-6 items-start">
							<AddressFieldGroupDemo />
							<ComponentDocumentation
								name="AddressFieldGroup"
								description="Multi-field form with parsed address components"
								features={["Parsed fields", "Autocomplete integration", "Customizable labels", "Controlled"]}
								props={`{
  client: WheraboutsClient
  value: { street, suburb, state, postcode }
  onChange: (value) => void
  disabled?: boolean
}`}
								usage={`const [value, setValue] = useState({
  street: '',
  suburb: '',
  state: '',
  postcode: ''
});

<AddressFieldGroup
  client={client}
  value={value}
  onChange={setValue}
/>`}
							/>
						</div>

						<div className="grid lg:grid-cols-2 gap-6 items-start">
							<ForwardGeocodeDemo />
							<ComponentDocumentation
								name="ForwardGeocodeInput"
								description="Search address to get coordinates (lat/lng)"
								features={["Address search", "Coordinate output", "Error handling", "Loading state"]}
								props={`{
  client: WheraboutsClient
  onSelect?: (coords: { lat, lng }) => void
  placeholder?: string
}`}
								usage={`<ForwardGeocodeInput
  client={client}
  onSelect={(coords) => setLocation(coords)}
/>`}
							/>
						</div>

						<div className="grid lg:grid-cols-2 gap-6 items-start">
							<ReverseGeocodeDemo />
							<ComponentDocumentation
								name="ReverseGeocodeInput"
								description="Search by coordinates to get address details"
								features={["Coordinate input", "Address lookup", "Error handling", "Loading state"]}
								props={`{
  client: WheraboutsClient
  onSelect?: (address: AddressWithParsed) => void
  placeholder?: string
}`}
								usage={`<ReverseGeocodeInput
  client={client}
  onSelect={(address) => setAddress(address)}
/>`}
							/>
						</div>
					</div>

					<Card className="bg-muted/50 mt-12">
						<CardHeader>
							<CardTitle className="text-base">Integration Guide</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3 text-sm">
							<div>
								<strong>1. Install</strong>
								<pre className="bg-black/20 p-2 rounded mt-1 text-xs overflow-x-auto">
									<code>pnpm add @wherabouts/react-ui @wherabouts/sdk</code>
								</pre>
							</div>
							<div>
								<strong>2. Import</strong>
								<pre className="bg-black/20 p-2 rounded mt-1 text-xs overflow-x-auto">
									<code>{`import { AddressAutocomplete } from '@wherabouts/react-ui';\nimport '@wherabouts/react-ui/styles.css';`}</code>
								</pre>
							</div>
							<div>
								<strong>3. Use with your API key</strong>
								<pre className="bg-black/20 p-2 rounded mt-1 text-xs overflow-x-auto">
									<code>{`const client = createWheraboutsClient({
  apiKey: 'pk_live_...'  // Get from dashboard
});

<AddressAutocomplete client={client} />`}</code>
								</pre>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="vue" className="space-y-6 mt-6">
					<Card>
						<CardHeader>
							<CardTitle>@wherabouts/vue-ui (Phase 2)</CardTitle>
							<CardDescription>Vue 3 composable-based component library</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div>
								<h4 className="font-semibold text-sm mb-2">Status: Scaffolded & Ready</h4>
								<div className="flex flex-wrap gap-2">
									<Badge variant="outline">Vue 3 SFC</Badge>
									<Badge variant="outline">Composition API</Badge>
									<Badge variant="outline">TailwindCSS</Badge>
									<Badge variant="outline">TypeScript</Badge>
								</div>
							</div>

							<div>
								<h4 className="font-semibold text-sm mb-2">Phase 2 Roadmap</h4>
								<ul className="space-y-1 text-sm">
									<li>✓ Vite lib mode configured (ESM + UMD, .vue SFC)</li>
									<li>✓ Shared utilities copied (parse-address, styles, types)</li>
									<li>🔄 Implement Vue composables</li>
									<li>🔄 Implement Vue components (5 total)</li>
									<li>🔄 Finalize exports and build</li>
								</ul>
							</div>

							<div className="bg-muted p-3 rounded">
								<p className="text-sm">
									<strong>Location:</strong>{" "}
									<code className="bg-black/20 px-1 rounded">packages/vue-ui/</code>
								</p>
								<p className="text-sm mt-2">
									Shares utilities and styling with React UI for consistency.
								</p>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			<Card className="bg-muted/50">
				<CardHeader>
					<CardTitle className="text-base">Quality & Metrics</CardTitle>
				</CardHeader>
				<CardContent className="grid grid-cols-2 gap-4 text-sm">
					<div>
						<div className="font-semibold">Bundle</div>
						<div className="text-muted-foreground">86 KB (ESM) • TypeScript • Sourcemaps</div>
					</div>
					<div>
						<div className="font-semibold">Accessibility</div>
						<div className="text-muted-foreground">WCAG 2.1 AA • Base UI • Keyboard nav</div>
					</div>
					<div>
						<div className="font-semibold">Styling</div>
						<div className="text-muted-foreground">Tailwind v4 • Dark mode • Responsive</div>
					</div>
					<div>
						<div className="font-semibold">Validation</div>
						<div className="text-muted-foreground">Zod schemas • React Hook Form • Error states</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
