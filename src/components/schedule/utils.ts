import { Event, ScheduleEvent, eventTypeColors, ensureValidEventType } from './types';

// Function to calculate event height based on start and end dates
export const calculateEventHeight = (event: ScheduleEvent): string => {
  if (event.startDate && event.endDate) {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    
    // Calculate duration in hours
    const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    
    // Return height based on duration (46px per hour)
    return `${Math.max(durationHours, 0.5) * 46}px`;
  }
  
  // Default height for events without proper dates
  return '46px';
};

// Function to determine event color based on event data
export const getEventColor = (event: ScheduleEvent): string => {
  // Check if it's an accepted study session
  if (event.isAcceptedStudySession) {
    return '#4caf50'; // Green color for accepted study sessions
  }
  
  // Check if it's a lab by looking at the isLab property or other indicators
  if (event.isLab || 
      event.id?.includes('lab-') || 
      (event.title && event.title.toLowerCase().includes('lab')) ||
      (event.description && event.description.toLowerCase().includes('lab for'))) {
    return eventTypeColors.LAB;
  }
  
  // Check if it's a lecture by looking at the isLecture property or other indicators
  if (event.isLecture || 
      event.id?.includes('lecture-') || 
      (event.description && event.description.includes('Lecture for'))) {
    return eventTypeColors.LECTURE;
  }
  
  // Otherwise use the regular type-based coloring with safe conversion
  const eventType = ensureValidEventType(event.type) as keyof typeof eventTypeColors;
  return eventTypeColors[eventType] || eventTypeColors.default;
};

// Helper function to get Monday of the current week or of a provided date
export const getMondayOfCurrentWeek = (date?: Date): Date => {
  // If no date is provided, use current date
  const targetDate = date ? new Date(date) : new Date();
  
  // Get the day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const day = targetDate.getDay();
  
  // Calculate days to subtract to get to Monday
  // If today is Sunday (0), we need to go back 6 days
  // If today is Monday (1), we need to go back 0 days
  // If today is Tuesday (2), we need to go back 1 day, etc.
  const daysToSubtract = day === 0 ? 6 : day - 1;
  
  // Create a new date representing Monday of the current week
  const mondayDate = new Date(targetDate);
  mondayDate.setDate(targetDate.getDate() - daysToSubtract);
  
  // Ensure it's set to the beginning of the day
  mondayDate.setHours(0, 0, 0, 0);
  
  return mondayDate;
};

// Helper function to create test study sessions with proper timezone handling
export const createTestStudySessions = (currentWeekStart: Date): Event[] => {
  const testStudySessions: Event[] = [];
  
  console.log('Creating test study sessions for week starting:', currentWeekStart.toLocaleDateString('en-GB'));
  
  // Create one study session for each weekday at different times
  for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
    // Create the date part without time
    const startDate = new Date(currentWeekStart);
    startDate.setDate(currentWeekStart.getDate() + dayIndex);
    
    // Reset hours to avoid time zone issues
    startDate.setHours(0, 0, 0, 0);
    
    // Format the date part as YYYY-MM-DD
    const dateStr = startDate.toISOString().split('T')[0];
    
    // Explicitly set the hour we want (10 + dayIndex) without time zone adjustments
    const hour = 10 + dayIndex;
    const startTimeStr = `${hour.toString().padStart(2, '0')}:00:00.000Z`;
    const endHour = hour + 2;
    const endTimeStr = `${endHour.toString().padStart(2, '0')}:00:00.000Z`;
    
    // Create ISO strings with the exact time we want
    const startDateIso = `${dateStr}T${startTimeStr}`;
    const endDateIso = `${dateStr}T${endTimeStr}`;
    
    const now = new Date().toISOString();
    
    // Create a unique ID with timestamp to avoid collisions
    const uniqueId = `study-test-${Date.now()}-${dayIndex}`;
    
    // Get day name for better description
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const dayName = dayNames[dayIndex];
    
    console.log(`Creating test session for ${dayName} from ${hour}:00 to ${endHour}:00`);
    
    testStudySessions.push({
      id: uniqueId,
      title: `Study Session`,
      description: `Test generated study session for ${dayName}`,
      type: 'STUDY',
      startDate: startDateIso,
      endDate: endDateIso,
      createdAt: now,
      updatedAt: now
    });
  }
  
  console.log('Created test study events as fallback:', testStudySessions.length);
  
  return testStudySessions;
}; 