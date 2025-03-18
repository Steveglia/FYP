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
  deleteAcceptedStudySessions
} from './scheduleService';
import ScheduleNavigation from './ScheduleNavigation';
import ScheduleGrid from './ScheduleGrid';
import ScheduleLegend from './ScheduleLegend';
import LectureQuizModal from './LectureQuizModal';
import './WeeklySchedule.css';

interface WeeklyScheduleProps {
  events?: Event[];
  userId: string;
}

export const WeeklySchedule: React.FC<WeeklyScheduleProps> = ({ events: initialEvents = [], userId }) => {
  const { user } = useAuthenticator();
  
  // Add state for current week - now starts from the current week's Monday
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const startDate = getMondayOfCurrentWeek();
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
  
  // Add state for selected study session for quiz
  const [selectedLecture, setSelectedLecture] = useState<ScheduleEvent | null>(null);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  
  // Initialize with initial events
  useEffect(() => {
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
        // Fetch events for the current week
        const currentUserId = user?.username || userId;
        
        const fetchedEvents = await fetchEvents(currentWeekStart, currentUserId);
        
        // Fetch accepted study sessions for the current week
        const acceptedStudySessions = await fetchAcceptedStudySessions(currentWeekStart, currentUserId);
        
        // Update hasAcceptedSessions state
        setHasAcceptedSessions(acceptedStudySessions.length > 0);
        
        // Combine regular events with accepted study sessions
        const combinedEvents = [...fetchedEvents, ...acceptedStudySessions];
        
        if (combinedEvents.length > 0) {
          setEvents(combinedEvents);
        } else if (initialEvents.length > 0 && events.length === 0) {
          // If no events were fetched but we have initial events, use those
          setEvents(initialEvents);
        }
        
        // Fetch lectures for the current week
        const lectureEvents = await fetchLectures(currentWeekStart);
        setLectures(lectureEvents);
        
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load schedule data. Please try again later.');
      }
    };
    
    fetchData();
  }, [currentWeekStart, user, userId, initialEvents, events.length]);
  
  // Combine regular events with generated study sessions and lectures
  const allEvents = useMemo(() => {
    const combined = [...events, ...generatedStudySessions, ...lectures];
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
    
    let eventsInRange = 0;
    let eventsOutsideHours = 0;
    
    allEvents.forEach(event => {
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
          const endDateStr = endParts[0];
          
          // Extract time components (HH:MM:SS.sssZ)
          const startTimeStr = startParts[1];
          const endTimeStr = endParts[1];
          
          // Extract hours and minutes without timezone adjustments
          const startHour = parseInt(startTimeStr.substring(0, 2), 10);
          const startMinute = parseInt(startTimeStr.substring(3, 5), 10);
          const endHour = parseInt(endTimeStr.substring(0, 2), 10);
          const endMinute = parseInt(endTimeStr.substring(3, 5), 10);
          
          // Create date objects for comparison
          const startDate = new Date(startDateStr);
          const endDate = new Date(endDateStr);
          
          // Ensure dates are valid
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            console.error(`Event "${event.title}" has invalid date format`);
            return; // Skip this event
          }
          
          // Ensure end date is after start date
          if (endDateStr === startDateStr && (endHour < startHour || (endHour === startHour && endMinute <= startMinute))) {
            console.error(`Event "${event.title}" has invalid time range (end <= start)`);
            // In this case, set end hour to startHour + 1
            const newEndHour = startHour + 1;
          }

          // Only process events within the current week
          // Create date-only objects to avoid timezone issues
          const eventDate = new Date(startDateStr);
          
          const weekStart = new Date(currentWeekStart);
          weekStart.setHours(0, 0, 0, 0);
          
          const weekEnd = new Date(weekEndDate);
          weekEnd.setHours(0, 0, 0, 0);
          
          // Simple timestamp comparison for date ranges (date only)
          const isAfterWeekStart = eventDate.getTime() >= weekStart.getTime();
          const isBeforeWeekEnd = eventDate.getTime() < weekEnd.getTime();
          
          if (isAfterWeekStart && isBeforeWeekEnd) {
            eventsInRange++;
            
            // Get day of week from date part only (0 = Sunday, 1 = Monday, etc.)
            const dayOfWeek = eventDate.getDay();
            // Convert to our weekDays array index (0 = Monday, 6 = Sunday)
            const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const day = weekDays[dayIndex];
            
            // Check if the event is within our display hours (8am-10pm)
            if (startHour < 8 || startHour > 22) {
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
          }
        } catch (err) {
          console.error(`Error processing event "${event.title}":`, err);
        }
      }
    });
    
    return schedule;
  }, [allEvents, currentWeekStart, generatedStudySessions]);

  // Add navigation functions
  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prevDate => {
      // Create a new date object to avoid mutating the previous one
      const newDate = new Date(prevDate);
      
      // Add or subtract 7 days
      newDate.setDate(prevDate.getDate() + (direction === 'next' ? 7 : -7));
      
      // Clear study sessions when navigating to a new week
      if (generatedStudySessions.length > 0) {
        setGeneratedStudySessions([]);
      }
      
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
      const studySessions = await generateStudySessions(
        currentWeekStart,
        events,
        lectures,
        user.username
      );
      
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
      await deleteAcceptedStudySessions(currentWeekStart, user.username);
      
      // Update the events list to remove the deleted sessions
      const fetchedEvents = await fetchEvents(currentWeekStart, user.username);
      setEvents(fetchedEvents);
      
      // Set hasAcceptedSessions to false since we've deleted them
      setHasAcceptedSessions(false);
      
      // Now generate new study sessions
      const studySessions = await generateStudySessions(
        currentWeekStart,
        fetchedEvents, // Use the updated events list
        lectures,
        user.username
      );
      
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
      // Create the date part without time
      const currentDay = new Date(currentWeekStart);
      currentDay.setDate(currentWeekStart.getDate() + dayIndex);
      currentDay.setHours(0, 0, 0, 0);
      
      // Format the date part as YYYY-MM-DD
      const dateStr = currentDay.toISOString().split('T')[0];
      
      // Create event for 9AM + dayIndex
      const eventHour = 9 + dayIndex;
      const eventStartTimeStr = `${eventHour.toString().padStart(2, '0')}:00:00.000Z`;
      const eventEndHour = eventHour + 1;
      const eventEndTimeStr = `${eventEndHour.toString().padStart(2, '0')}:00:00.000Z`;
      
      const eventStartIso = `${dateStr}T${eventStartTimeStr}`;
      const eventEndIso = `${dateStr}T${eventEndTimeStr}`;
      
      const now = new Date().toISOString();
      
      // Create event names based on the day of the week
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const eventName = `${dayNames[dayIndex]} Event (${formatWeekDate(currentDay)})`;
      
      testEvents.push({
        id: `test-event-${dayIndex}`,
        title: eventName,
        description: `Test event for ${dayNames[dayIndex]}`,
        type: 'MEETING',
        startDate: eventStartIso,
        endDate: eventEndIso,
        createdAt: now,
        updatedAt: now
      });
      
      // Add a lecture for each day at 1PM
      const lectureHour = 13;
      const lectureStartTimeStr = `${lectureHour.toString().padStart(2, '0')}:00:00.000Z`;
      const lectureEndHour = lectureHour + 2;
      const lectureEndTimeStr = `${lectureEndHour.toString().padStart(2, '0')}:00:00.000Z`;
      
      const lectureStartIso = `${dateStr}T${lectureStartTimeStr}`;
      const lectureEndIso = `${dateStr}T${lectureEndTimeStr}`;
      
      testEvents.push({
        id: `lecture-test-${dayIndex}`,
        title: `COMP-${1000 + dayIndex}: Sample Lecture`,
        description: `Lecture for COMP-${1000 + dayIndex}`,
        type: 'OTHER',
        startDate: lectureStartIso,
        endDate: lectureEndIso,
        createdAt: now,
        updatedAt: now,
        isLecture: true
      });
      
      // Add a lab for Monday, Wednesday, and Friday at 3:30PM
      if (dayIndex % 2 === 0) {
        const labHour = 15;
        const labMinute = 30;
        const labStartTimeStr = `${labHour.toString().padStart(2, '0')}:${labMinute.toString().padStart(2, '0')}:00.000Z`;
        const labEndHour = 17;
        const labEndMinute = 0;
        const labEndTimeStr = `${labEndHour.toString().padStart(2, '0')}:${labEndMinute.toString().padStart(2, '0')}:00.000Z`;
        
        const labStartIso = `${dateStr}T${labStartTimeStr}`;
        const labEndIso = `${dateStr}T${labEndTimeStr}`;
        
        testEvents.push({
          id: `lab-test-${dayIndex}`,
          title: `COMP-${1000 + dayIndex}: Lab Session`,
          description: `Lab for COMP-${1000 + dayIndex}`,
          type: 'OTHER',
          startDate: labStartIso,
          endDate: labEndIso,
          createdAt: now,
          updatedAt: now,
          isLab: true
        });
      }
    }
    
    console.log('Created test events:', testEvents.length);
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

  // Handle study session click for quiz
  const handleStudySessionClick = (event: ScheduleEvent) => {
    if (event.isAcceptedStudySession) {
      setSelectedLecture(event);
      setIsQuizModalOpen(true);
    }
  };
  
  // Close quiz modal
  const handleCloseQuizModal = () => {
    setIsQuizModalOpen(false);
  };
  
  // Handle progress saved in the quiz modal
  const handleProgressSaved = () => {
    // Refresh data after progress is saved
    const fetchUpdatedData = async () => {
      if (!user) return;
      
      try {
        // Fetch events again to reflect any changes
        const fetchedEvents = await fetchEvents(currentWeekStart, user.username);
        const acceptedStudySessions = await fetchAcceptedStudySessions(currentWeekStart, user.username);
        
        // Combine them and update the state
        const combinedEvents = [...fetchedEvents, ...acceptedStudySessions];
        setEvents(combinedEvents);
        
        // Fetch lectures too to reflect any progress updates
        const lectureEvents = await fetchLectures(currentWeekStart);
        setLectures(lectureEvents);
        
        console.log('Refreshed events after progress saved');
      } catch (error) {
        console.error('Error refreshing data after progress saved:', error);
      }
    };
    
    fetchUpdatedData();
  };

  return (
    <div className="weekly-schedule">
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
        onEventClick={handleStudySessionClick}
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
      
      {/* Lecture Quiz Modal */}
      <LectureQuizModal
        isOpen={isQuizModalOpen}
        onClose={handleCloseQuizModal}
        lecture={selectedLecture}
        lectures={lectures}
        onProgressSaved={handleProgressSaved}
      />
    </div>
  );
};
