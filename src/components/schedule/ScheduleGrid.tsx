import React, { useEffect, useState, useMemo } from 'react';
import { ScheduleEvent, weekDays, hours, eventTypeColors, ensureValidEventType } from './types';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from "../../../amplify/data/resource";
import { useAuthenticator } from '@aws-amplify/ui-react';
import { relocateStudySession } from './scheduleService';

const client = generateClient<Schema>();

interface ScheduleGridProps {
  eventsByDayAndTime: { [key: string]: { [key: string]: ScheduleEvent[] } };
  onEventClick?: (event: ScheduleEvent) => void;
  recentlyCompletedLectures?: string[]; // New prop to track recently completed lectures
  onScheduleUpdated?: () => void; // Callback when a study session is moved
}

const ScheduleGrid: React.FC<ScheduleGridProps> = ({ 
  eventsByDayAndTime, 
  onEventClick,
  recentlyCompletedLectures = [], // Default to empty array
  onScheduleUpdated
}) => {
  const { user } = useAuthenticator();
  const [progressMap, setProgressMap] = useState<Record<string, boolean>>({});
  const [lectureProgressMap, setLectureProgressMap] = useState<Record<string, boolean>>({});
  const [selectedSession, setSelectedSession] = useState<ScheduleEvent | null>(null);
  const [movingSession, setMovingSession] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Process the schedule data for efficiency
  const processedSchedule = useMemo(() => eventsByDayAndTime, [eventsByDayAndTime]);

  // Clear success message after a delay
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Fetch quiz progress data when component mounts
  useEffect(() => {
    const fetchProgressData = async () => {
      if (!user?.username) return;
      
      try {
        const result = await client.models.UserProgress.list({
          filter: { userId: { eq: user.username } }
        });
        
        if (result.data && result.data.length > 0) {
          const progressTracker: Record<string, boolean> = {};
          const lectureProgressTracker: Record<string, boolean> = {};
          
          // Process all progress records
          result.data.forEach(progress => {
            // Track course progress
            if (progress.quizScores && progress.quizScores > 0 && progress.courseId) {
              // Associate the course ID with having a score
              progressTracker[progress.courseId] = true;
              
              // If we have specific lecture IDs in the completedLectures array, mark those as well
              if (progress.completedLectures) {
                progress.completedLectures.forEach(lectureId => {
                  if (lectureId) {
                    progressTracker[lectureId] = true;
                    // Also mark in the lecture-specific tracker
                    lectureProgressTracker[lectureId] = true;
                  }
                });
              }
            }
            
            // Track lecture-specific progress when lectureId matches
            if (progress.lectureId && progress.quizScores && progress.quizScores > 0) {
              lectureProgressTracker[progress.lectureId] = true;
            }
          });
          
          setProgressMap(progressTracker);
          setLectureProgressMap(lectureProgressTracker);
        }
      } catch (error) {
        console.error('Error fetching progress data:', error);
      }
    };
    
    fetchProgressData();
  }, [user]);

  // Handle clicking on a study session
  const handleStudySessionClick = (event: ScheduleEvent) => {
    // Only allow selecting accepted study sessions
    if (ensureValidEventType(event.type) === 'STUDY' && event.isAcceptedStudySession) {
      if (selectedSession && selectedSession.id === event.id) {
        // If we click the same session again, deselect it
        setSelectedSession(null);
        setMovingSession(false);
      } else {
        // Select the session and enable moving mode
        setSelectedSession(event);
        setMovingSession(true);
      }
    }
  };

  // Handle clicking on an empty cell to move the selected study session
  const handleCellClick = async (day: string, hour: number) => {
    if (!movingSession || !selectedSession || !selectedSession.id || !user) {
      return;
    }

    try {
      // Get the current week start date from the first day of the current week
      // Since we don't have direct access to weekStartDate in the ScheduleEvent type,
      // we'll use the startDate of the event to calculate the start of the week
      const eventDate = selectedSession.startDate ? new Date(selectedSession.startDate) : new Date();
      const weekStartDate = new Date(eventDate);
      const dayOfWeek = eventDate.getDay();
      const diff = eventDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust for Sunday
      weekStartDate.setDate(diff);
      weekStartDate.setHours(0, 0, 0, 0);
      
      // Reset moving state immediately to prevent multiple clicks
      setMovingSession(false);
      
      // Call the API to relocate the study session
      const success = await relocateStudySession(
        selectedSession.id,
        day,
        hour,
        user.username,
        weekStartDate
      );

      if (success) {
        // Clear selection
        setSelectedSession(null);
        
        // Show success message
        setSuccessMessage(`Study session moved to ${day} at ${hour}:00`);
        
        // Notify parent component to refresh data
        if (onScheduleUpdated) {
          onScheduleUpdated();
        }
      } else {
        console.error('Failed to relocate study session');
      }
    } catch (error) {
      console.error('Error relocating study session:', error);
    }
  };
  
  // Function to format event title for display
  const formatEventTitle = (event: ScheduleEvent): string | JSX.Element => {
    const title = event.title || 'Untitled Event';
    
    // For multi-hour events, we might want to show additional information
    const isMultiHourEvent = event.startDate && event.endDate && 
      (new Date(event.endDate).getTime() - new Date(event.startDate).getTime()) / (1000 * 60 * 60) > 1;
    
    // For lectures and labs, show a more descriptive title with the course code
    if ((event.isLecture || event.isLab) && title.includes(':')) {
      const [courseCode, remainder] = title.split(':');
      const formattedRemainder = remainder.length > 25 ? remainder.substring(0, 25) : remainder;
      
      // Always use the JSX format for lectures and labs for consistency
      return (
        <>
          <span>{courseCode}</span>
          <div>{formattedRemainder}</div>
        </>
      );
    }
    
    // For work and leisure events, allow text wrapping
    const isWorkOrLeisure = 
      (event.type && ['WORK', 'LEISURE'].includes(event.type.toUpperCase())) ||
      (event.title && (event.title.toLowerCase().includes('work') || 
                      event.title.toLowerCase().includes('leisure') || 
                      event.title.toLowerCase().includes('job')));
    
    if (isWorkOrLeisure) {
      return (
        <>
          <span>{title.length > 20 ? title.substring(0, 20) : title}</span>
          {isMultiHourEvent && event.description && (
            <div>{event.description.substring(0, 30)}</div>
          )}
        </>
      );
    }
    
    // For study sessions, keep it very short
    if (ensureValidEventType(event.type) === 'STUDY' || title.toLowerCase().includes('study')) {
      return 'Study';
    }
    
    // Otherwise just return the title, possibly truncated
    if (title.length > 15) {
      return isMultiHourEvent ? 
        title.substring(0, 20) : 
        title.substring(0, 12) + '...';
    }
    
    return title;
  };

  // Function to generate tooltip content
  const generateTooltip = (event: ScheduleEvent): string => {
    const parts = [
      event.title,
      event.description || '',
      event.location || '',
      `Type: ${event.isLecture ? 'LECTURE' : ensureValidEventType(event.type)}`
    ];
    
    if (event.isLecture) {
      parts.push('Click to submit quiz score');
    } else if (ensureValidEventType(event.type) === 'STUDY' && event.isAcceptedStudySession) {
      parts.push('Click to select and move this study session');
    }
    
    return parts.filter(Boolean).join('\n');
  };

  // Function to handle event click
  const handleEventClick = (event: ScheduleEvent) => {
    if (event.isLecture && onEventClick) {
      onEventClick(event);
    } else if (ensureValidEventType(event.type) === 'STUDY' && event.isAcceptedStudySession) {
      handleStudySessionClick(event);
    }
  };
  
  // Check if a lecture has a quiz score
  const hasQuizScore = (event: ScheduleEvent): boolean => {
    if (!event.id || !event.isLecture) return false;
    
    // First check if this lecture ID is in the recentlyCompletedLectures array
    // This allows for immediate UI updates after quiz submission
    if (recentlyCompletedLectures.includes(event.id)) {
      return true;
    }
    
    // Check if we have a lecture-specific score in the lectureProgressMap
    if (lectureProgressMap[event.id] === true) {
      return true;
    }
    
    // Also check the general progress map for this specific lecture ID
    if (progressMap[event.id] === true) {
      return true;
    }
    
    return false;
  };

  // Function to calculate the height of an event based on its duration
  const calculateEventHeight = (event: ScheduleEvent): string => {
    // Default height for a one-hour event (slightly less than cell height to add spacing)
    const oneHourHeight = 42;
    const cellHeight = 45; // Should match the CSS cell height
    
    // Force study sessions to be smaller
    if (ensureValidEventType(event.type) === 'STUDY' || (event.title && event.title.toLowerCase().includes('study'))) {
      return `${oneHourHeight - 12}px`;
    }
    
    // If the event doesn't have start and end dates, use default height
    if (!event.startDate || !event.endDate) return `${oneHourHeight}px`;
    
    try {
      // Parse dates
      const startDate = new Date(event.startDate);
      const endDate = new Date(event.endDate);
      
      // Calculate duration in hours (use exact calculation including minutes)
      const durationMs = endDate.getTime() - startDate.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);
      
      // If the duration is invalid or too short, use default height
      if (isNaN(durationHours) || durationHours <= 0) return `${oneHourHeight}px`;
      
      // Calculate height based on duration 
      // For multi-hour events, calculate height precisely based on the number of cells it spans
      const hourCells = Math.ceil(durationHours);
      
      // Calculate height by multiplying the number of cells by the cell height
      // Subtract a small amount for borders
      const heightValue = hourCells * cellHeight - 3;
      
      return `${heightValue}px`;
    } catch (e) {
      console.error('Error calculating event height:', e);
      return `${oneHourHeight}px`;
    }
  };
  
  // Function to calculate the position based on duration
  const calculateEventPosition = (event: ScheduleEvent): React.CSSProperties => {
    // Default styles
    const styles: React.CSSProperties = {
      height: calculateEventHeight(event),
      backgroundColor: getBackgroundColor(event),
      cursor: event.isLecture ? 'pointer' : 'default',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    };

    // Add highlighting for selected study session
    if (selectedSession && event.id === selectedSession.id) {
      styles.border = '2px solid #ff9800';
      styles.boxShadow = '0 0 8px rgba(255, 152, 0, 0.7)';
    }
    
    // Make study sessions look clickable
    if (ensureValidEventType(event.type) === 'STUDY' && event.isAcceptedStudySession) {
      styles.cursor = 'pointer';
    }
    
    // Check if this is a multi-hour event (longer than 1 hour)
    let isMultiHourEvent = false;
    let durationHours = 1;
    
    // Use the pre-calculated duration if available
    if (event.duration && event.duration > 1) {
      isMultiHourEvent = true;
      durationHours = event.duration;
    } 
    // Fallback to calculating from dates
    else if (event.startDate && event.endDate) {
      try {
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);
        durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
        
        if (durationHours > 1) {
          isMultiHourEvent = true;
        }
      } catch (e) {
        console.error('Error calculating event duration:', e);
      }
    }
    
    // For single-hour events, provide standard padding
    if (!isMultiHourEvent) {
      // Study sessions have less padding for compact display
      if (ensureValidEventType(event.type) === 'STUDY' || (event.title && event.title.toLowerCase().includes('study'))) {
        styles.padding = '4px 6px';
      } 
      // Work/leisure events need specific styling
      else if (isWorkOrLeisure(event)) {
        styles.padding = '5px 8px';
        styles.flexDirection = 'column';
      }
      else {
        // Regular single-hour events get more padding
        styles.padding = '6px 8px';
      }
    }
    // For multi-hour events, add additional styling
    else {
      styles.flexDirection = 'column';
      styles.padding = '8px 10px'; // Increased horizontal padding
      
      // Work/leisure specific styling for multi-hour events
      if (isWorkOrLeisure(event)) {
        styles.textAlign = 'center';
      }
    }
    
    return styles;
  };

  // Helper function to determine if an event is work or leisure
  const isWorkOrLeisure = (event: ScheduleEvent): boolean => {
    // Check if the type is explicitly WORK or LEISURE
    if (event.type && ['WORK', 'LEISURE'].includes(event.type.toUpperCase())) {
      return true;
    }
    
    // Check if the title contains work-related terms
    if (event.title && (
      event.title.toLowerCase().includes('work') || 
      event.title.toLowerCase().includes('leisure') || 
      event.title.toLowerCase().includes('job')
    )) {
      return true;
    }
    
    // Check if the description contains work-related terms
    if (event.description && (
      event.description.toLowerCase().includes('work') ||
      event.description.toLowerCase().includes('leisure') ||
      event.description.toLowerCase().includes('job')
    )) {
      return true;
    }
    
    return false;
  };

  // Function to determine background color
  const getBackgroundColor = (event: ScheduleEvent): string => {
    // For work events, let CSS class handle the color
    if (isWorkOrLeisure(event) || ensureValidEventType(event.type) === 'WORK') {
      return 'transparent'; // Let CSS class handle the color
    }

    // For lectures with completed quizzes, use a lighter version of the color
    if (event.isLecture && hasQuizScore(event)) {
      return '#d2b5e8'; // Lighter purple for completed lectures
    }
    
    // Check if it's a lecture or lab
    if (event.isLecture) {
      return eventTypeColors.LECTURE;
    }
    if (event.isLab) {
      return eventTypeColors.LAB;
    }
    
    // Study sessions already have CSS classes
    if (ensureValidEventType(event.type) === 'STUDY') {
      return 'transparent'; // Let CSS class handle the color
    }
    
    // Learning sessions
    if (ensureValidEventType(event.type) === 'LEARNING') {
      return eventTypeColors.LEARNING;
    }
    
    // For all other events, use the type-based coloring
    const type = ensureValidEventType(event.type || 'OTHER');
    return eventTypeColors[type] || eventTypeColors.default;
  };

  return (
    <div className="schedule-grid">
      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}
      <div className="time-column">
        <div className="header-cell">Time</div>
        {hours.map(hour => (
          <div key={hour} className="time-cell">
            {hour.toString().padStart(2, '0')}:00
          </div>
        ))}
      </div>
      {weekDays.map(day => (
        <div key={day} className="day-column">
          <div className="header-cell">{day}</div>
          {hours.map(hour => (
            <div 
              key={`${day}-${hour}`} 
              className={`schedule-cell ${movingSession ? 'moving-enabled' : ''}`}
              onClick={movingSession ? () => handleCellClick(day, hour) : undefined}
            >
              {processedSchedule && processedSchedule[day] && processedSchedule[day][hour] 
                ? processedSchedule[day][hour]
                  .filter((event: ScheduleEvent) => event.isStart === true)
                  .map((event: ScheduleEvent) => {
                    const isLecture = event.isLecture;
                    const hasCompleted = isLecture && hasQuizScore(event);
                    
                    let eventClasses = `event-item`;
                    if (isLecture) eventClasses += ' lecture';
                    if (event.isLab) eventClasses += ' lab';
                    if (hasCompleted) eventClasses += ' completed-quiz';

                    // Add work class for work and leisure events
                    const eventType = ensureValidEventType(event.type);
                    if (eventType === 'WORK' || isWorkOrLeisure(event)) {
                      eventClasses += ' work';
                    }

                    if (eventType === 'STUDY' || (event.title && event.title.toLowerCase().includes('study'))) {
                      eventClasses += ' study';
                      // Add selected class if this is the selected session
                      if (selectedSession && event.id === selectedSession.id) {
                        eventClasses += ' study-selected';
                      }
                    }
                    
                    // Get the duration for tooltip
                    let durationInfo = "";
                    if (event.startDate && event.endDate) {
                      try {
                        const start = new Date(event.startDate);
                        const end = new Date(event.endDate);
                        const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                        durationInfo = ` (${durationHours} hours)`;
                      } catch (e) {}
                    }
                    
                    return (
                      <div
                        key={event.id}
                        className={eventClasses}
                        onClick={() => handleEventClick(event)}
                        style={calculateEventPosition(event)}
                        data-tooltip={generateTooltip(event) + durationInfo}
                      >
                        <div className="event-content">
                          {formatEventTitle(event)}
                          {hasCompleted && (
                            <span className="completion-indicator">✓</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                : null}
            </div>
          ))}
        </div>
      ))}
      {movingSession && (
        <div className="moving-overlay">
          <div className="moving-message">
            Select a new time slot to move the study session
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleGrid; 