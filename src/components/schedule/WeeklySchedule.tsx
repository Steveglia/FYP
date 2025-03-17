import { useMemo, useState, useEffect } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Event, ScheduleEvent, weekDays, hours } from './types';
import { getMondayOfCurrentWeek } from './utils';
import { 
  fetchEvents, 
  fetchLectures, 
  generateStudySessions, 
  saveAcceptedStudySession,
  fetchAcceptedStudySessions,
  deleteAcceptedStudySessions,
  updateEventTimes
} from './scheduleService';
import ScheduleNavigation from './ScheduleNavigation';
import ScheduleGrid from './ScheduleGrid';
import ScheduleLegend from './ScheduleLegend';
import './WeeklySchedule.css';

interface WeeklyScheduleProps {
  events?: Event[];
  userId: string;
}

const WeeklySchedule: React.FC<WeeklyScheduleProps> = ({ events: initialEvents = [], userId }) => {
  const { user } = useAuthenticator();
  
  // Add state for current week - now starts from September 23, 2024
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const startDate = getMondayOfCurrentWeek();
    console.log('Initial week start date:', startDate.toLocaleDateString('en-GB'), 
                '(', startDate.toISOString(), ')');
    return startDate;
  });
  
  // Add state for events
  const [events, setEvents] = useState<Event[]>(initialEvents);
  
  // Add state for generated study sessions
  const [generatedStudySessions, setGeneratedStudySessions] = useState<Event[]>([]);
  
  // Add state for lectures
  const [lectures, setLectures] = useState<Event[]>([]);
  
  // Add state for loading (only used for study session generation now)
  const [isLoading, setIsLoading] = useState(false);
  
  // Add state to track the type of loading operation
  const [loadingType, setLoadingType] = useState<'generate' | 'accept' | 'regenerate' | null>(null);
  
  // Add state for error
  const [error, setError] = useState<string | null>(null);
  
  // Add state to track if there are accepted study sessions for the current week
  const [hasAcceptedSessions, setHasAcceptedSessions] = useState(false);
  
  // Add state to track accepted study sessions
  const [acceptedStudySessions, setAcceptedStudySessions] = useState<Event[]>([]);
  
  // Add state for toast notification
  const [toast, setToast] = useState<{ 
    message: string; 
    visible: boolean;
    showRefresh?: boolean;
  }>({
    message: '',
    visible: false,
    showRefresh: false
  });
  
  // Initialize with initial events
  useEffect(() => {
    console.log('Initial events received:', initialEvents.length);
    if (initialEvents.length > 0) {
      setEvents(initialEvents);
    }
  }, []);
  
  // Format date for display
  const formatWeekDate = (date: Date): string => {
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };
  
  // Fetch events and lectures when the current week changes
  useEffect(() => {
    const fetchData = async () => {
      // No loading indicator for week changes
      setError(null);
      
      try {
        console.log('Fetching data for week starting:', formatWeekDate(currentWeekStart));
        
        // Fetch events for the current week
        const currentUserId = user?.username || userId;
        console.log('Using user ID:', currentUserId);
        
        const fetchedEvents = await fetchEvents(currentWeekStart, currentUserId);
        console.log('Fetched events:', fetchedEvents.length);
        
        // Fetch accepted study sessions for the current week
        const acceptedStudySessions = await fetchAcceptedStudySessions(currentWeekStart, currentUserId);
        console.log('Fetched accepted study sessions:', acceptedStudySessions.length);
        
        // Update hasAcceptedSessions state
        setHasAcceptedSessions(acceptedStudySessions.length > 0);
        
        // Combine regular events with accepted study sessions
        const combinedEvents = [...fetchedEvents, ...acceptedStudySessions];
        
        if (combinedEvents.length > 0) {
          setEvents(combinedEvents);
        } else if (initialEvents.length > 0 && events.length === 0) {
          // If no events were fetched but we have initial events, use those
          console.log('Using initial events as fallback');
          setEvents(initialEvents);
        }
        
        // Fetch lectures for the current week
        const lectureEvents = await fetchLectures(currentWeekStart);
        console.log('Fetched lectures:', lectureEvents.length);
        setLectures(lectureEvents);
        
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load schedule data. Please try again later.');
      }
    };
    
    fetchData();
  }, [currentWeekStart, user, userId]);
  
  // Combine regular events with generated study sessions and lectures
  const allEvents = useMemo(() => {
    console.log('Combining events:');
    console.log('- Regular events:', events.length);
    console.log('- Generated study sessions:', generatedStudySessions.length);
    console.log('- Lectures:', lectures.length);
    
    const combined = [...events, ...generatedStudySessions, ...lectures];
    console.log('Total combined events:', combined.length);
    
    // Debug event details
    combined.forEach((event, index) => {
      console.log(`Event ${index + 1}:`, {
        id: event.id,
        title: event.title,
        type: event.type,
        startDate: event.startDate,
        endDate: event.endDate,
        isLecture: event.isLecture
      });
    });
    
    return combined;
  }, [events, generatedStudySessions, lectures]);

  // Process events into a schedule grid
  const eventsByDayAndTime = useMemo(() => {
    const schedule: { [key: string]: { [key: string]: ScheduleEvent[] } } = {};
    
    // Initialize schedule grid
    weekDays.forEach(day => {
      schedule[day] = {};
      hours.forEach(hour => {
        schedule[day][hour] = [];
      });
    });

    // Calculate week end date
    const weekEndDate = new Date(currentWeekStart);
    weekEndDate.setDate(currentWeekStart.getDate() + 7);

    console.log('Processing events for schedule:', allEvents.length);
    console.log('Week range:', formatWeekDate(currentWeekStart), 'to', formatWeekDate(weekEndDate));
    
    let eventsInRange = 0;
    let eventsOutsideHours = 0;
    
    allEvents.forEach(event => {
      if (event.startDate && event.endDate) {
        try {
          // Create new Date objects to avoid modifying the original event dates
          const startDate = new Date(event.startDate);
          const endDate = new Date(event.endDate);
          
          // Ensure dates are valid
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            console.error(`Event "${event.title}" has invalid date format:`, {
              startDate: event.startDate,
              endDate: event.endDate
            });
            return; // Skip this event
          }
          
          // Ensure end date is after start date
          if (endDate <= startDate) {
            console.error(`Event "${event.title}" has invalid time range (end <= start):`, {
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString()
            });
            // Fix the end date to be 1 hour after start date
            endDate.setTime(startDate.getTime() + 60 * 60 * 1000);
          }

          // Only process events within the current week
          // Use UTC methods to avoid timezone issues
          const startYear = startDate.getFullYear();
          const startMonth = startDate.getMonth();
          const startDay = startDate.getDate();
          
          const weekStartYear = currentWeekStart.getFullYear();
          const weekStartMonth = currentWeekStart.getMonth();
          const weekStartDay = currentWeekStart.getDate();
          
          const weekEndYear = weekEndDate.getFullYear();
          const weekEndMonth = weekEndDate.getMonth();
          const weekEndDay = weekEndDate.getDate();
          
          // Compare dates by components to avoid timezone issues
          const isAfterWeekStart = 
            (startYear > weekStartYear) || 
            (startYear === weekStartYear && startMonth > weekStartMonth) ||
            (startYear === weekStartYear && startMonth === weekStartMonth && startDay >= weekStartDay);
            
          const isBeforeWeekEnd = 
            (startYear < weekEndYear) || 
            (startYear === weekEndYear && startMonth < weekEndMonth) ||
            (startYear === weekEndYear && startMonth === weekEndMonth && startDay < weekEndDay);
          
          if (isAfterWeekStart && isBeforeWeekEnd) {
            eventsInRange++;
            
            // Get day of week (0 = Sunday, 1 = Monday, etc.)
            const dayOfWeek = startDate.getDay(); // Use local day, not UTC
            // Convert to our weekDays array index (0 = Monday, 6 = Sunday)
            const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const day = weekDays[dayIndex];
            
            // Get hours in local time (not UTC)
            const startHour = startDate.getHours();
            const endHour = endDate.getHours();
            
            console.log(`Event "${event.title}" on ${day} from ${startHour}:00 to ${endHour}:00`);
            
            // Check if the event is within our display hours (8am-10pm)
            if (startHour < 8 || startHour > 22) {
              console.log(`Event "${event.title}" outside display hours (${startHour}:00)`);
              eventsOutsideHours++;
              return; // Skip events outside our display hours
            }
            
            // Add the event to the schedule
            for (let hour = startHour; hour <= Math.min(endHour, 22); hour++) {
              if (hour >= 8 && schedule[day] && schedule[day][hour]) {
                // Check if this is an accepted study session
                const isAcceptedStudySession = 
                  event.type === 'STUDY' && 
                  !generatedStudySessions.some(s => s.id === event.id);
                
                const scheduleEvent: ScheduleEvent = {
                  ...event,
                  isStart: hour === startHour,
                  isAcceptedStudySession
                };
                schedule[day][hour].push(scheduleEvent);
              }
            }
          } else {
            console.log(`Event "${event.title}" outside current week range:`, {
              eventDate: `${startYear}-${startMonth+1}-${startDay}`,
              weekStart: `${weekStartYear}-${weekStartMonth+1}-${weekStartDay}`,
              weekEnd: `${weekEndYear}-${weekEndMonth+1}-${weekEndDay}`
            });
          }
        } catch (err) {
          console.error(`Error processing event "${event.title}":`, err);
        }
      } else {
        console.log(`Event "${event.title}" missing start or end date`);
      }
    });
    
    console.log(`${eventsInRange} events in current week range (${eventsOutsideHours} outside display hours)`);
    
    return schedule;
  }, [allEvents, currentWeekStart, generatedStudySessions]);

  // Add navigation functions
  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setDate(prevDate.getDate() + (direction === 'next' ? 7 : -7));
      console.log(`Navigating to ${direction} week:`, formatWeekDate(newDate));
      return newDate;
    });
  };

  // Handle generating study sessions
  const handleGenerateStudySessions = async () => {
    if (!user) {
      setError('You must be logged in to generate study sessions.');
      return;
    }
    
    setIsLoading(true);
    setLoadingType('generate');
    setError(null);
    
    try {
      console.log('Generating study sessions for user:', user.username);
      console.log('Current week start:', formatWeekDate(currentWeekStart));
      console.log('Events count:', events.length);
      console.log('Lectures count:', lectures.length);
      
      const studySessions = await generateStudySessions(
        currentWeekStart,
        events,
        lectures,
        user.username
      );
      
      console.log('Generated study sessions:', studySessions.length);
      
      if (studySessions.length === 0) {
        setError('No suitable study times found. Try adding more free time to your schedule.');
      } else {
        setGeneratedStudySessions(studySessions);
      }
    } catch (err) {
      console.error('Error generating study sessions:', err);
      setError('Failed to generate study sessions. Please try again later.');
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  // Delete accepted study sessions and regenerate
  const handleRegenerateStudySessions = async () => {
    if (!user) {
      setError('You must be logged in to regenerate study sessions.');
      return;
    }
    
    setIsLoading(true);
    setLoadingType('regenerate');
    setError(null);
    
    try {
      // First delete all accepted study sessions for the current week
      console.log('Deleting accepted study sessions for week starting:', formatWeekDate(currentWeekStart));
      await deleteAcceptedStudySessions(currentWeekStart, user.username);
      
      // Update the events list to remove the deleted sessions
      const fetchedEvents = await fetchEvents(currentWeekStart, user.username);
      setEvents(fetchedEvents);
      
      // Set hasAcceptedSessions to false since we've deleted them
      setHasAcceptedSessions(false);
      
      // Now generate new study sessions
      console.log('Regenerating study sessions for user:', user.username);
      
      const studySessions = await generateStudySessions(
        currentWeekStart,
        fetchedEvents, // Use the updated events list
        lectures,
        user.username
      );
      
      console.log('Regenerated study sessions:', studySessions.length);
      
      if (studySessions.length === 0) {
        setError('No suitable study times found. Try adding more free time to your schedule.');
      } else {
        setGeneratedStudySessions(studySessions);
      }
    } catch (err) {
      console.error('Error regenerating study sessions:', err);
      setError('Failed to regenerate study sessions. Please try again later.');
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  // Clear study sessions
  const clearStudySessions = () => {
    setGeneratedStudySessions([]);
  };

  // Create test events for debugging if needed
  const createTestEvents = () => {
    const testEvents: Event[] = [];
    
    // Create one event for each weekday
    for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
      const startDate = new Date(currentWeekStart);
      startDate.setDate(currentWeekStart.getDate() + dayIndex);
      startDate.setHours(9 + dayIndex, 0, 0, 0); // Different hour each day
      
      const endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + 1, 0, 0, 0); // 1-hour events
      
      const now = new Date().toISOString();
      
      // Create event names based on the day of the week
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const eventName = `${dayNames[dayIndex]} Event (${formatWeekDate(startDate)})`;
      
      testEvents.push({
        id: `test-event-${dayIndex}`,
        title: eventName,
        description: `Test event for ${dayNames[dayIndex]}, September ${23 + dayIndex}, 2024`,
        type: 'MEETING',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        createdAt: now,
        updatedAt: now
      });
      
      // Add a lecture for each day
      const lectureStartDate = new Date(startDate);
      lectureStartDate.setHours(13, 0, 0, 0); // 1 PM
      
      const lectureEndDate = new Date(lectureStartDate);
      lectureEndDate.setHours(lectureStartDate.getHours() + 2, 0, 0, 0); // 2-hour lectures
      
      testEvents.push({
        id: `lecture-test-${dayIndex}`,
        title: `COMP-${1000 + dayIndex}: Sample Lecture`,
        description: `Lecture for COMP-${1000 + dayIndex}`,
        type: 'OTHER',
        startDate: lectureStartDate.toISOString(),
        endDate: lectureEndDate.toISOString(),
        createdAt: now,
        updatedAt: now,
        isLecture: true
      });
      
      // Add a lab for Monday, Wednesday, and Friday
      if (dayIndex % 2 === 0) {
        const labStartDate = new Date(startDate);
        labStartDate.setHours(15, 30, 0, 0); // 3:30 PM
        
        const labEndDate = new Date(labStartDate);
        labEndDate.setHours(labStartDate.getHours() + 1, 30, 0, 0); // 1.5-hour labs
        
        testEvents.push({
          id: `lab-test-${dayIndex}`,
          title: `COMP-${1000 + dayIndex}: Lab Session`,
          description: `Lab for COMP-${1000 + dayIndex}`,
          type: 'OTHER',
          startDate: labStartDate.toISOString(),
          endDate: labEndDate.toISOString(),
          createdAt: now,
          updatedAt: now,
          isLab: true
        });
      }
    }
    
    console.log('Created test events:', testEvents);
    setEvents(testEvents);
  };

  // Handle accepting all study sessions
  const handleAcceptAllSessions = async () => {
    if (!user || generatedStudySessions.length === 0) return;
    
    setIsLoading(true);
    setLoadingType('accept');
    try {
      console.log('Accepting all study sessions:', generatedStudySessions.length);
      
      // Save each session to the database
      const savePromises = generatedStudySessions.map(session => 
        saveAcceptedStudySession(session, user.username, currentWeekStart)
      );
      
      await Promise.all(savePromises);
      
      // Clear the generated sessions since they've been accepted
      setGeneratedStudySessions([]);
      
      // Fetch both regular events and accepted study sessions
      const currentUserId = user.username || userId;
      const fetchedEvents = await fetchEvents(currentWeekStart, currentUserId);
      const acceptedStudySessions = await fetchAcceptedStudySessions(currentWeekStart, currentUserId);
      
      // Update hasAcceptedSessions state
      setHasAcceptedSessions(acceptedStudySessions.length > 0);
      
      // Combine them and update the state
      const combinedEvents = [...fetchedEvents, ...acceptedStudySessions];
      setEvents(combinedEvents);
      
      console.log('All study sessions accepted successfully');
      console.log('Updated events count:', combinedEvents.length);
    } catch (error) {
      console.error('Error accepting study sessions:', error);
      setError('Failed to accept study sessions. Please try again.');
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  // Function to show a toast notification
  const showToast = (message: string, showRefresh: boolean = false) => {
    setToast({ message, visible: true, showRefresh });
    
    // Hide the toast after 3 seconds
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  };

  // Function to refresh data
  const refreshData = async () => {
    try {
      const currentUserId = user?.username || userId;
      
      // Show loading toast
      showToast('Refreshing schedule data...', false);
      
      // Fetch all data
      const [updatedEvents, updatedLectures, updatedAcceptedSessions] = await Promise.all([
        fetchEvents(currentWeekStart, currentUserId),
        fetchLectures(currentWeekStart),
        fetchAcceptedStudySessions(currentWeekStart, currentUserId)
      ]);
      
      // Update hasAcceptedSessions state
      setHasAcceptedSessions(updatedAcceptedSessions.length > 0);
      
      // Combine regular events with accepted study sessions
      const combinedEvents = [...updatedEvents, ...updatedAcceptedSessions];
      
      // Update state with the fetched data
      setEvents(combinedEvents);
      setLectures(updatedLectures || []);
      
      // Show success toast
      showToast('Schedule data refreshed successfully!', false);
    } catch (error) {
      console.error('Error refreshing data:', error);
      setError('Failed to refresh data. Please try again.');
    }
  };

  // Debug function to log event state
  const logEventState = (label: string) => {
    console.log(`[${label}] Event State:`, {
      events: events.length,
      lectures: lectures.length,
      generatedStudySessions: generatedStudySessions.length,
      acceptedStudySessions: acceptedStudySessions.length,
      hasAcceptedSessions,
      allEvents: allEvents.length
    });
  };

  // Check if a cell already has events (excluding a specific event)
  const cellHasEvents = (day: string, hour: number, excludeEventId: string | null): boolean => {
    if (!eventsByDayAndTime[day]) {
      return false;
    }
    
    // Check the target hour for events that start in this cell
    if (eventsByDayAndTime[day][hour]) {
      const eventsStartingInCell = eventsByDayAndTime[day][hour].filter(
        event => event.id !== excludeEventId && event.isStart === true
      );
      
      if (eventsStartingInCell.length > 0) {
        return true;
      }
    }
    
    // Also check for events that span across this hour
    // We need to check all hours before the current one
    for (let h = 8; h < hour; h++) {
      if (eventsByDayAndTime[day][h]) {
        // Find events that start in a previous hour and extend to or beyond the current hour
        const spanningEvents = eventsByDayAndTime[day][h].filter(event => {
          if (event.id === excludeEventId || !event.isStart) {
            return false;
          }
          
          // Check if this event spans to or beyond our target hour
          if (event.startDate && event.endDate) {
            const startDate = new Date(event.startDate);
            const endDate = new Date(event.endDate);
            
            // Calculate the event's end hour
            const endHour = endDate.getHours();
            const endMinutes = endDate.getMinutes();
            
            // If end time is exactly on the hour (e.g., 16:00), the slot from 16:00-17:00 
            // should be available for new events
            if (endHour === hour && endMinutes === 0) {
              return false; // Event ends exactly at the start of this hour, so slot is available
            }
            
            // Check if the event spans into our target hour (must end after the hour starts)
            return endHour > hour || (endHour === hour && endMinutes > 0);
          }
          
          return false;
        });
        
        if (spanningEvents.length > 0) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Handle event drop for drag and drop
  const handleEventDrop = async (event: ScheduleEvent, newDay: string, newHour: number) => {
    try {
      // Log state before update
      logEventState('Before Drop');
      
      // Double-check that the target cell doesn't already have events
      if (cellHasEvents(newDay, newHour, event.id)) {
        console.error(`Cannot drop onto cell ${newDay}-${newHour} because it already has events`);
        setError('Cannot reschedule to a time slot that already has events.');
        return;
      }
      
      // Get the original event dates
      const originalStartDate = new Date(event.startDate || '');
      const originalEndDate = new Date(event.endDate || '');
      
      if (isNaN(originalStartDate.getTime()) || isNaN(originalEndDate.getTime())) {
        console.error('Invalid event dates:', event);
        return;
      }
      
      // Calculate the duration of the event in minutes
      const durationMinutes = (originalEndDate.getTime() - originalStartDate.getTime()) / (1000 * 60);
      
      // Find the day index for the new day
      const dayIndex = weekDays.indexOf(newDay);
      if (dayIndex === -1) {
        console.error('Invalid day:', newDay);
        return;
      }
      
      // Create a new date for the start date based on the current week and the new day and hour
      // First, get the date for the target day of the week
      const targetDate = new Date(currentWeekStart);
      targetDate.setDate(currentWeekStart.getDate() + dayIndex);
      
      // Extract year, month, and day
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth();
      const day = targetDate.getDate();
      
      // Create a new date with the exact hour in local time
      // Use the exact hour that was specified in the drop target
      const newStartDate = new Date(year, month, day, newHour, 0, 0);
      
      // Calculate the end date by adding the duration
      const newEndDate = new Date(newStartDate);
      newEndDate.setMinutes(newStartDate.getMinutes() + durationMinutes);
      
      // Log the local time values for debugging
      console.log('Local time values:', {
        targetHour: newHour,
        newStartDate: newStartDate.toLocaleString(),
        newStartHour: newStartDate.getHours(),
        newEndDate: newEndDate.toLocaleString(),
        newEndHour: newEndDate.getHours()
      });
      
      // Create ISO strings that preserve the exact local time
      // We need to adjust for timezone offset to ensure the event is scheduled at the exact hour
      const tzOffset = new Date().getTimezoneOffset() * 60000; // offset in milliseconds
      
      // Create new Date objects that will be converted to ISO strings
      // By subtracting the timezone offset, we ensure the UTC time in the ISO string
      // will be interpreted as the correct local time when converted back
      const newStartUTC = new Date(newStartDate.getTime() - tzOffset);
      const newEndUTC = new Date(newEndDate.getTime() - tzOffset);
      
      const newStartISOString = newStartUTC.toISOString();
      const newEndISOString = newEndUTC.toISOString();
      
      console.log('Updating event times:', {
        id: event.id,
        title: event.title,
        oldStart: originalStartDate.toISOString(),
        oldEnd: originalEndDate.toISOString(),
        newStartLocal: newStartDate.toLocaleString(),
        newEndLocal: newEndDate.toLocaleString(),
        newStartISO: newStartISOString,
        newEndISO: newEndISOString,
        targetHour: newHour,
        targetDay: dayIndex,
        targetDayName: newDay,
        year,
        month,
        day,
        tzOffset: tzOffset / 60000 // convert to minutes for readability
      });
      
      // Create updated event object for local state update (fallback)
      const updatedEvent = {
        ...event,
        startDate: newStartISOString,
        endDate: newEndISOString
      };
      
      // Update the event times in the database
      const success = await updateEventTimes(
        event,
        newStartISOString,
        newEndISOString
      );
      
      if (success) {
        // Get the current user ID
        const currentUserId = user?.username || userId;
        
        // Refresh the events to show the updated times
        try {
          // Fetch accepted study sessions first
          const updatedAcceptedSessions = await fetchAcceptedStudySessions(currentWeekStart, currentUserId);
          
          // Then fetch regular events and lectures
          const [updatedEvents, updatedLectures] = await Promise.all([
            fetchEvents(currentWeekStart, currentUserId),
            fetchLectures(currentWeekStart)
          ]);
          
          console.log('After drag & drop - Fetched accepted sessions:', updatedAcceptedSessions.length);
          console.log('After drag & drop - Fetched regular events:', updatedEvents.length);
          
          // Update hasAcceptedSessions state
          setHasAcceptedSessions(updatedAcceptedSessions.length > 0);
          
          // Combine regular events with accepted study sessions
          const combinedEvents = [...updatedEvents, ...updatedAcceptedSessions];
          
          // Update state with the fetched data
          setEvents(combinedEvents);
          setLectures(updatedLectures || []);
          
          // Log state after update
          setTimeout(() => logEventState('After Drop'), 100);
          
          // Show success toast
          showToast('Study session rescheduled successfully!', false);
        } catch (fetchError) {
          console.error('Error fetching updated data:', fetchError);
          
          // Fallback: Update the event locally in state
          setEvents(prevEvents => {
            // Create a new array with the updated event
            return prevEvents.map(e => e.id === event.id ? updatedEvent : e);
          });
          
          // Show a different toast message
          showToast('Study session updated. Refresh for latest data.', true);
          
          // Log the fallback update
          console.log('Using fallback local state update for event:', updatedEvent);
        }
      } else {
        setError('Failed to update event times. Please try again.');
      }
    } catch (error) {
      console.error('Error handling event drop:', error);
      setError('An error occurred while updating the event. Please try again.');
    }
  };

  return (
    <div className="weekly-schedule">
      {/* Toast notification */}
      {toast.visible && (
        <div className="toast-notification">
          {toast.message}
          {toast.showRefresh && (
            <button 
              className="toast-refresh-btn"
              onClick={refreshData}
            >
              Refresh
            </button>
          )}
        </div>
      )}
      
      <div className="schedule-controls">
        <ScheduleNavigation 
          currentWeekStart={currentWeekStart}
          navigateWeek={navigateWeek}
          handleGenerateStudySessions={handleGenerateStudySessions}
          handleRegenerateStudySessions={handleRegenerateStudySessions}
          hasGeneratedSessions={generatedStudySessions.length > 0}
          hasAcceptedSessions={hasAcceptedSessions}
          clearStudySessions={clearStudySessions}
          handleAcceptAllSessions={handleAcceptAllSessions}
          isLoading={isLoading}
          loadingType={loadingType}
        />
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
      </div>
      
      <ScheduleGrid 
        eventsByDayAndTime={eventsByDayAndTime} 
        onEventDrop={handleEventDrop}
      />
      <ScheduleLegend />
      
      {allEvents.length === 0 && !isLoading && (
        <div className="no-events-message">
          <p>No events found for this week.</p>
          <button 
            className="create-test-events-btn"
            onClick={createTestEvents}
          >
            Create Test Events
          </button>
        </div>
      )}
    </div>
  );
};

export default WeeklySchedule;