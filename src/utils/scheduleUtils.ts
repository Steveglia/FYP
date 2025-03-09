// Remove the generateWeekVector function if it's no longer needed
// Keep any other utility functions that might be in this file

import { generateClient } from 'aws-amplify/api';
import type { Schema } from "../../amplify/data/resource";

const client = generateClient<Schema>();

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
