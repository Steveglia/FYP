import { generateClient } from 'aws-amplify/api';
import type { Schema } from "../../../amplify/data/resource";
import { Event } from './types';
import { createTestStudySessions } from './utils';

const client = generateClient<Schema>();

// Save an accepted study session to the database
export const saveAcceptedStudySession = async (studySession: Event, userId: string, weekStartDate: Date): Promise<boolean> => {
  try {
    if (!studySession || !userId || !studySession.startDate || !studySession.endDate || !studySession.title) {
      console.error('Invalid study session or user ID');
      return false;
    }
    
    // Extract day name from the date
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const sessionDate = new Date(studySession.startDate);
    const day = dayNames[sessionDate.getDay()];
    
    // Format times
    const startTime = `${String(sessionDate.getHours()).padStart(2, '0')}:${String(sessionDate.getMinutes()).padStart(2, '0')}`;
    
    const endDate = new Date(studySession.endDate);
    const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
    
    // Use "Study Session" as the course
    const course = "Study Session";
    
    // Create the accepted study session record
    const result = await client.models.AcceptedStudySession.create({
      day,
      startTime,
      endTime,
      course,
      startDate: studySession.startDate,
      endDate: studySession.endDate,
      userId,
      weekStartDate: weekStartDate.toISOString(),
      title: "Study Session",
      description: studySession.description || '',
      type: 'STUDY'
    });
    
    console.log('Study session accepted and saved:', result);
    return true;
  } catch (error) {
    console.error('Error saving accepted study session:', error);
    return false;
  }
};

// Fetch accepted study sessions for a specific week and user
export const fetchAcceptedStudySessions = async (weekStartDate: Date, userId: string): Promise<Event[]> => {
  try {
    const weekStartStr = weekStartDate.toISOString();
    
    // Calculate week end date
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 7);
    
    // Query accepted study sessions for the current week and user
    const result = await client.models.AcceptedStudySession.list({
      filter: {
        and: [
          { weekStartDate: { eq: weekStartStr } },
          { userId: { eq: userId } }
        ]
      }
    });
    
    if (result.data && result.data.length > 0) {
      // Convert to Event format
      return result.data.map(session => ({
        id: session.id,
        title: session.title,
        description: session.description,
        type: 'STUDY',
        startDate: session.startDate,
        endDate: session.endDate,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching accepted study sessions:', error);
    return [];
  }
};

// Fetch events for the current week
export const fetchEvents = async (currentWeekStart: Date): Promise<Event[]> => {
  try {
    // Calculate week end date
    const weekEndDate = new Date(currentWeekStart);
    weekEndDate.setDate(currentWeekStart.getDate() + 7);
    
    // Format dates for query
    const startDateStr = currentWeekStart.toISOString();
    const endDateStr = weekEndDate.toISOString();
    
    // Query events for the current week
    const result = await client.models.CalendarEvent.list({
      filter: {
        and: [
          { startDate: { ge: startDateStr } },
          { startDate: { lt: endDateStr } }
          // userId is intentionally not used in the filter yet
        ]
      }
    });
    
    if (result.data) {
      // Don't filter by userId for now to ensure events are displayed
      // We can add this back once we confirm events are showing
      const events = result.data;
      
      return events;
    }
  } catch (error) {
    console.error('Error fetching events:', error);
  }
  
  return [];
};

// Fetch lectures for the current week
export const fetchLectures = async (currentWeekStart: Date): Promise<Event[]> => {
  try {
    // Calculate week end date
    const weekEndDate = new Date(currentWeekStart);
    weekEndDate.setDate(currentWeekStart.getDate() + 7);
    
    // Format dates for query
    const startDateStr = currentWeekStart.toISOString();
    const endDateStr = weekEndDate.toISOString();
    
    // Query lectures for the current week
    // This assumes there's a filter method available to filter by date range
    const result = await client.models.Lectures.list({
      filter: {
        and: [
          { start_date: { ge: startDateStr } },
          { start_date: { lt: endDateStr } }
        ]
      }
    });
    
    if (result.data) {
      // Process lectures into Event format
      let dbLectures: Event[] = [];
      
      // Process each lecture
      for (const lecture of result.data) {
        const now = new Date().toISOString();
        const isLab = lecture.title?.toLowerCase().includes('lab') || 
                     lecture.content?.toLowerCase().includes('lab') ||
                     lecture.summary?.toLowerCase().includes('lab');
        
        // Ensure we have valid start and end dates
        let startDate = lecture.start_date;
        let endDate = lecture.end_date;
        
        // If start_date or end_date are missing or invalid, skip this lecture
        if (!startDate || !endDate) {
          console.error('Invalid lecture data - missing start or end date:', lecture);
          continue;
        }
        
        // Create the event object
        const event: Event = {
          id: lecture.id || `${isLab ? 'lab' : 'lecture'}-${Date.now()}-${lecture.lectureId}`,
          title: `${lecture.courseId}: ${lecture.title || 'Untitled'}`,
          description: lecture.content || lecture.summary || `${isLab ? 'Lab' : 'Lecture'} for ${lecture.courseId}`,
          type: 'OTHER',
          startDate: startDate,
          endDate: endDate,
          location: lecture.location || 'Unknown',
          createdAt: now,
          updatedAt: now
        };
        
        // Add custom properties
        (event as any).isLecture = !isLab;
        (event as any).isLab = isLab;
        
        // Add to the array
        dbLectures.push(event);
      }
      
      // Remove duplicate lectures (same title, start and end time)
      const uniqueLectures: Event[] = [];
      const seen = new Set<string>();
      
      dbLectures.forEach(event => {
        // Ensure start and end times are different
        if (event.startDate === event.endDate && event.startDate) {
          const startDate = new Date(event.startDate);
          const endDate = new Date(startDate);
          endDate.setHours(startDate.getHours() + 1);
          event.endDate = endDate.toISOString();
        }
        
        // Create a unique key for this event
        const key = `${event.title}-${event.startDate}-${event.endDate}`;
        
        if (!seen.has(key)) {
          seen.add(key);
          uniqueLectures.push(event);
        }
      });
      
      return uniqueLectures;
    }
  } catch (error) {
    console.error('Error fetching lectures:', error);
  }
  
  return [];
};

// Generate study sessions based on availability
export const generateStudySessions = async (
  currentWeekStart: Date,
  currentEvents: Event[],
  currentLectures: Event[],
  userId: string
): Promise<Event[]> => {
  try {
    // Calculate week end date
    const weekEndDate = new Date(currentWeekStart);
    weekEndDate.setDate(currentWeekStart.getDate() + 7);
    
    // Format dates for query
    const startDateStr = currentWeekStart.toISOString();
    const endDateStr = weekEndDate.toISOString();
    
    // Fetch events directly from the database for the current week
    const eventsResult = await client.models.CalendarEvent.list({
      filter: {
        and: [
          { startDate: { ge: startDateStr } },
          { startDate: { lt: endDateStr } }
        ]
      }
    });
    
    // Fetch lectures directly from the database for the current week
    const lecturesResult = await client.models.Lectures.list({
      filter: {
        and: [
          { start_date: { ge: startDateStr } },
          { start_date: { lt: endDateStr } }
        ]
      }
    });
    
    // Process lectures into Event format
    let dbLectures: Event[] = [];
    
    if (lecturesResult.data) {
      // Process each lecture
      for (const lecture of lecturesResult.data) {
        const now = new Date().toISOString();
        const isLab = lecture.title?.toLowerCase().includes('lab') || 
                     lecture.content?.toLowerCase().includes('lab') ||
                     lecture.summary?.toLowerCase().includes('lab');
        
        // Ensure we have valid start and end dates
        let startDate = lecture.start_date;
        let endDate = lecture.end_date;
        
        // If start_date or end_date are missing or invalid, skip this lecture
        if (!startDate || !endDate) {
          console.error('Invalid lecture data - missing start or end date:', lecture);
          continue;
        }
        
        // Create the event object
        const event: Event = {
          id: lecture.id || `${isLab ? 'lab' : 'lecture'}-${Date.now()}-${lecture.lectureId}`,
          title: `${lecture.courseId}: ${lecture.title || 'Untitled'}`,
          description: lecture.content || lecture.summary || `${isLab ? 'Lab' : 'Lecture'} for ${lecture.courseId}`,
          type: 'OTHER',
          startDate: startDate,
          endDate: endDate,
          location: lecture.location || 'Unknown',
          createdAt: now,
          updatedAt: now
        };
        
        // Add custom properties
        (event as any).isLecture = !isLab;
        (event as any).isLab = isLab;
        
        // Add to the array
        dbLectures.push(event);
      }
    }
    
    // Combine events from database with lectures
    const dbEvents = eventsResult.data || [];
    const allEvents = [...dbEvents, ...dbLectures, ...currentEvents, ...currentLectures];
    
    console.log('Total events for availability calculation:', allEvents.length);
    
    // Create initial availability vector (all available)
    const availabilityVector = new Array(105).fill(1);
    
    // Log the vector in a readable format for each day
    const logVectorByDay = (vector: number[]) => {
      const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      weekDays.forEach((day, dayIndex) => {
        const dayVector = vector.slice(dayIndex * 15, (dayIndex + 1) * 15);
        console.log(`${day}:`, dayVector.join(' '));
      });
    };
    
    // Track which events affect which slots
    const slotModifications: Record<number, string[]> = {};
    
    // Mark unavailable times based on events and lectures from database
    allEvents.forEach((event) => {
      if (event.startDate && event.endDate) {
        try {
          // Parse dates while preserving the original hour components
          // This solution avoids time zone adjustments that might shift hours
          const startDateRaw = event.startDate;
          const endDateRaw = event.endDate;
          
          // Use this approach to extract components without time zone adjustments
          const startParts = startDateRaw.split('T');
          const endParts = endDateRaw.split('T');
          
          if (startParts.length !== 2 || endParts.length !== 2) {
            console.error(`Event "${event.title}" has invalid ISO date format`);
            return; // Skip this event
          }
          
          // Extract date components (YYYY-MM-DD)
          const startDateStr = startParts[0];
          
          // Extract time components (HH:MM:SS.sssZ)
          const startTimeStr = startParts[1];
          const endTimeStr = endParts[1];
          
          // Extract hours without timezone adjustments
          const startHour = parseInt(startTimeStr.substring(0, 2), 10);
          const endHour = parseInt(endTimeStr.substring(0, 2), 10);
          
          // Create date objects for day-based comparisons (ignoring time)
          const eventDate = new Date(startDateStr);
          
          // Verify the event is within the current week
          const weekStart = new Date(currentWeekStart);
          weekStart.setHours(0, 0, 0, 0);
          
          const weekEnd = new Date(weekEndDate);
          weekEnd.setHours(0, 0, 0, 0);
          
          // Check if the event is in the current week (date-only comparison)
          const isAfterWeekStart = eventDate.getTime() >= weekStart.getTime();
          const isBeforeWeekEnd = eventDate.getTime() < weekEnd.getTime();
          
          // Only process events that are within the current week
          if (isAfterWeekStart && isBeforeWeekEnd) {
            // Get the day of week from date part only (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
            const startDayOfWeek = eventDate.getDay();
            // Convert to our index (0 = Monday, ..., 6 = Sunday)
            const dayIndex = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
            
            // Mark time slots as unavailable
            for (let hour = startHour; hour <= Math.min(endHour, 22); hour++) {
              if (hour >= 8 && hour <= 22) {
                const vectorIndex = (dayIndex * 15) + (hour - 8);
                if (vectorIndex >= 0 && vectorIndex < availabilityVector.length) {
                  if (availabilityVector[vectorIndex] === 1) {
                    availabilityVector[vectorIndex] = 0; // Mark as unavailable
                    
                    // Track which event affected this slot
                    if (!slotModifications[vectorIndex]) {
                      slotModifications[vectorIndex] = [];
                    }
                    slotModifications[vectorIndex].push(event.title || 'Untitled Event');
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('Error processing event:', event.title, error);
        }
      }
    });
    
    // Log final availability vector
    console.log('\n===== AVAILABILITY VECTOR =====');
    logVectorByDay(availabilityVector);
    
    try {
      // Call generatePreferenceVector API
      console.log('\nCalling generatePreferenceVector API...');
      const result = await client.queries.generatePreferenceVector({
        availabilityVector: JSON.stringify(availabilityVector),
        userId,
        mode: 'STUDY'
      });
      
      if (result.data) {
        try {
          let studySessions;
          
          try {
            // Try to parse the data as JSON
            const parsedData = JSON.parse(result.data);
            
            if (parsedData && typeof parsedData === 'object') {
              // The data appears to be in parsedData.data as a string
              if (parsedData.data && typeof parsedData.data === 'string') {
                try {
                  // Parse the nested JSON string
                  studySessions = JSON.parse(parsedData.data);
                } catch (nestedError) {
                  console.error('Error parsing nested data:', nestedError);
                  return createTestStudySessions(currentWeekStart);
                }
              } else if (Array.isArray(parsedData)) {
                studySessions = parsedData;
              } else {
                // If we can't find an array, create test sessions
                console.error('Could not find array in parsed data:', parsedData);
                return createTestStudySessions(currentWeekStart);
              }
            } else {
              studySessions = parsedData;
            }
          } catch (jsonError) {
            console.error('Error parsing JSON:', jsonError);
            // If it's not valid JSON, use the raw data
            studySessions = result.data;
          }
          
          // If we have study sessions and they're an array, process them
          if (Array.isArray(studySessions)) {
            // Convert the study sessions to Event objects
            const studyEvents: Event[] = studySessions.map((session, index) => {
              try {
                // Get the day of week
                const dayMap: {[key: string]: number} = {
                  'Monday': 0,
                  'Tuesday': 1,
                  'Wednesday': 2,
                  'Thursday': 3,
                  'Friday': 4,
                  'Saturday': 5,
                  'Sunday': 6
                };
                
                const dayIndex = dayMap[session.day];
                
                if (dayIndex === undefined) {
                  console.error('Invalid day in study session:', session);
                  return null;
                }
                
                // Parse the time strings
                const [startHour, startMinute] = (session.startTime ? session.startTime : '8:00').split(':').map(Number);
                const [endHour, endMinute] = (session.endTime ? session.endTime : '9:00').split(':').map(Number);
                
                // Create date objects for the current week
                const startDate = new Date(currentWeekStart);
                startDate.setDate(currentWeekStart.getDate() + dayIndex);
                
                // Create ISO strings that preserve the exact hours (ignoring timezone conversion)
                // First, create a date with the correct local time
                startDate.setHours(startHour || 8, startMinute || 0, 0, 0);
                
                // Get timezone offset in minutes and convert to milliseconds
                const tzOffset = startDate.getTimezoneOffset() * 60000;
                
                // Create a UTC date that will display as the desired local time when converted to ISO
                const utcStartDate = new Date(startDate.getTime() - tzOffset);
                
                // Set the end date
                const endDate = new Date(startDate);
                endDate.setHours(endHour || 9, endMinute || 0, 0, 0);
                
                // Create UTC date for end date
                const utcEndDate = new Date(endDate.getTime() - tzOffset);
                
                // Create ISO strings (with the Z for UTC)
                const startIso = utcStartDate.toISOString();
                const endIso = utcEndDate.toISOString();
                
                // Create a unique ID with timestamp to avoid collisions
                const uniqueId = `study-${Date.now()}-${index}`;
                
                const now = new Date().toISOString();
                
                return {
                  id: uniqueId,
                  title: `Study Session`,
                  description: `Generated study session for ${session.day}`,
                  type: 'STUDY',
                  startDate: startIso,
                  endDate: endIso,
                  createdAt: now,
                  updatedAt: now
                };
              } catch (sessionError) {
                console.error('Error creating study session:', sessionError);
                return null;
              }
            }).filter((event: any) => event !== null) as Event[]; // Force type assertion
            
            console.log('\n===== GENERATED STUDY SESSIONS =====');
            studyEvents.forEach((session, index) => {
              // Make sure we have valid dates before creating Date objects
              if (session.startDate && session.endDate) {
                console.log(`Session ${index + 1}:`, {
                  day: new Date(session.startDate).toLocaleDateString('en-GB', { weekday: 'long' }),
                  startTime: new Date(session.startDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                  endTime: new Date(session.endDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                });
              } else {
                console.log(`Session ${index + 1}: Invalid date format`);
              }
            });
            
            return studyEvents;
          } else {
            console.error('Invalid study sessions format:', studySessions);
            return createTestStudySessions(currentWeekStart);
          }
        } catch (error) {
          console.error('Error processing study sessions:', error);
          return createTestStudySessions(currentWeekStart);
        }
      } else {
        console.error('No data returned from generatePreferenceVector:', result);
        return createTestStudySessions(currentWeekStart);
      }
    } catch (error) {
      console.error('Error calling generatePreferenceVector:', error);
      return createTestStudySessions(currentWeekStart);
    }
  } catch (error) {
    console.error('Error in generateStudySessions:', error);
    return createTestStudySessions(currentWeekStart);
  }
};

// Delete all accepted study sessions for a specific week
export const deleteAcceptedStudySessions = async (weekStartDate: Date, userId: string): Promise<boolean> => {
  try {
    const weekStartStr = weekStartDate.toISOString();
    
    // Query accepted study sessions for the current week and user
    const result = await client.models.AcceptedStudySession.list({
      filter: {
        and: [
          { weekStartDate: { eq: weekStartStr } },
          { userId: { eq: userId } }
        ]
      }
    });
    
    if (result.data && result.data.length > 0) {
      console.log(`Found ${result.data.length} accepted study sessions to delete`);
      
      // Delete each session
      const deletePromises = result.data.map(session => 
        client.models.AcceptedStudySession.delete({
          id: session.id
        })
      );
      
      await Promise.all(deletePromises);
      console.log(`Successfully deleted ${result.data.length} accepted study sessions`);
      return true;
    } else {
      console.log('No accepted study sessions found to delete');
      return false;
    }
  } catch (error) {
    console.error('Error deleting accepted study sessions:', error);
    return false;
  }
};

// Generate personal learning time slots using branch and bound algorithm
export const generatePersonalLearningSlots = async (
  currentWeekStart: Date,
  currentEvents: Event[],
  currentLectures: Event[],
  userId: string
): Promise<Event[]> => {
  try {
    // Calculate week end date
    const weekEndDate = new Date(currentWeekStart);
    weekEndDate.setDate(currentWeekStart.getDate() + 7);
    
    // Format dates for query
    const startDateStr = currentWeekStart.toISOString();
    const endDateStr = weekEndDate.toISOString();
    
    // Fetch events directly from the database for the current week
    const eventsResult = await client.models.CalendarEvent.list({
      filter: {
        and: [
          { startDate: { ge: startDateStr } },
          { startDate: { lt: endDateStr } }
        ]
      }
    });
    
    // Fetch lectures directly from the database for the current week
    const lecturesResult = await client.models.Lectures.list({
      filter: {
        and: [
          { start_date: { ge: startDateStr } },
          { start_date: { lt: endDateStr } }
        ]
      }
    });
    
    // Process lectures into Event format
    let dbLectures: Event[] = [];
    
    if (lecturesResult.data) {
      // Process each lecture (similar to the generateStudySessions function)
      for (const lecture of lecturesResult.data) {
        const now = new Date().toISOString();
        const isLab = lecture.title?.toLowerCase().includes('lab') || 
                     lecture.content?.toLowerCase().includes('lab') ||
                     lecture.summary?.toLowerCase().includes('lab');
        
        // Ensure we have valid start and end dates
        let startDate = lecture.start_date;
        let endDate = lecture.end_date;
        
        // If start_date or end_date are missing or invalid, skip this lecture
        if (!startDate || !endDate) {
          console.error('Invalid lecture data - missing start or end date:', lecture);
          continue;
        }
        
        // Create the event object
        const event: Event = {
          id: lecture.id || `${isLab ? 'lab' : 'lecture'}-${Date.now()}-${lecture.lectureId}`,
          title: `${lecture.courseId}: ${lecture.title || 'Untitled'}`,
          description: lecture.content || lecture.summary || `${isLab ? 'Lab' : 'Lecture'} for ${lecture.courseId}`,
          type: 'OTHER',
          startDate: startDate,
          endDate: endDate,
          location: lecture.location || 'Unknown',
          createdAt: now,
          updatedAt: now
        };
        
        // Add custom properties
        (event as any).isLecture = !isLab;
        (event as any).isLab = isLab;
        
        // Add to the array
        dbLectures.push(event);
      }
    }
    
    // Combine events from database with lectures
    const dbEvents = eventsResult.data || [];
    const allEvents = [...dbEvents, ...dbLectures, ...currentEvents, ...currentLectures];
    
    console.log('Total events for availability calculation:', allEvents.length);
    
    // Create initial availability vector (all available)
    const availabilityVector = new Array(105).fill(1);
    
    // Log the vector in a readable format for each day
    const logVectorByDay = (vector: number[]) => {
      const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      weekDays.forEach((day, dayIndex) => {
        const dayVector = vector.slice(dayIndex * 15, (dayIndex + 1) * 15);
        console.log(`${day}:`, dayVector.join(' '));
      });
    };
    
    // Mark unavailable times based on events and lectures from database
    allEvents.forEach((event) => {
      if (event.startDate && event.endDate) {
        try {
          // Parse dates while preserving the original hour components
          const startDateRaw = event.startDate;
          const endDateRaw = event.endDate;
          
          // Extract components without time zone adjustments
          const startParts = startDateRaw.split('T');
          const endParts = endDateRaw.split('T');
          
          if (startParts.length !== 2 || endParts.length !== 2) {
            console.error(`Event "${event.title}" has invalid ISO date format`);
            return; // Skip this event
          }
          
          // Extract date components (YYYY-MM-DD)
          const startDateStr = startParts[0];
          
          // Extract time components (HH:MM:SS.sssZ)
          const startTimeStr = startParts[1];
          const endTimeStr = endParts[1];
          
          // Extract hours without timezone adjustments
          const startHour = parseInt(startTimeStr.substring(0, 2), 10);
          const endHour = parseInt(endTimeStr.substring(0, 2), 10);
          
          // Create date objects for day-based comparisons
          const eventDate = new Date(startDateStr);
          
          // Verify the event is within the current week
          const weekStart = new Date(currentWeekStart);
          weekStart.setHours(0, 0, 0, 0);
          
          const weekEnd = new Date(weekEndDate);
          weekEnd.setHours(0, 0, 0, 0);
          
          // Check if the event is in the current week
          const isAfterWeekStart = eventDate.getTime() >= weekStart.getTime();
          const isBeforeWeekEnd = eventDate.getTime() < weekEnd.getTime();
          
          // Only process events that are within the current week
          if (isAfterWeekStart && isBeforeWeekEnd) {
            // Get the day of week from date part only (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
            const startDayOfWeek = eventDate.getDay();
            // Convert to our index (0 = Monday, ..., 6 = Sunday)
            const dayIndex = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
            
            // Mark time slots as unavailable
            for (let hour = startHour; hour <= Math.min(endHour, 22); hour++) {
              if (hour >= 8 && hour <= 22) {
                const vectorIndex = (dayIndex * 15) + (hour - 8);
                if (vectorIndex >= 0 && vectorIndex < availabilityVector.length) {
                  availabilityVector[vectorIndex] = 0; // Mark as unavailable
                }
              }
            }
          }
        } catch (error) {
          console.error('Error processing event:', event.title, error);
        }
      }
    });
    
    // Log availability vector
    console.log('\n===== AVAILABILITY VECTOR FOR PERSONAL LEARNING =====');
    logVectorByDay(availabilityVector);
    
    try {
      // First, get the preference vector from user's availability
      console.log('\nCalling generatePreferenceVector API...');
      const preferenceVectorResult = await client.queries.generatePreferenceVector({
        availabilityVector: JSON.stringify(availabilityVector),
        userId,
        mode: 'LEARNING'
      });
      
      // Next, check for personal learning items to determine hours needed
      const personalLearningResult = await client.models.PersonalLearning.list({
        filter: { userId: { eq: userId } }
      });
      
      let weeklyLearningHours = 0;
      
      // Calculate total weekly hours from active personal learning items
      if (personalLearningResult.data && personalLearningResult.data.length > 0) {
        // Filter to only include active items
        const activeItems = personalLearningResult.data.filter(item => item.isActive !== false);
        weeklyLearningHours = activeItems.reduce((total, item) => total + item.weeklyDedicationHours, 0);
        
        console.log(`Found ${activeItems.length} active personal learning items out of ${personalLearningResult.data.length} total`);
        console.log(`Total weekly dedication: ${weeklyLearningHours} hours`);
      } else {
        // Default to 10 hours if no personal learning items found
        weeklyLearningHours = 10;
        console.log('No personal learning items found, using default of 10 hours per week');
      }
      
      if (weeklyLearningHours <= 0) {
        console.log('No hours to schedule for personal learning');
        return [];
      }
      
      // Now use the Branch and Bound algorithm to generate optimal time slots
      // We pass in the preference vector, and the algorithm returns time slots
      if (preferenceVectorResult.data) {
        console.log('\nCalling branchAndBound API with preference vector to get optimal time slots...');
        
        const branchAndBoundResult = await client.queries.branchAndBound({
          preferenceVector: preferenceVectorResult.data,
          requiredHours: weeklyLearningHours,
          maxDailyHours: 3, // Maximum 3 hours of personal learning per day
          preferTwoHourBlocks: true,
          penalizeSingleHourBlocks: true,
          penalizeLongBlocks: true
        });
        
        console.log('Branch and Bound result:', branchAndBoundResult);
        
        if (branchAndBoundResult.data) {
          try {
            // Print diagnostics
            console.log('Raw response type:', typeof branchAndBoundResult.data);
            
            // Parse the response if it's a string
            let parsedResponse: any;
            if (typeof branchAndBoundResult.data === 'string') {
              try {
                console.log('Response string first 100 chars:', branchAndBoundResult.data.substring(0, 100));
                parsedResponse = JSON.parse(branchAndBoundResult.data);
              } catch (error) {
                console.error('Error parsing JSON response:', error);
                throw new Error(`Failed to parse branchAndBound response: ${error}`);
              }
            } else {
              parsedResponse = branchAndBoundResult.data;
            }
            
            // Extract the timeSlots array from the response
            const timeSlots = parsedResponse?.timeSlots || [];
            
            console.log('Extracted timeSlots:', timeSlots);
            
            if (!timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) {
              console.log('No time slots returned from the algorithm');
              return [];
            }
            
            // Convert time slots to events
            const learningEvents = timeSlots.map((slot: any, index: number) => {
              // Skip invalid slots
              if (!slot || !slot.day || slot.hour === undefined) {
                return null;
              }
              
              try {
                // Get the day index
                const dayIndex = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(slot.day);
                if (dayIndex === -1) return null;
                
                // Create the date
                const slotDate = new Date(currentWeekStart);
                slotDate.setDate(currentWeekStart.getDate() + dayIndex);
                
                // Set times
                const startHour = parseInt(slot.hour);
                const endHour = startHour + 1;
                
                slotDate.setHours(startHour, 0, 0, 0);
                const startIso = slotDate.toISOString();
                
                slotDate.setHours(endHour, 0, 0, 0);
                const endIso = slotDate.toISOString();
                
                // Create event with a safe type
                return {
                  id: `learning-${Date.now()}-${index}`,
                  title: `Personal Learning`,
                  description: `Personal learning time slot`,
                  type: 'LEARNING',
                  startDate: startIso,
                  endDate: endIso,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
              } catch (err) {
                console.error('Error creating event from slot:', err);
                return null;
              }
            })
            .filter((event: any) => event !== null) as Event[];
            
            // Log the created events
            console.log(`Created ${learningEvents.length} learning events`);
            
            return learningEvents;
          } catch (error) {
            console.error('Error handling branch and bound response:', error);
            return [];
          }
        } else {
          console.error('No data in branchAndBound response');
          return [];
        }
      } else {
        console.error('No data returned from generatePreferenceVector API');
        return [];
      }
    } catch (error) {
      console.error('Error generating personal learning slots:', error);
      return [];
    }
  } catch (error) {
    console.error('Error in generatePersonalLearningSlots:', error);
    return [];
  }
};

// Helper function to convert time slots to events
function convertTimeSlotsToEvents(timeSlots: any[] | undefined, currentWeekStart: Date): Event[] {
  if (!timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) {
    return [];
  }
  
  // Type guard to ensure we only return valid Event objects
  const isEvent = (obj: any): obj is Event => {
    return obj && obj.startDate && obj.endDate && obj.title;
  };
  
  const learningEvents = timeSlots.map((slot: {day: string; hour: number}) => {
    try {
      // Convert the day name to day index (0 for Monday, 6 for Sunday)
      const dayIndex = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(slot.day);
      if (dayIndex === -1) {
        console.error('Invalid day name:', slot.day);
        return null;
      }
      
      // Create a date for the specific day and hour
      const eventDate = new Date(currentWeekStart);
      eventDate.setDate(currentWeekStart.getDate() + dayIndex);
      
      // Set the start time
      const startDate = new Date(eventDate);
      startDate.setHours(slot.hour, 0, 0, 0);
      
      // Set the end time (1 hour later)
      const endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + 1);
      
      // Generate a unique ID for this event
      const id = `learning-${dayIndex}-${slot.hour}-${Date.now()}`;
      
      return {
        id,
        title: `Personal Learning`,
        description: 'Allocated time for personal learning and studying',
        type: 'LEARNING',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error creating learning time slot:', error);
      return null;
    }
  }).filter(isEvent);
  
  console.log('\n===== GENERATED PERSONAL LEARNING SLOTS =====');
  // Make sure we only log valid events with startDate and endDate
  learningEvents.forEach((slot: any) => {
    if (slot) {
      console.log(`Slot:`, {
        day: slot.startDate ? new Date(slot.startDate).toLocaleDateString('en-GB', { weekday: 'long' }) : 'Unknown',
        startTime: slot.startDate ? new Date(slot.startDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'Unknown',
        endTime: slot.endDate ? new Date(slot.endDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'Unknown'
      });
    }
  });
  
  return learningEvents as Event[];
}

// Toggle the active status of a personal learning item
export const togglePersonalLearningStatus = async (personalLearningId: string): Promise<boolean> => {
  try {
    // First get the current item
    const result = await client.models.PersonalLearning.get({
      id: personalLearningId
    });
    
    if (!result.data) {
      console.error('Personal learning item not found:', personalLearningId);
      return false;
    }
    
    // Toggle the isActive status
    const currentStatus = result.data.isActive !== false; // Handle undefined (treat as active)
    const newStatus = !currentStatus;
    
    console.log(`Toggling personal learning item ${personalLearningId} from ${currentStatus ? 'active' : 'inactive'} to ${newStatus ? 'active' : 'inactive'}`);
    
    // Update the item with the new status
    const updateResult = await client.models.PersonalLearning.update({
      id: personalLearningId,
      isActive: newStatus
    });
    
    if (updateResult.data) {
      console.log('Successfully updated personal learning status:', updateResult.data);
      return true;
    } else {
      console.error('Failed to update personal learning status');
      return false;
    }
  } catch (error) {
    console.error('Error toggling personal learning status:', error);
    return false;
  }
};

// Get all personal learning items for a user
export const getPersonalLearningItems = async (userId: string): Promise<Schema['PersonalLearning']['type'][]> => {
  try {
    const result = await client.models.PersonalLearning.list({
      filter: { userId: { eq: userId } }
    });
    
    return result.data || [];
  } catch (error) {
    console.error('Error fetching personal learning items:', error);
    return [];
  }
}; 