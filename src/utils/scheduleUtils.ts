import { generateClient } from 'aws-amplify/api';
import type { Schema } from "../../amplify/data/resource";

const client = generateClient<Schema>();

/**
 * Generates a weekly preference vector based on availability and user preferences
 * @param availabilityVector An array of 0s and 1s representing availability (0 = busy, 1 = available)
 * @param userId The user ID to fetch preferences for
 * @returns A promise that resolves to the preference vector string
 */
export const generateWeekVector = async (availabilityVector: number[], userId: string): Promise<string> => {
  try {
    // Convert the availability vector to a string
    const vectorString = JSON.stringify(availabilityVector);
    
    // Call the API to generate the preference vector
    const result = await client.queries.generatePreferenceVector({
      availabilityVector: vectorString,
      userId: userId
    });
    
    return result.data || 'Error generating preference vector:';
  } catch (error) {
    console.error('Error generating preference vector:', error);
    return JSON.stringify(availabilityVector);
  }
}; 
