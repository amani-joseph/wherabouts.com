"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
	Color,
	Fog,
	type Group,
	PerspectiveCamera,
	Scene,
	Vector3,
} from "three";
import ThreeGlobe from "three-globe";
import countries from "@/data/globe.json";

const RING_PROPAGATION_SPEED = 3;
const CAMERA_DISTANCE = 300;
const CAMERA_ASPECT = 1.2;

export interface GlobeArcDatum {
	arcAlt: number;
	color: string;
	endLat: number;
	endLng: number;
	order: number;
	startLat: number;
	startLng: number;
}

export interface GlobeConfig {
	ambientLight?: string;
	arcLength?: number;
	arcTime?: number;
	atmosphereAltitude?: number;
	atmosphereColor?: string;
	autoRotate?: boolean;
	autoRotateSpeed?: number;
	directionalLeftLight?: string;
	directionalTopLight?: string;
	emissive?: string;
	emissiveIntensity?: number;
	globeColor?: string;
	maxRings?: number;
	pointLight?: string;
	pointSize?: number;
	polygonColor?: string;
	rings?: number;
	shininess?: number;
	showAtmosphere?: boolean;
}

interface WorldProps {
	data: GlobeArcDatum[];
	globeConfig: GlobeConfig;
}

interface GlobeEndpoint {
	color: string;
	lat: number;
	lng: number;
	order: number;
	size: number;
}

const DEFAULT_GLOBE_CONFIG: Required<GlobeConfig> = {
	pointSize: 1,
	globeColor: "#0b1737",
	showAtmosphere: true,
	atmosphereColor: "#ffffff",
	atmosphereAltitude: 0.1,
	emissive: "#000000",
	emissiveIntensity: 0.1,
	shininess: 0.9,
	polygonColor: "rgba(255,255,255,0.7)",
	ambientLight: "#38bdf8",
	directionalLeftLight: "#ffffff",
	directionalTopLight: "#ffffff",
	pointLight: "#ffffff",
	arcTime: 2000,
	arcLength: 0.9,
	rings: 1,
	maxRings: 3,
	autoRotate: true,
	autoRotateSpeed: 1,
};

function WebGLRendererConfig() {
	const { gl, size } = useThree();

	useEffect(() => {
		gl.setPixelRatio(window.devicePixelRatio);
		gl.setSize(size.width, size.height);
		gl.setClearColor(0xff_aa_ff, 0);
	}, [gl, size]);

	return null;
}

function getUniqueEndpoints(
	data: GlobeArcDatum[],
	pointSize: number
): GlobeEndpoint[] {
	const points = data.flatMap((arc) => [
		{
			color: arc.color,
			lat: arc.startLat,
			lng: arc.startLng,
			order: arc.order,
			size: pointSize,
		},
		{
			color: arc.color,
			lat: arc.endLat,
			lng: arc.endLng,
			order: arc.order,
			size: pointSize,
		},
	]);

	return points.filter((point, index, allPoints) => {
		return (
			allPoints.findIndex((candidate) => {
				return candidate.lat === point.lat && candidate.lng === point.lng;
			}) === index
		);
	});
}

function getRandomIndices(min: number, max: number, count: number) {
	const values: number[] = [];

	while (values.length < count) {
		const next = Math.floor(Math.random() * (max - min)) + min;

		if (!values.includes(next)) {
			values.push(next);
		}
	}

	return values;
}

function GlobeMesh({ data, globeConfig }: WorldProps) {
	const groupRef = useRef<Group | null>(null);
	const globeRef = useRef<ThreeGlobe | null>(null);
	const mergedConfig = useMemo(
		() => ({ ...DEFAULT_GLOBE_CONFIG, ...globeConfig }),
		[globeConfig]
	);

	useEffect(() => {
		if (globeRef.current || !groupRef.current) {
			return;
		}

		const globe = new ThreeGlobe();
		groupRef.current.add(globe);
		globeRef.current = globe;

		return () => {
			groupRef.current?.remove(globe);
			globeRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (!globeRef.current) {
			return;
		}

		const material = globeRef.current.globeMaterial() as unknown as {
			color: Color;
			emissive: Color;
			emissiveIntensity: number;
			shininess: number;
		};

		material.color = new Color(mergedConfig.globeColor);
		material.emissive = new Color(mergedConfig.emissive);
		material.emissiveIntensity = mergedConfig.emissiveIntensity;
		material.shininess = mergedConfig.shininess;
	}, [mergedConfig]);

	useEffect(() => {
		if (!globeRef.current) {
			return;
		}

		const globe = globeRef.current;
		const endpointPoints = getUniqueEndpoints(data, mergedConfig.pointSize);

		globe
			.hexPolygonsData(countries.features)
			.hexPolygonResolution(3)
			.hexPolygonMargin(0.7)
			.showAtmosphere(mergedConfig.showAtmosphere)
			.atmosphereColor(mergedConfig.atmosphereColor)
			.atmosphereAltitude(mergedConfig.atmosphereAltitude)
			.hexPolygonColor(() => mergedConfig.polygonColor);

		globe
			.arcsData(data)
			.arcStartLat((datum: unknown) => (datum as GlobeArcDatum).startLat)
			.arcStartLng((datum: unknown) => (datum as GlobeArcDatum).startLng)
			.arcEndLat((datum: unknown) => (datum as GlobeArcDatum).endLat)
			.arcEndLng((datum: unknown) => (datum as GlobeArcDatum).endLng)
			.arcColor((datum: unknown) => (datum as GlobeArcDatum).color)
			.arcAltitude((datum: unknown) => (datum as GlobeArcDatum).arcAlt)
			.arcStroke(() => [0.32, 0.28, 0.3][Math.round(Math.random() * 2)] ?? 0.3)
			.arcDashLength(mergedConfig.arcLength)
			.arcDashInitialGap((datum: unknown) => (datum as GlobeArcDatum).order)
			.arcDashGap(15)
			.arcDashAnimateTime(() => mergedConfig.arcTime);

		globe
			.pointsData(endpointPoints)
			.pointColor((datum: unknown) => (datum as GlobeEndpoint).color)
			.pointsMerge(true)
			.pointAltitude(0)
			.pointRadius(2);

		globe
			.ringsData([])
			.ringColor(() => mergedConfig.polygonColor)
			.ringMaxRadius(mergedConfig.maxRings)
			.ringPropagationSpeed(RING_PROPAGATION_SPEED)
			.ringRepeatPeriod(
				(mergedConfig.arcTime * mergedConfig.arcLength) / mergedConfig.rings
			);
	}, [data, mergedConfig]);

	useEffect(() => {
		if (!globeRef.current || data.length === 0) {
			return;
		}

		const interval = window.setInterval(() => {
			if (!globeRef.current) {
				return;
			}

			const ringIndices = getRandomIndices(
				0,
				data.length,
				Math.max(1, Math.floor((data.length * 4) / 5))
			);
			const ringData = data
				.filter((_, index) => ringIndices.includes(index))
				.map((arc) => ({
					color: arc.color,
					lat: arc.startLat,
					lng: arc.startLng,
				}));

			globeRef.current.ringsData(ringData);
		}, 2000);

		return () => {
			window.clearInterval(interval);
		};
	}, [data]);

	return <group ref={groupRef} />;
}

export function World({ data, globeConfig }: WorldProps) {
	const mergedConfig = useMemo(
		() => ({ ...DEFAULT_GLOBE_CONFIG, ...globeConfig }),
		[globeConfig]
	);
	const scene = useMemo(() => {
		const globeScene = new Scene();
		globeScene.fog = new Fog(0xff_ff_ff, 400, 2000);
		return globeScene;
	}, []);

	return (
		<Canvas
			camera={new PerspectiveCamera(50, CAMERA_ASPECT, 180, 1800)}
			scene={scene}
		>
			<WebGLRendererConfig />
			<ambientLight color={mergedConfig.ambientLight} intensity={0.6} />
			<directionalLight
				color={mergedConfig.directionalLeftLight}
				position={new Vector3(-400, 100, 400)}
			/>
			<directionalLight
				color={mergedConfig.directionalTopLight}
				position={new Vector3(-200, 500, 200)}
			/>
			<pointLight
				color={mergedConfig.pointLight}
				intensity={0.8}
				position={new Vector3(-200, 500, 200)}
			/>
			<GlobeMesh data={data} globeConfig={mergedConfig} />
			<OrbitControls
				autoRotate={mergedConfig.autoRotate}
				autoRotateSpeed={mergedConfig.autoRotateSpeed}
				enablePan={false}
				enableZoom={false}
				maxDistance={CAMERA_DISTANCE}
				maxPolarAngle={Math.PI - Math.PI / 3}
				minDistance={CAMERA_DISTANCE}
				minPolarAngle={Math.PI / 3.5}
			/>
		</Canvas>
	);
}
