import type { Schema } from "../../amplify/data/resource";

type Event = Schema["CalendarEvent"]["type"];

export const generateWeekVector = (
  events: Event[],
  currentWeekStart: Date,
  weekDays: string[]
) => {
  // Create a vector for the entire week (15 hours * 7 days = 105 slots)
  const weekVector: number[] = new Array(105).fill(0);
  
  // Calculate week end date
  const weekEndDate = new Date(currentWeekStart);
  weekEndDate.setDate(currentWeekStart.getDate() + 7);

  // Process each event
  events.forEach(event => {
    if (event.startDate && event.endDate) {
      const startDate = new Date(event.startDate);
      const endDate = new Date(event.endDate);

      // Only process events within the current week
      if (startDate >= currentWeekStart && startDate < weekEndDate) {
        const dayIndex = startDate.getDay() === 0 ? 6 : startDate.getDay() - 1;
        const startHour = startDate.getHours();
        const endHour = endDate.getHours();

        // Only consider hours between 8 AM and 10 PM
        if (startHour >= 8 && startHour <= 22) {
          // Mark occupied time slots with 1
          for (let hour = startHour; hour <= Math.min(endHour, 22); hour++) {
            if (hour >= 8 && hour <= 22) {
              const vectorIndex = (dayIndex * 15) + (hour - 8);
              weekVector[vectorIndex] = 1;
            }
          }
        }
      }
    }
  });

  // Log the vector in a more readable format
  console.log('Week Schedule Vector:');
  weekDays.forEach((day, dayIndex) => {
    const dayVector = weekVector.slice(dayIndex * 15, (dayIndex + 1) * 15);
    console.log(`${day}:`, dayVector.join(' '));
  });

  // Log the raw vector as well
  console.log('Raw vector:', weekVector);

  return weekVector;
}; 