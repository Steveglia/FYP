import type { Schema } from "../../../amplify/data/resource";

// Base event type from the schema
export type BaseEvent = Schema["CalendarEvent"]["type"];
export type Lecture = Schema["Lectures"]["type"];

// Extended event type with additional properties
export interface Event extends Omit<BaseEvent, 'type'> {
  isLecture?: boolean;
  isLab?: boolean;
  userId?: string;
  type?: 'WORK' | 'STUDY' | 'MEETING' | 'OTHER' | 'LECTURE' | 'LAB' | 'LEARNING' | null;
}

export interface ScheduleEvent extends Event {
  isStart?: boolean;
  isAcceptedStudySession?: boolean;
  duration?: number; // Duration in hours
  lectureId?: string; // Associated lecture ID
  courseId?: string; // Associated course ID
}

// Event type definitions for our application
export type EventType = 'WORK' | 'STUDY' | 'MEETING' | 'OTHER' | 'LECTURE' | 'LAB' | 'LEARNING';

// Color mapping for different event types
export const eventTypeColors = {
  WORK: '#e74c3c',    // red for work
  STUDY: '#3498db',   // blue for study
  MEETING: '#2ecc71', // green for meetings
  OTHER: '#f39c12',   // orange for other events
  LECTURE: '#9b59b6', // purple for lectures
  LAB: '#1abc9c',     // teal for labs
  LEARNING: '#6aa84f', // green for personal learning
  default: '#95a5a6'  // grey for unknown types
};

// Constants for schedule
export const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const hours = Array.from({ length: 15 }, (_, i) => i + 8); // 8 AM to 10 PM 

// Utility function to safely convert event type
export function ensureValidEventType(type: string | null | undefined): EventType {
  if (!type) return 'OTHER';
  
  // Check if the type is one of the valid EventType values
  if (type === 'WORK' || 
      type === 'STUDY' || 
      type === 'MEETING' || 
      type === 'OTHER' || 
      type === 'LECTURE' || 
      type === 'LAB' ||
      type === 'LEARNING') {
    return type;
  }
  
  return 'OTHER';
} 