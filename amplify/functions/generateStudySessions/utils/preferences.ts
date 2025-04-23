/**
 * Determine which days have available slots based on preference vector
 * 
 * @param weekDays Array of all weekdays
 * @param weekVector Preference vector
 * @returns Array of available days
 */
export function getAvailableDays(
  weekDays: string[],
  weekVector: number[]
): string[] {
  const availableDays: string[] = [];
  
  // Check each day to see if it has available slots
  weekDays.forEach((day, dayIndex) => {
    const dayVector = weekVector.slice(dayIndex * 15, (dayIndex + 1) * 15);
    // If any slot in the day has a value > 0, consider the day available
    if (dayVector.some((value: number) => value > 0)) {
      availableDays.push(day);
    }
  });
  
  return availableDays;
}

/**
 * Create a default config for the DFO algorithm based on user preferences
 * 
 * @param availableDays Array of available days
 * @param totalStudyHours Total study hours
 * @param maxHoursPerDay Maximum hours per day
 * @returns Config object
 */
export function createConfig(
  availableDays: string[],
  totalStudyHours: number,
  maxHoursPerDay: number
) {
  return {
    NUM_DAYS: availableDays.length,
    HOURS_PER_DAY: 15, // 8am to 10pm (15 hours)
    TOTAL_HOURS: availableDays.length * 15,
    REQUIRED_STUDY_HOURS: totalStudyHours,
    MAX_DAILY_HOURS: maxHoursPerDay,
    POPULATION_SIZE: 50,
    GENERATIONS: 100,
    DELTA: 0.009
  };
} 