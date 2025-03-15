import { generateClient } from 'aws-amplify/api';
import type { Schema } from "../../../amplify/data/resource";
import { Event, EventType } from './types';
import { createTestStudySessions } from './utils';

const client = generateClient<Schema>();

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
        
        // Log the raw lecture data for debugging
        console.log('Raw lecture data:', JSON.stringify(lecture, null, 2));
        
        // Ensure we have valid start and end dates
        let startDate = lecture.start_date;
        let endDate = lecture.end_date;
        
        // If start_date or end_date are missing or invalid, skip this lecture
        if (!startDate || !endDate) {
          console.error('Invalid lecture data - missing start or end date:', lecture);
          continue;
        }
        
        console.log(`Lecture: ${lecture.title}, Start: ${startDate}, End: ${endDate}`);
        
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
        } else {
          console.log(`Removing duplicate lecture: ${event.title}`);
        }
      });
      
      console.log('Fetched lectures for current week:', uniqueLectures.length);
      console.log('Labs identified:', uniqueLectures.filter(event => event.isLab).length);
      console.log('Lectures identified:', uniqueLectures.filter(event => event.isLecture).length);
      
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
    console.log('Fetching events directly from database for week:', startDateStr, 'to', endDateStr);
    const eventsResult = await client.models.CalendarEvent.list({
      filter: {
        and: [
          { startDate: { ge: startDateStr } },
          { startDate: { lt: endDateStr } }
        ]
      }
    });
    
    // Fetch lectures directly from the database for the current week
    console.log('Fetching lectures directly from database for week:', startDateStr, 'to', endDateStr);
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
        
        // Log the raw lecture data for debugging
        console.log('Raw lecture data:', JSON.stringify(lecture, null, 2));
        
        // Ensure we have valid start and end dates
        let startDate = lecture.start_date;
        let endDate = lecture.end_date;
        
        // If start_date or end_date are missing or invalid, skip this lecture
        if (!startDate || !endDate) {
          console.error('Invalid lecture data - missing start or end date:', lecture);
          continue;
        }
        
        console.log(`Lecture: ${lecture.title}, Start: ${startDate}, End: ${endDate}`);
        
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
          
          console.log(`Processing event: ${event.title}`);
          console.log(`  Original start: ${event.startDate}`);
          console.log(`  Original end: ${event.endDate}`);
          console.log(`  Parsed start: ${startDate.toLocaleString()} (${startDate.toLocaleTimeString()})`);
          console.log(`  Parsed end: ${endDate.toLocaleString()} (${endDate.toLocaleTimeString()})`);
          
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
          
          const dayName = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][dayIndex];
          console.log(`  Day: ${dayName}, Hours: ${startHour}:00-${endHour + 1}:00`);
          
          // Mark time slots as unavailable
          for (let hour = startHour; hour <= Math.min(endHour, 22); hour++) {
            if (hour >= 8 && hour <= 22) {
              const vectorIndex = (dayIndex * 15) + (hour - 8);
              if (vectorIndex >= 0 && vectorIndex < availabilityVector.length) {
                availabilityVector[vectorIndex] = 0; // Mark as unavailable
                console.log(`    Marked unavailable: Slot ${vectorIndex}, Hour ${hour} (${hour}:00-${hour+1}:00)`);
              }
            }
          }
        } catch (error) {
          console.error('Error processing event:', event.title, error);
        }
      }
    });
    
    // Log the availability vector for debugging
    console.log('Availability vector by day:');
    for (let day = 0; day < 7; day++) {
      const dayVector = availabilityVector.slice(day * 15, (day + 1) * 15);
      const dayName = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][day];
      console.log(`${dayName}: ${dayVector.join(' ')}`);
      
      // Log the hour mapping for the first day to verify
      if (day === 0) {
        console.log('Hour mapping for Monday:');
        dayVector.forEach((value, index) => {
          const hour = index + 8;
          console.log(`  ${hour}:00-${hour+1}:00: ${value}`);
        });
      }
    }
    
    try {
      // Call generatePreferenceVector API
      const result = await client.queries.generatePreferenceVector({
        availabilityVector: JSON.stringify(availabilityVector),
        userId
      });
      
      console.log('Raw API response:', result);
      
      if (result.data) {
        try {
          // Log the raw data for debugging
          console.log('Raw data type:', typeof result.data);
          console.log('Raw data:', result.data);
          
          let studySessions;
          
          try {
            // Try to parse the data as JSON
            const parsedData = JSON.parse(result.data);
            console.log('Parsed data:', parsedData);
            
            if (parsedData && typeof parsedData === 'object') {
              // The data appears to be in parsedData.data as a string
              if (parsedData.data && typeof parsedData.data === 'string') {
                try {
                  // Parse the nested JSON string
                  studySessions = JSON.parse(parsedData.data);
                  console.log('Parsed nested data:', studySessions);
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
                
                console.log(`Study session: ${session.day} ${session.startTime}-${session.endTime}`);
                console.log(`  Local time: ${startDate.toLocaleTimeString()}-${endDate.toLocaleTimeString()}`);
                console.log(`  ISO string: ${startDateIso}-${endDateIso}`);
                
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
            
            console.log('Created study events:', studyEvents);
            
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
  console.log('Falling back to test study sessions');
  return createTestStudySessions(currentWeekStart);
}; 