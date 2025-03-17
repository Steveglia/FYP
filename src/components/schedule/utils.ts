import { Event, ScheduleEvent, eventTypeColors } from './types';

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
  
  // Otherwise use the regular type-based coloring
  return eventTypeColors[event.type as keyof typeof eventTypeColors] || eventTypeColors.default;
};

// Helper function to get Monday of the week of September 23, 2024
export const getMondayOfCurrentWeek = (): Date => {
  // Create a date for September 23, 2024 (which is a Monday)
  // This is a fixed date for the academic year 2024-2025
  const targetDate = new Date(2024, 8, 23); // Month is 0-indexed, so 8 = September
  
  // Ensure it's set to the beginning of the day
  targetDate.setHours(0, 0, 0, 0);
  
  console.log('Returning fixed date for academic year:', targetDate.toLocaleDateString('en-GB'));
  
  return targetDate;
};

// Helper function to create test study sessions
export const createTestStudySessions = (currentWeekStart: Date): Event[] => {
  const testStudySessions: Event[] = [];
  
  console.log('Creating test study sessions for week starting:', currentWeekStart.toLocaleDateString('en-GB'));
  
  // Create one study session for each weekday at different times
  for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
    const startDate = new Date(currentWeekStart);
    startDate.setDate(currentWeekStart.getDate() + dayIndex);
    startDate.setHours(10 + dayIndex, 0, 0, 0); // Different hour each day
    
    const endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + 2, 0, 0, 0); // 2-hour sessions
    
    const now = new Date().toISOString();
    
    // Create a unique ID with timestamp to avoid collisions
    const uniqueId = `study-test-${Date.now()}-${dayIndex}`;
    
    // Get day name for better description
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const dayName = dayNames[dayIndex];
    
    testStudySessions.push({
      id: uniqueId,
      title: `Study Session: ${dayName}`,
      description: `Test generated study session for ${dayName}`,
      type: 'STUDY',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      createdAt: now,
      updatedAt: now
    } as Event); // Type assertion to match Event interface
  }
  
  console.log('Created test study events as fallback:', testStudySessions.length);
  
  return testStudySessions;
}; 