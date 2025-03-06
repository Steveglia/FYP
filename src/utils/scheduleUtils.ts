import type { Schema } from "../../amplify/data/resource";
import { generateClient } from 'aws-amplify/api';

const client = generateClient<Schema>();

export const generateWeekVector = async (
  availabilityVector: number[],
  userId: string
) => {
  // Define weekDays internally since it's always the same
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  const studyPreferences = await client.models.StudyPreference.list({
    filter: { owner: { eq: userId } }
  });
  
  const studyPreference = studyPreferences.data[0];
  const weekVector = [...availabilityVector]; // Create a copy of the availability vector
  
  // Apply preferences to available time slots
  if (studyPreference) {
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      for (let hour = 8; hour <= 22; hour++) {
        const vectorIndex = (dayIndex * 15) + (hour - 8);
        
        // Only modify available time slots (where value is 1)
        if (weekVector[vectorIndex] === 1) {
          if (studyPreference.preferredTimeOfDay === 'MORNING') {
            if (hour >= 8 && hour <= 12) {
              weekVector[vectorIndex] = 9;
            } else if (hour > 12 && hour <= 15) {
              weekVector[vectorIndex] = 6;
            } else if (hour > 15 && hour <= 18) {
              weekVector[vectorIndex] = 4;
            } else {
              weekVector[vectorIndex] = 2;
            }
          } else if (studyPreference.preferredTimeOfDay === 'EVENING') {
            if (hour >= 18 && hour <= 22) {
              weekVector[vectorIndex] = 9;
            } else if (hour >= 15 && hour < 18) {
              weekVector[vectorIndex] = 6;
            } else if (hour >= 12 && hour < 15) {
              weekVector[vectorIndex] = 4;
            } else {
              weekVector[vectorIndex] = 2;
            }
          }
        }
      }
    }
  }

  // Log the vector
  console.log('Week Schedule Vector with Preferences:');
  weekDays.forEach((day, dayIndex) => {
    const dayVector = weekVector.slice(dayIndex * 15, (dayIndex + 1) * 15);
    console.log(`${day}:`, dayVector.join(' '));
  });

  return weekVector;
}; 
