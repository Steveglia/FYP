import { FormattedStudySession } from '../types';

/**
 * Format study sessions for output
 * 
 * @param weekdays Array of available weekdays
 * @param solution Solution array (binary vector representing study slots)
 * @param hoursPerDay Number of hours per day
 * @param courses Array of courses to assign to study sessions
 * @returns Array of formatted study sessions
 */
export function formatStudySessions(
  weekdays: string[],
  solution: number[],
  hoursPerDay: number,
  courses: string[]
): FormattedStudySession[] {
  const sessions: FormattedStudySession[] = [];
  
  for (let i = 0; i < solution.length; i++) {
    if (solution[i] === 1) {
      const dayIndex = Math.floor(i / hoursPerDay);
      const hour = i % hoursPerDay;
      
      if (dayIndex < weekdays.length) {
        // Map the hour (0-14) to a reasonable daytime hour (8am-10pm)
        const startHour = hour + 8;
        const endHour = startHour + 1; // Single hour sessions
        
        // Format with leading zeros
        const startTime = `${String(startHour).padStart(2, '0')}:00`;
        const endTime = `${String(endHour).padStart(2, '0')}:00`;
        
        // If no courses are available, use a default course name
        const courseIndex = sessions.length % Math.max(1, courses.length);
        const courseName = courses.length > 0 
          ? courses[courseIndex] 
          : 'General Study';
        
        sessions.push({
          day: weekdays[dayIndex],
          startTime,
          endTime,
          course: courseName
        });
      }
    }
  }
  
  return sessions;
} 