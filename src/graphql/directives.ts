import { generateClient } from "@aws-amplify/api";
import type { GraphQLResult } from "@aws-amplify/api-graphql";
import type { Schema } from "../../amplify/data/resource";

const client = generateClient<Schema>();

// Define interface for the scheduled reviews query result
export interface ScheduledReviewItem {
  id: string;
  userId: string;
  courseId: string;
  lectureId: string;
  reviewDate: string;
  halfLife: number;
  lastScore: number;
  lastReviewDate: string;
  studyCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledReviewsResult {
  listScheduledReviews: {
    items: ScheduledReviewItem[];
    nextToken: string | null;
  };
}

// Define interface for calendar event query result
export interface CalendarEventItem {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  type: string;
}

export interface CalendarEventResult {
  getCalendarEvent: CalendarEventItem;
}

// Define GraphQL queries for ScheduledReviews
export const listScheduledReviewsByUser = /* GraphQL */ `
  query ListScheduledReviewsByUser(
    $userId: String!
    $nextToken: String
  ) {
    listScheduledReviews(
      filter: { userId: { eq: $userId } }
      nextToken: $nextToken
    ) {
      items {
        id
        userId
        courseId
        lectureId
        reviewDate
        halfLife
        lastScore
        lastReviewDate
        studyCount
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;

export const getCalendarEvent = /* GraphQL */ `
  query GetCalendarEvent($id: ID!) {
    getCalendarEvent(id: $id) {
      id
      title
      description
      startDate
      endDate
      location
      type
    }
  }
`;

// Helper function to query scheduled reviews by user
export const fetchScheduledReviewsByUser = async (userId: string): Promise<GraphQLResult<ScheduledReviewsResult>> => {
  try {
    const result = await client.graphql({
      query: listScheduledReviewsByUser,
      variables: { userId }
    });
    return result as GraphQLResult<ScheduledReviewsResult>;
  } catch (error) {
    console.error("Error fetching scheduled reviews:", error);
    throw error;
  }
};

// Helper function to get calendar event by ID
export const fetchCalendarEvent = async (id: string): Promise<GraphQLResult<CalendarEventResult>> => {
  try {
    const result = await client.graphql({
      query: getCalendarEvent,
      variables: { id }
    });
    return result as GraphQLResult<CalendarEventResult>;
  } catch (error) {
    console.error("Error fetching calendar event:", error);
    throw error;
  }
}; 