/**
 * @description Default data shapes.
 */

/**
 * acquiredDate and lastWatered are ISO format.
 * wateringFrequency is in days.
 */
export interface Plant {
	id: string;
	name: string;
	species: string;
	location: string;
	acquiredDate: string;
	wateringFrequency: number;
	lastWatered: string | null;
	notes: string;
	createdAt: string;
	updatedAt: string;
}

/**
 * wateredDate and createdAt are ISO format.
 */
export interface WateringHistory {
	id: string;
	plantId: string;
	wateredDate: string;
	notes: string | null;
	createdAt: string;
}

/**
 * logDate and createdAt are ISO format.
 */
export interface GrowthLog {
	id: string;
	plantId: string;
	logDate: string;
	measureType: "height" | "width" | "leafCount" | "other";
	measureUnit: "cm" | "inches" | "count" | "other";
	value: "number";
	notes: "string | null";
	createdAt: string;
}

/**
 * takenAt and createdAt are ISO format.
 */
export interface PlantImage {
	id: string;
	plantId: string;
	filename: string;
	caption: string | null;
	takenAt: string;
	createdAt: string;
}
