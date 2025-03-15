import { generateClient } from 'aws-amplify/api';
import type { Schema } from "../../../amplify/data/resource";
import { Event, EventType } from './types';
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
    
    // Extract course from title (format is "Study: Course Name")
    const title = studySession.title || '';
    const course = title.startsWith('Study: ') 
      ? title.substring(7) 
      : title;
    
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
      title: studySession.title,
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
export const fetchEvents = async (currentWeekStart: Date, userId: string): Promise<Event[]> => {
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
        ]
      }
    });
    
    if (result.data) {
      // Don't filter by userId for now to ensure events are displayed
      // We can add this back once we confirm events are showing
      const events = result.data;
      
      console.log('Fetched events for current week:', events);
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
  events: Event[],
  lectures: Event[],
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
    const allEvents = [...dbEvents, ...dbLectures];
    
    console.log('Total events fetched from database:', allEvents.length);
    
    // Create initial availability vector (all available)
    const availabilityVector = new Array(105).fill(1);
    
    // Mark unavailable times based on events and lectures from database
    allEvents.forEach(event => {
      if (event.startDate && event.endDate) {
        try {
          // Parse dates ignoring timezone (treat as local time)
          const startDateStr = event.startDate.replace('Z', '');
          const endDateStr = event.endDate.replace('Z', '');
          
          const startDate = new Date(startDateStr);
          const endDate = new Date(endDateStr);
          
          // Get the day of week for the start date (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
          const startDayOfWeek = startDate.getDay();
          // Convert to our index (0 = Monday, ..., 6 = Sunday)
          const dayIndex = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
          
          // Get start and end hours
          const startHour = startDate.getHours();
          let endHour = endDate.getHours();
          
          // If end time is exactly on the hour and not the same as start hour, adjust
          if (endDate.getMinutes() === 0 && startHour !== endHour) {
            endHour = Math.max(8, endHour - 1);
          }
          
          // Mark time slots as unavailable
          for (let hour = startHour; hour <= Math.min(endHour, 22); hour++) {
            if (hour >= 8 && hour <= 22) {
              const vectorIndex = (dayIndex * 15) + (hour - 8);
              if (vectorIndex >= 0 && vectorIndex < availabilityVector.length) {
                availabilityVector[vectorIndex] = 0; // Mark as unavailable
              }
            }
          }
        } catch (error) {
          console.error('Error processing event:', event.title, error);
        }
      }
    });
    
    try {
      // Call generatePreferenceVector API
      const result = await client.queries.generatePreferenceVector({
        availabilityVector: JSON.stringify(availabilityVector),
        userId
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
                const [startHour, startMinute] = (session.startTime || '8:00').split(':').map(Number);
                const [endHour, endMinute] = (session.endTime || '9:00').split(':').map(Number);
                
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
                const startDateIso = utcStartDate.toISOString();
                
                // Do the same for end date
                const endDate = new Date(currentWeekStart);
                endDate.setDate(currentWeekStart.getDate() + dayIndex);
                endDate.setHours(endHour || 9, endMinute || 0, 0, 0);
                const utcEndDate = new Date(endDate.getTime() - tzOffset);
                const endDateIso = utcEndDate.toISOString();
                
                const now = new Date().toISOString();
                
                return {
                  id: `study-${Date.now()}-${index}`,
                  title: `Study: ${session.course || 'General'}`,
                  description: `Study session for ${session.course || 'general topics'}`,
                  type: 'STUDY',
                  startDate: startDateIso,
                  endDate: endDateIso,
                  createdAt: now,
                  updatedAt: now
                };
              } catch (err) {
                console.error('Error processing study session:', err, session);
                return null;
              }
            }).filter(Boolean) as Event[];
            
            if (studyEvents.length > 0) {
              return studyEvents;
            }
          }
        } catch (error) {
          console.error('Error processing study sessions:', error);
        }
      }
    } catch (apiError) {
      console.error('API error generating study sessions:', apiError);
    }
  } catch (error) {
    console.error('Error generating study sessions:', error);
  }
  
  // Fallback to test study sessions
  return createTestStudySessions(currentWeekStart);
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