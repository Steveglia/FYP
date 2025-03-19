import React, { useEffect, useState, useMemo } from 'react';
import { ScheduleEvent, weekDays, hours, eventTypeColors, ensureValidEventType } from './types';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from "../../../amplify/data/resource";
import { useAuthenticator } from '@aws-amplify/ui-react';

const client = generateClient<Schema>();

interface ScheduleGridProps {
  eventsByDayAndTime: { [key: string]: { [key: string]: ScheduleEvent[] } };
  onEventClick?: (event: ScheduleEvent) => void;
  recentlyCompletedLectures?: string[]; // New prop to track recently completed lectures
}

const ScheduleGrid: React.FC<ScheduleGridProps> = ({ 
  eventsByDayAndTime, 
  onEventClick,
  recentlyCompletedLectures = [] // Default to empty array
}) => {
  const { user } = useAuthenticator();
  const [progressMap, setProgressMap] = useState<Record<string, boolean>>({});
  const [lectureProgressMap, setLectureProgressMap] = useState<Record<string, boolean>>({});
  
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
    }
    
    return parts.filter(Boolean).join('\n');
  };

  // Function to handle event click
  const handleEventClick = (event: ScheduleEvent) => {
    if (event.isLecture && onEventClick) {
      onEventClick(event);
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
      } else {
        // Regular single-hour events get more padding
        styles.padding = '6px 8px';
      }
    }
    // For multi-hour events, add additional styling
    else {
      styles.flexDirection = 'column';
      styles.padding = '8px 10px'; // Increased horizontal padding
    }
    
    return styles;
  };

  // Function to get the background color based on event type
  const getBackgroundColor = (event: ScheduleEvent): string => {
    if (event.isLecture) {
      return eventTypeColors.LECTURE;
    }
    if (event.isLab) {
      return eventTypeColors.LAB;
    }
    
    const eventType = ensureValidEventType(event.type) as keyof typeof eventTypeColors;
    return eventTypeColors[eventType] || eventTypeColors.default;
  };

  // List of days to display in the grid
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  // Simplify the processedSchedule useMemo
  const processedSchedule = useMemo(() => {
    return JSON.parse(JSON.stringify(eventsByDayAndTime));
  }, [eventsByDayAndTime]);

  return (
    <div className="schedule-grid">
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
            <div key={`${day}-${hour}`} className="schedule-cell">
              {processedSchedule && processedSchedule[day] && processedSchedule[day][hour] 
                ? processedSchedule[day][hour]
                  .filter((event: ScheduleEvent) => event.isStart === true)
                  .map((event: ScheduleEvent, index: number) => {
                    const isLecture = event.isLecture;
                    const hasCompleted = isLecture && hasQuizScore(event);
                    
                    let eventClasses = `event-item`;
                    if (isLecture) eventClasses += ' lecture';
                    if (event.isLab) eventClasses += ' lab';
                    if (hasCompleted) eventClasses += ' completed-quiz';
                    if (ensureValidEventType(event.type) === 'STUDY' || (event.title && event.title.toLowerCase().includes('study'))) {
                      eventClasses += ' study';
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
    </div>
  );
};

export default ScheduleGrid; 