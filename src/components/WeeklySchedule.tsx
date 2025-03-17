import React from 'react';
import WeeklySchedule from './schedule/WeeklySchedule';
import type { Schema } from "../../amplify/data/resource";
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Event as CustomEvent } from './schedule/types';

type SchemaEvent = Schema["CalendarEvent"]["type"];

interface WeeklyScheduleWrapperProps {
  events?: SchemaEvent[];
  userId?: string;
}

// This is just a wrapper component to maintain backward compatibility
const WeeklyScheduleWrapper: React.FC<WeeklyScheduleWrapperProps> = ({ events, userId }) => {
  const { user } = useAuthenticator();
  
  // Use provided userId or fall back to authenticated user's ID
  const effectiveUserId = userId || user?.username || '';
  
  console.log('WeeklyScheduleWrapper - passing events:', events?.length || 0);
  
  // Convert Schema events to CustomEvent type
  const convertedEvents = events?.map(event => ({
    id: event.id || '',
    title: event.title || '',
    description: event.description || '',
    type: event.type || 'OTHER',
    startDate: event.startDate || '',
    endDate: event.endDate || '',
    location: event.location,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt
  } as CustomEvent));
  
  return <WeeklySchedule events={convertedEvents} userId={effectiveUserId} />;
};

export default WeeklyScheduleWrapper; 