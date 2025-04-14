import { useMemo, useState, useEffect } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Event, ScheduleEvent, weekDays, hours, ensureValidEventType } from './types';
import { getMondayOfCurrentWeek } from './utils';
import { 
  fetchEvents, 
  fetchLectures, 
  generateStudySessions, 
  saveAcceptedStudySession,
  fetchAcceptedStudySessions,
  deleteAcceptedStudySessions,
  generatePersonalLearningSlots,
  getPersonalLearningItems,
  saveAcceptedPersonalLearningSession,
  fetchAcceptedPersonalLearningSessions,
  deleteAcceptedPersonalLearningSessions
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
  
  // Add state for current week - now starts from the stored week or current week's Monday
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    // Try to get the saved week from localStorage
    const savedWeekStr = localStorage.getItem('currentWeekStart');
    if (savedWeekStr) {
      const savedDate = new Date(savedWeekStr);
      // Check if the saved date is valid
      if (!isNaN(savedDate.getTime())) {
        return savedDate;
      }
    }
    // Fallback to current week's Monday
    return getMondayOfCurrentWeek();
  });
  
  // Add state for events
  const [events, setEvents] = useState<Event[]>(initialEvents);
  
  // Add state for generated study sessions
  const [generatedStudySessions, setGeneratedStudySessions] = useState<Event[]>([]);
  
  // Add state for lectures
  const [lectures, setLectures] = useState<Event[]>([]);
  
  // Add separate loading states for study sessions and personal learning
  const [isStudySessionLoading, setIsStudySessionLoading] = useState(false);
  const [isPersonalLearningLoading, setIsPersonalLearningLoading] = useState(false);
  
  // Add state to track the type of loading operation
  const [loadingType, setLoadingType] = useState<'generate' | 'accept' | 'regenerate' | null>(null);
  
  // Add state for error
  const [error, setError] = useState<string | JSX.Element | null>(null);
  
  // Add state to track if there are accepted study sessions for the current week
  const [hasAcceptedSessions, setHasAcceptedSessions] = useState(false);
  
  // Add state for selected study session for quiz
  const [selectedLecture, setSelectedLecture] = useState<ScheduleEvent | null>(null);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  
  // Add a new state variable for recently completed lectures
  const [recentlyCompletedLectures, setRecentlyCompletedLectures] = useState<string[]>([]);
  
  // Add state for personal learning slots
  const [personalLearningSlots, setPersonalLearningSlots] = useState<Event[]>([]);
  
  // Add state to track if there are accepted personal learning sessions for the current week
  const [hasAcceptedPersonalLearning, setHasAcceptedPersonalLearning] = useState(false);
  
  // Initialize with initial events
  useEffect(() => {
    if (initialEvents.length > 0) {
      setEvents(initialEvents);
    }
  }, []);
  
  // Save the current week to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('currentWeekStart', currentWeekStart.toISOString());
  }, [currentWeekStart]);
  
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
      
      // Clear generated content when changing weeks (to avoid multiple state updates in the effect)
      // We do this outside of the async operation to avoid race conditions
      setPersonalLearningSlots([]);
      setGeneratedStudySessions([]);
      
      try {
        // Fetch events for the current week
        const currentUserId = user?.username || userId;
        
        const fetchedEvents = await fetchEvents(currentWeekStart);
        
        // Fetch accepted study sessions for the current week
        const acceptedStudySessions = await fetchAcceptedStudySessions(currentWeekStart, currentUserId);
        
        // Fetch accepted personal learning sessions for the current week
        const acceptedPersonalLearningSessions = await fetchAcceptedPersonalLearningSessions(currentWeekStart, currentUserId);
        
        // Update hasAcceptedSessions state
        setHasAcceptedSessions(acceptedStudySessions.length > 0);
        
        // Check if there are any accepted personal learning sessions
        const hasAcceptedLearning = acceptedPersonalLearningSessions.length > 0;
        setHasAcceptedPersonalLearning(hasAcceptedLearning);
        
        // Combine regular events with accepted study sessions and personal learning sessions
        const combinedEvents = [...fetchedEvents, ...acceptedStudySessions, ...acceptedPersonalLearningSessions];
        
        // Fetch lectures for the current week, filtered by user's selected courses
        const fetchedLectures = await fetchLectures(currentWeekStart, currentUserId);
        
        // Update events state
        setEvents(combinedEvents);
        
        // Update lectures state
        setLectures(fetchedLectures);
        
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to fetch schedule data. Please try refreshing the page.');
      }
    };
    
    fetchData();
  }, [currentWeekStart, userId, user?.username]);
  
  // Combine regular events with generated study sessions and lectures and personal learning slots
  const allEvents = useMemo(() => {
    const combined = [...events, ...generatedStudySessions, ...lectures, ...personalLearningSlots];
    return combined;
  }, [events, generatedStudySessions, lectures, personalLearningSlots]);

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
            // In this case, we would need to adjust the end time but we're just logging the error
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
                  ensureValidEventType(event.type) === 'STUDY' && 
                  !generatedStudySessions.some(s => s.id === event.id);
                
                // Only mark the first hour as the start hour
                const isStartHour = hour === startHour;
                
                // Calculate and store event duration in hours
                const durationHours = event.startDate && event.endDate 
                  ? (new Date(event.endDate).getTime() - new Date(event.startDate).getTime()) / (1000 * 60 * 60)
                  : 1;
                
                const scheduleEvent: ScheduleEvent = {
                  ...event,
                  isStart: isStartHour,
                  duration: durationHours, // Store duration for better rendering
                  isAcceptedStudySession
                };
                
                // Add the event to this hour's cell
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
      
      return newDate;
    });
  };

  // Handle generating study sessions
  const handleGenerateStudySessions = async () => {
    setIsStudySessionLoading(true);
    setLoadingType('generate');
    setError(null);
    
    try {
      // Generate study sessions for the current week
      const currentUserId = user?.username || userId;
      
      // Re-fetch lectures to ensure we have the most up-to-date data
      const fetchedLectures = await fetchLectures(currentWeekStart, currentUserId);
      
      // Update lectures state
      setLectures(fetchedLectures);
      
      // Generate study sessions
      const studySessions = await generateStudySessions(
        currentWeekStart,
        events,
        fetchedLectures,
        currentUserId
      );
      
      // Update generated study sessions state
      setGeneratedStudySessions(studySessions);
      
      // Clear any previous error
      setError(null);
    } catch (error) {
      console.error('Error generating study sessions:', error);
      setError('Failed to generate study sessions. Please try again later.');
    } finally {
      setIsStudySessionLoading(false);
      setLoadingType(null);
    }
  };

  // Delete accepted study sessions and regenerate
  const handleRegenerateStudySessions = async () => {
    setIsStudySessionLoading(true);
    setLoadingType('regenerate');
    setError(null);
    
    try {
      // Delete existing accepted study sessions
      const currentUserId = user?.username || userId;
      await deleteAcceptedStudySessions(currentWeekStart, currentUserId);
      
      // Re-fetch events (without the deleted study sessions)
      const fetchedEvents = await fetchEvents(currentWeekStart);
      
      // Update events state
      setEvents(fetchedEvents);
      
      // Re-fetch lectures to ensure we have the most up-to-date data
      const fetchedLectures = await fetchLectures(currentWeekStart, currentUserId);
      
      // Update lectures state
      setLectures(fetchedLectures);
      
      // Generate new study sessions
      const newStudySessions = await generateStudySessions(
        currentWeekStart,
        fetchedEvents,
        fetchedLectures,
        currentUserId
      );
      
      // Update generated study sessions state
      setGeneratedStudySessions(newStudySessions);
      
      // Update hasAcceptedSessions state
      setHasAcceptedSessions(false);
      
      // Clear any previous error
      setError(null);
    } catch (error) {
      console.error('Error regenerating study sessions:', error);
      setError('Failed to regenerate study sessions. Please try again later.');
    } finally {
      setIsStudySessionLoading(false);
      setLoadingType(null);
    }
  };

  // Handle accepting all study sessions
  const handleAcceptAllSessions = async () => {
    if (!user || generatedStudySessions.length === 0) return;
    
    setIsStudySessionLoading(true);
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
      const fetchedEvents = await fetchEvents(currentWeekStart);
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
      setIsStudySessionLoading(false);
      setLoadingType(null);
    }
  };

  // Handle lecture click for quiz submission
  const handleEventClick = (event: ScheduleEvent) => {
    if (event.isLecture) {
      setSelectedLecture(event);
      setIsQuizModalOpen(true);
    }
  };
  
  // Close quiz modal
  const handleCloseQuizModal = () => {
    setIsQuizModalOpen(false);
  };
  
  // Handle progress saved in the quiz modal
  const handleProgressSaved = (lectureId?: string) => {
    setIsQuizModalOpen(false);
    setSelectedLecture(null);
    
    // Add the lectureId to recently completed lectures if provided
    if (lectureId) {
      setRecentlyCompletedLectures(prev => [...prev, lectureId]);
    }
    
    // Fetch updated data to reflect any progress changes
    const fetchUpdatedData = async () => {
      try {
        const currentUserId = user?.username || userId;
        
        // Fetch events for the current week
        const fetchedEvents = await fetchEvents(currentWeekStart);
        
        // Fetch accepted study sessions for the current week
        const acceptedStudySessions = await fetchAcceptedStudySessions(currentWeekStart, currentUserId);
        
        // Combine regular events with accepted study sessions
        const combinedEvents = [...fetchedEvents, ...acceptedStudySessions];
        setEvents(combinedEvents);
        
        // Fetch lectures too to reflect any progress updates, filtered by selected courses
        const lectureEvents = await fetchLectures(currentWeekStart, currentUserId);
        setLectures(lectureEvents);
        
      } catch (error) {
        console.error('Error updating data after progress save:', error);
      }
    };
    
    fetchUpdatedData();
  };

  // Handle generating personal learning time slots
  const handleGeneratePersonalLearningSlots = async () => {
    setIsPersonalLearningLoading(true);
    setError(null);
    
    try {
      const currentUserId = user?.username || userId;
      
      // Re-fetch lectures to ensure we have the most up-to-date data, filtered by selected courses
      const fetchedLectures = await fetchLectures(currentWeekStart, currentUserId);
      
      // Update lectures state
      setLectures(fetchedLectures);
      
      // Check if personal learning items exist for this user
      const personalItems = await getPersonalLearningItems(currentUserId);
      
      if (personalItems.length === 0) {
        setIsPersonalLearningLoading(false);
        setError(
          <span>
            You haven't added any personal learning subjects yet. 
            <a href="/personal-learning" className="nav-link">Add them here</a>.
          </span>
        );
        return;
      }
      
      // Generate personal learning slots
      const personalLearningEvents = await generatePersonalLearningSlots(
        currentWeekStart,
        events,
        fetchedLectures,
        currentUserId
      );
      
      // Update personal learning slots state
      setPersonalLearningSlots(personalLearningEvents);
      
      // Clear any previous error
      setError(null);
    } catch (error) {
      console.error('Error generating personal learning slots:', error);
      setError('Failed to generate personal learning slots. Please try again later.');
    } finally {
      setIsPersonalLearningLoading(false);
    }
  };

  // Clear study sessions
  const clearStudySessions = () => {
    setGeneratedStudySessions([]);
  };

  // Clear personal learning slots
  const clearPersonalLearningSlots = () => {
    setPersonalLearningSlots([]);
  };

  // Delete accepted personal learning sessions and regenerate
  const handleRegeneratePersonalLearning = async () => {
    setIsPersonalLearningLoading(true);
    setLoadingType('regenerate');
    setError(null);
    
    try {
      // Delete existing accepted personal learning sessions
      const currentUserId = user?.username || userId;
      await deleteAcceptedPersonalLearningSessions(currentWeekStart, currentUserId);
      
      // Re-fetch events (without the deleted personal learning sessions)
      const fetchedEvents = await fetchEvents(currentWeekStart);
      const acceptedStudySessions = await fetchAcceptedStudySessions(currentWeekStart, currentUserId);
      
      // Combine and update events state
      const combinedEvents = [...fetchedEvents, ...acceptedStudySessions];
      setEvents(combinedEvents);
      
      // Update state to reflect that there are no longer any accepted personal learning sessions
      setHasAcceptedPersonalLearning(false);
      
      // Re-fetch lectures to ensure we have the most up-to-date data
      const fetchedLectures = await fetchLectures(currentWeekStart, currentUserId);
      setLectures(fetchedLectures);
      
      // Generate new personal learning slots
      const personalItems = await getPersonalLearningItems(currentUserId);
      if (personalItems.length === 0) {
        setError(
          <span>
            You haven't added any personal learning subjects yet. 
            <a href="/personal-learning" className="nav-link">Add them here</a>.
          </span>
        );
        setIsPersonalLearningLoading(false);
        setLoadingType(null);
        return;
      }
      
      // Generate new personal learning slots
      const newPersonalLearningSlots = await generatePersonalLearningSlots(
        currentWeekStart,
        combinedEvents,
        fetchedLectures,
        currentUserId
      );
      
      // Update personal learning slots state
      setPersonalLearningSlots(newPersonalLearningSlots);
      
      // Clear any previous error
      setError(null);
    } catch (error) {
      console.error('Error regenerating personal learning slots:', error);
      setError('Failed to regenerate personal learning slots. Please try again later.');
    } finally {
      setIsPersonalLearningLoading(false);
      setLoadingType(null);
    }
  };

  // Handle accepting all personal learning slots
  const handleAcceptAllPersonalLearning = async () => {
    if (!user || personalLearningSlots.length === 0) return;
    
    setIsPersonalLearningLoading(true);
    setLoadingType('accept');
    try {
      console.log('Accepting all personal learning slots:', personalLearningSlots.length);
      
      const currentUserId = user.username || userId;
      
      // Get all personal learning items to determine subjects
      const personalItems = await getPersonalLearningItems(currentUserId);
      
      // Default subject if none are found
      let defaultSubject = "Personal Learning";
      
      // Use the first active subject as the default if available
      if (personalItems.length > 0) {
        const activeItems = personalItems.filter(item => item.isActive !== false);
        if (activeItems.length > 0) {
          defaultSubject = activeItems[0].subject;
        }
      }
      
      // Save each session to the database
      const savePromises = personalLearningSlots.map(session => 
        saveAcceptedPersonalLearningSession(session, currentUserId, currentWeekStart, defaultSubject)
      );
      
      await Promise.all(savePromises);
      
      // Clear the generated sessions since they've been accepted
      setPersonalLearningSlots([]);
      
      // Fetch events, including the newly accepted personal learning sessions
      const fetchedEvents = await fetchEvents(currentWeekStart);
      const acceptedStudySessions = await fetchAcceptedStudySessions(currentWeekStart, currentUserId);
      const acceptedPersonalLearningSessions = await fetchAcceptedPersonalLearningSessions(currentWeekStart, currentUserId);
      
      // Combine them and update the state
      const combinedEvents = [...fetchedEvents, ...acceptedStudySessions, ...acceptedPersonalLearningSessions];
      setEvents(combinedEvents);
      
      // Update state to reflect that there are accepted personal learning sessions
      setHasAcceptedPersonalLearning(true);
      
      console.log('All personal learning slots accepted successfully');
      console.log('Updated events count:', combinedEvents.length);
    } catch (error) {
      console.error('Error accepting personal learning slots:', error);
      setError('Failed to accept personal learning slots. Please try again.');
    } finally {
      setIsPersonalLearningLoading(false);
      setLoadingType(null);
    }
  };

  return (
    <div className="weekly-schedule">
      <div className="schedule-header">
        <ScheduleNavigation
          currentWeekStart={currentWeekStart}
          onNavigate={navigateWeek}
          formatWeekDate={formatWeekDate}
        />
        
        <div className="schedule-actions">
          {/* Study Sessions generation button */}
          <div className="action-container">
            <div className="action-group study-sessions-group">
              <div className="group-header">
                <h3>Study Sessions</h3>
                <p className="group-description">
                  Generate optimized study time slots based on your weekly schedule and preferences.
                </p>
              </div>
              {hasAcceptedSessions ? (
                <button 
                  className="action-button regenerate-button"
                  onClick={handleRegenerateStudySessions}
                  disabled={isStudySessionLoading || isPersonalLearningLoading}
                >
                  {isStudySessionLoading && loadingType === 'regenerate' ? (
                    <span className="loading-spinner"></span>
                  ) : (
                    'Regenerate Study Sessions'
                  )}
                </button>
              ) : generatedStudySessions.length > 0 ? (
                <div className="button-group">
                  <button 
                    className="action-button accept-button"
                    onClick={handleAcceptAllSessions}
                    disabled={isStudySessionLoading || isPersonalLearningLoading}
                  >
                    {isStudySessionLoading && loadingType === 'accept' ? (
                      <span className="loading-spinner"></span>
                    ) : (
                      'Accept Study Sessions'
                    )}
                  </button>
                  <button 
                    className="action-button clear-button"
                    onClick={clearStudySessions}
                    disabled={isStudySessionLoading || isPersonalLearningLoading}
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <button 
                  className="action-button generate-button"
                  onClick={handleGenerateStudySessions}
                  disabled={isStudySessionLoading || isPersonalLearningLoading}
                >
                  {isStudySessionLoading ? (
                    <span className="loading-spinner"></span>
                  ) : (
                    'Generate Study Sessions'
                  )}
                </button>
              )}
            </div>
          
            {/* Personal Learning slots generation button */}
            <div className="action-group personal-learning-group">
              <div className="group-header">
                <h3>Personal Learning</h3>
                <p className="group-description">
                  Schedule dedicated time for your personal learning projects and subjects.
                </p>
              </div>
              {hasAcceptedPersonalLearning ? (
                <button 
                  className="action-button regenerate-button"
                  onClick={handleRegeneratePersonalLearning}
                  disabled={isStudySessionLoading || isPersonalLearningLoading}
                >
                  {isPersonalLearningLoading && loadingType === 'regenerate' ? (
                    <span className="loading-spinner"></span>
                  ) : (
                    'Regenerate Learning Hours'
                  )}
                </button>
              ) : personalLearningSlots.length > 0 ? (
                <div className="button-group">
                  <button 
                    className="action-button accept-button"
                    onClick={handleAcceptAllPersonalLearning}
                    disabled={isStudySessionLoading || isPersonalLearningLoading}
                  >
                    {isPersonalLearningLoading && loadingType === 'accept' ? (
                      <span className="loading-spinner"></span>
                    ) : (
                      'Accept Learning Hours'
                    )}
                  </button>
                  <button 
                    className="action-button clear-button"
                    onClick={clearPersonalLearningSlots}
                    disabled={isStudySessionLoading || isPersonalLearningLoading}
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <button 
                  className="action-button generate-button personal-learning-button"
                  onClick={handleGeneratePersonalLearningSlots}
                  disabled={isStudySessionLoading || isPersonalLearningLoading}
                >
                  {isPersonalLearningLoading ? (
                    <span className="loading-spinner"></span>
                  ) : (
                    'Generate Personal Learning Hours'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <ScheduleGrid 
        eventsByDayAndTime={eventsByDayAndTime} 
        onEventClick={handleEventClick}
        recentlyCompletedLectures={recentlyCompletedLectures}
      />
      <ScheduleLegend />
      
      {allEvents.length === 0 && !isStudySessionLoading && !isPersonalLearningLoading && (
        <div className="no-events-message">
          <p>No events found for this week.</p>
        </div>
      )}
      
      {/* Lecture Quiz Modal */}
      <LectureQuizModal
        isOpen={isQuizModalOpen}
        onClose={handleCloseQuizModal}
        lecture={selectedLecture}
        onProgressSaved={handleProgressSaved}
      />
    </div>
  );
};
