import React from 'react';
import { WeeklySchedule } from './schedule';
import type { Schema } from "../../amplify/data/resource";
import { useAuthenticator } from '@aws-amplify/ui-react';
import './WeeklySchedule.css';

type Event = Schema["CalendarEvent"]["type"];

interface WeeklyScheduleWrapperProps {
  events?: Event[];
  userId?: string;
}

// This is just a wrapper component to maintain backward compatibility
const WeeklyScheduleWrapper: React.FC<WeeklyScheduleWrapperProps> = ({ events, userId }) => {
  const { user } = useAuthenticator();
  
  // Use provided userId or fall back to authenticated user's ID
  const effectiveUserId = userId || user?.username || '';
  
  console.log('WeeklyScheduleWrapper - passing events:', events?.length || 0);
  
  return (
    <div className="weekly-schedule-wrapper">
      {(!events || events.length === 0) && (
        <div className="instructions-text">
          <p><strong>Welcome to your Weekly Schedule!</strong></p>
          <p>This is where you can view your events and generate optimized study sessions based on your availability.</p>
          <ul>
            <li>Your course schedule is automatically synchronized and displayed here</li>
            <li>Use the "<strong>Generate Study Sessions</strong>" button to create AI-optimized study blocks</li>
            <li>Click on green study sessions to track your learning progress</li>
          </ul>
        </div>
      )}
      <WeeklySchedule events={events} userId={effectiveUserId} />
    </div>
  );
};

export default WeeklyScheduleWrapper; 