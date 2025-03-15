import React from 'react';
import WeeklySchedule from './schedule/WeeklySchedule';
import type { Schema } from "../../amplify/data/resource";
import { useAuthenticator } from '@aws-amplify/ui-react';

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
  
  return <WeeklySchedule events={events} userId={effectiveUserId} />;
};

export default WeeklyScheduleWrapper; 