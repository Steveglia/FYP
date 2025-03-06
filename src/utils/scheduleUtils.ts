import type { Schema } from "../../amplify/data/resource";
import { generateClient } from 'aws-amplify/api';

type Event = Schema["CalendarEvent"]["type"];

const client = generateClient<Schema>();

export const generateWeekVector = async (
  events: Event[],
  currentWeekStart: Date,
  weekDays: string[],
  userId: string
) => {
  const studyPreferences = await client.models.StudyPreference.list({
    filter: { owner: { eq: userId } }
  });
  
  const studyPreference = studyPreferences.data[0];
  const weekVector: number[] = new Array(105).fill(1);
  
  // First, set base preferences
  if (studyPreference) {
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      for (let hour = 8; hour <= 22; hour++) {
        const vectorIndex = (dayIndex * 15) + (hour - 8);
        
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

  const weekEndDate = new Date(currentWeekStart);
  weekEndDate.setDate(currentWeekStart.getDate() + 7);

  // Helper function to get correct day index
  const getDayIndex = (date: Date): number => {
    const day = date.getDay(); // 0 (Sunday) to 6 (Saturday)
    // If weekDays starts with Monday, transform Sunday(0) -> 6, Monday(1) -> 0, etc.
    return day === 0 ? 6 : day - 1;
  };

  // Then, process events to mark unavailable times
  events.forEach(event => {
    if (event.startDate && event.endDate) {
      const startDate = new Date(event.startDate);
      const endDate = new Date(event.endDate);

      if (startDate >= currentWeekStart && startDate < weekEndDate) {
        const dayIndex = getDayIndex(startDate);  // Use helper function
        const startHour = startDate.getHours();
        const endHour = endDate.getHours();

        // Only mark the exact event duration as unavailable
        if (startHour >= 8 && startHour <= 22) {
          for (let hour = startHour; hour <= Math.min(endHour, 22); hour++) {
            if (hour >= 8 && hour <= 22) {
              const vectorIndex = (dayIndex * 15) + (hour - 8);
              weekVector[vectorIndex] = 0;
            }
          }
        }
      }
    }
  });

  // Finally, adjust work day preferences if needed
  if (studyPreference?.studyDuringWork === false) {
    events.forEach(event => {
      if (event.type === 'WORK' && event.startDate) {
        const eventDate = new Date(event.startDate);
        
        // Only process work events in the current week
        if (eventDate >= currentWeekStart && eventDate < weekEndDate) {
          const dayIndex = getDayIndex(eventDate);
          
          // Reduce preference on work days (but don't set to 0)
          for (let hour = 8; hour <= 22; hour++) {
            const vectorIndex = (dayIndex * 15) + (hour - 8);
            if (weekVector[vectorIndex] !== 0) { // Don't override already blocked times
              weekVector[vectorIndex] = Math.min(weekVector[vectorIndex], 3);
            }
          }
        }
      }
    });
  }

  // Log the vector
  console.log('Week Schedule Vector with Preferences:');
  weekDays.forEach((day, dayIndex) => {
    const dayVector = weekVector.slice(dayIndex * 15, (dayIndex + 1) * 15);
    console.log(`${day}:`, dayVector.join(' '));
  });

  return weekVector;
}; 
