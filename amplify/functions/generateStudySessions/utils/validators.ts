import { StudySlot } from '../types';

/**
 * Verify that no unavailable slots have been selected for study sessions
 * 
 * @param solution Binary solution vector
 * @param weekVector Preference vector
 * @param hoursPerDay Number of hours per day
 * @param availableDays Array of available days
 * @returns Object containing validation results
 */
export function verifyStudySessions(
  solution: number[],
  weekVector: number[],
  hoursPerDay: number,
  availableDays: string[]
): {
  unavailableSlotSelected: boolean;
  unavailableSlots: StudySlot[];
} {
  let unavailableSlotSelected = false;
  const unavailableSlots: StudySlot[] = [];
  
  for (let i = 0; i < solution.length; i++) {
    if (solution[i] === 1 && weekVector[i] === 0) {
      const dayIndex = Math.floor(i / hoursPerDay);
      const hour = i % hoursPerDay;
      unavailableSlotSelected = true;
      
      unavailableSlots.push({
        day: availableDays[dayIndex],
        hour: hour + 8, // Convert to actual hour (8am-10pm)
        index: i
      });
    }
  }
  
  return {
    unavailableSlotSelected,
    unavailableSlots
  };
}

/**
 * Extract study slots from a solution vector
 * 
 * @param solution Binary solution vector
 * @param hoursPerDay Number of hours per day
 * @param availableDays Array of available days
 * @returns Array of study slots
 */
export function extractStudySlots(
  solution: number[],
  hoursPerDay: number,
  availableDays: string[]
): StudySlot[] {
  const studySlots: StudySlot[] = [];
  
  for (let i = 0; i < solution.length; i++) {
    if (solution[i] === 1) {
      const dayIndex = Math.floor(i / hoursPerDay);
      const hour = i % hoursPerDay;
      
      if (dayIndex < availableDays.length) {
        studySlots.push({
          day: availableDays[dayIndex],
          hour: hour + 8 // Convert to actual hour (8am-10pm)
        });
      }
    }
  }
  
  return studySlots;
} 