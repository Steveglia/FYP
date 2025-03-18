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
import QuizModal from './QuizModal';
import { useTimeContext } from '../../context/TimeContext';
import './WeeklySchedule.css';

interface WeeklyScheduleProps {
  events?: Event[];
  userId: string;
}

export const WeeklySchedule: React.FC<WeeklyScheduleProps> = ({ events: initialEvents = [], userId }) => {
  const { user } = useAuthenticator();
  const { getCurrentTime } = useTimeContext();
  
  // Add state for current week - now based on the global time context
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    // Use the global time to calculate the start of the week
    const currentTime = getCurrentTime();
    const startDate = getMondayOfCurrentWeek(currentTime);
    console.log('Initial week start date (from global time):', startDate.toLocaleDateString('en-GB'), 
                '(', startDate.toISOString(), ')');
    return startDate;
  });
  
  // Update currentWeekStart when global time changes
  useEffect(() => {
    const currentTime = getCurrentTime();
    const startDate = getMondayOfCurrentWeek(currentTime);
    setCurrentWeekStart(startDate);
  }, [getCurrentTime]);
  
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
  const [selectedStudySession, setSelectedStudySession] = useState<ScheduleEvent | null>(null);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  
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
        const fetchedEvents = await fetchEvents(currentWeekStart);
        console.log('Fetched events:', fetchedEvents.length);
        
        // Fetch accepted study sessions for the current week
        const currentUserId = user?.username || userId;
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
    
    // Set the current week to the user's preference or default to current week
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
          const startYear = startDate.getUTCFullYear();
          const startMonth = startDate.getUTCMonth();
          const startDay = startDate.getUTCDate();
          
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
            const dayOfWeek = startDate.getUTCDay();
            // Convert to our weekDays array index (0 = Monday, 6 = Sunday)
            const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const day = weekDays[dayIndex];
            
            // Get hours in local time
            const startHour = startDate.getUTCHours();
            const endHour = endDate.getUTCHours();
            
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
      const fetchedEvents = await fetchEvents(currentWeekStart);
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
      const fetchedEvents = await fetchEvents(currentWeekStart);
      const acceptedStudySessions = await fetchAcceptedStudySessions(currentWeekStart, user.username || userId);
      
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
    if (event.isLecture) {
      setSelectedStudySession(event);
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
        const fetchedEvents = await fetchEvents(currentWeekStart);
        const acceptedStudySessions = await fetchAcceptedStudySessions(currentWeekStart, user.username || userId);
        
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
      
      {/* Study Session Quiz Modal */}
      <QuizModal
        isOpen={isQuizModalOpen}
        onClose={handleCloseQuizModal}
        studySession={selectedStudySession}
        lectures={lectures}
        onProgressSaved={handleProgressSaved}
      />
    </div>
  );
};
