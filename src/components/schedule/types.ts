import type { Schema } from "../../../amplify/data/resource";

// Base event type from the schema
export type BaseEvent = Schema["CalendarEvent"]["type"];
export type Lecture = Schema["Lectures"]["type"];

// Define Event as a standalone interface instead of extending BaseEvent
export interface Event {
  id: string;
  title: string;
  description: string;
  type: 'WORK' | 'STUDY' | 'MEETING' | 'OTHER';
  startDate: string;
  endDate: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
  isLecture?: boolean;
  isLab?: boolean;
  userId?: string;
}

export interface ScheduleEvent extends Event {
  isStart?: boolean;
  isAcceptedStudySession?: boolean;
}

// Event type definitions
export type EventType = 'WORK' | 'STUDY' | 'MEETING' | 'OTHER' | 'LECTURE' | 'LAB';

// Color mapping for different event types
export const eventTypeColors = {
  WORK: '#e74c3c',    // red for work
  STUDY: '#3498db',   // blue for study
  MEETING: '#2ecc71', // green for meetings
  OTHER: '#f39c12',   // orange for other events
  LECTURE: '#9b59b6', // purple for lectures
  LAB: '#1abc9c',     // teal for labs
  default: '#95a5a6'  // grey for unknown types
};

// Constants for schedule
export const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const hours = Array.from({ length: 15 }, (_, i) => i + 8); // 8 AM to 10 PM 