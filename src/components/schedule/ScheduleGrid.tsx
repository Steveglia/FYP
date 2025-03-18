import React, { useEffect, useState } from 'react';
import { ScheduleEvent, weekDays, hours } from './types';
import { calculateEventHeight, getEventColor } from './utils';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from "../../../amplify/data/resource";
import { useAuthenticator } from '@aws-amplify/ui-react';

const client = generateClient<Schema>();

interface ScheduleGridProps {
  eventsByDayAndTime: { [key: string]: { [key: string]: ScheduleEvent[] } };
  onEventClick?: (event: ScheduleEvent) => void;
}

const ScheduleGrid: React.FC<ScheduleGridProps> = ({ 
  eventsByDayAndTime, 
  onEventClick 
}) => {
  const { user } = useAuthenticator();
  const [progressMap, setProgressMap] = useState<Record<string, boolean>>({});
  
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
          
          // Mark courses that have quiz scores
          result.data.forEach(progress => {
            if (progress.quizScores && progress.quizScores > 0 && progress.courseId) {
              // Associate the course ID with having a score
              progressTracker[progress.courseId] = true;
              
              // If we have specific lecture IDs in the completedLectures array, mark those as well
              if (progress.completedLectures) {
                progress.completedLectures.forEach(lectureId => {
                  if (lectureId) {
                    progressTracker[lectureId] = true;
                  }
                });
              }
            }
          });
          
          setProgressMap(progressTracker);
        }
      } catch (error) {
        console.error('Error fetching progress data:', error);
      }
    };
    
    fetchProgressData();
  }, [user]);
  
  // Function to format event title for display
  const formatEventTitle = (event: ScheduleEvent): string => {
    return event.title || 'Untitled Event';
  };

  // Function to generate tooltip content
  const generateTooltip = (event: ScheduleEvent): string => {
    const parts = [
      event.title,
      event.description || '',
      event.location || '',
      `Type: ${event.isLecture ? 'LECTURE' : event.type}`
    ];
    
    if (event.isAcceptedStudySession) {
      parts.push('Click to track progress');
    }
    
    return parts.filter(Boolean).join('\n');
  };

  // Function to handle event click
  const handleEventClick = (event: ScheduleEvent) => {
    if (event.isAcceptedStudySession && onEventClick) {
      onEventClick(event);
    }
  };
  
  // Check if a lecture has a quiz score
  const hasQuizScore = (event: ScheduleEvent): boolean => {
    if (!event.id || !event.isLecture) return false;
    
    // Check if the lecture ID directly has a score
    if (progressMap[event.id] === true) return true;
    
    // Check if the course has a score (extracted from lecture title)
    if (event.title) {
      const courseId = event.title.split(':')[0]?.trim();
      if (courseId && progressMap[courseId] === true) return true;
    }
    
    return false;
  };

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
              {eventsByDayAndTime[day][hour]
                .filter((event): event is ScheduleEvent => event.isStart === true)
                .map(event => {
                  const eventScored = hasQuizScore(event);
                  
                  return (
                    <div 
                      key={event.id} 
                      className={`event-item ${event.isAcceptedStudySession ? 'accepted-study' : ''} ${eventScored ? 'has-progress' : ''}`}
                      style={{ 
                        height: calculateEventHeight(event),
                        marginTop: '2px',
                        backgroundColor: event.isAcceptedStudySession ? '#4caf50' : getEventColor(event),
                        color: '#ffffff',
                        padding: '4px',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        cursor: event.isAcceptedStudySession ? 'pointer' : 'default'
                      }}
                      title={generateTooltip(event)}
                      onClick={() => handleEventClick(event)}
                    >
                      <div className="event-content">
                        {formatEventTitle(event)}
                        {eventScored && (
                          <span className="progress-indicator" title="You've completed a quiz for this lecture">✓</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default ScheduleGrid; 