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
	careNotes: string;
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
