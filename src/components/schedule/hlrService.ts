import { generateClient } from "aws-amplify/api";
import type { Schema } from "../../../amplify/data/resource";

const client = generateClient<Schema>();

/**
 * Get lecture metadata including difficulty and duration
 * 
 * @param lectureId - ID of the lecture
 * @returns Object containing lecture metadata
 */
export const getLectureMetadata = async (lectureId: string) => {
  try {
    // Try to get lecture from Lectures model first
    const lectureResult = await client.models.Lectures.get({ id: lectureId });
    
    if (lectureResult.data) {
      // Return metadata from Lectures model
      return {
        difficulty: parseInt(lectureResult.data.difficulty || '3', 10),
        duration: parseInt(lectureResult.data.duration || '30', 10),
        title: lectureResult.data.title,
        content: lectureResult.data.content
      };
    }
    
    // If not found in Lectures, try CalendarEvent
    const calendarResult = await client.models.CalendarEvent.get({ id: lectureId });
    
    if (calendarResult.data) {
      // Extract difficulty from description if possible (format: "Difficulty: X")
      const difficultyMatch = calendarResult.data.description?.match(/difficulty:\s*(\d+)/i);
      const extractedDifficulty = difficultyMatch ? parseInt(difficultyMatch[1], 10) : 3;
      
      // Calculate duration in minutes from start/end times
      let duration = 30; // Default
      if (calendarResult.data.startDate && calendarResult.data.endDate) {
        const start = new Date(calendarResult.data.startDate);
        const end = new Date(calendarResult.data.endDate);
        duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
      }
      
      return {
        difficulty: extractedDifficulty,
        duration: duration,
        title: calendarResult.data.title,
        description: calendarResult.data.description
      };
    }
    
    // Return default values if lecture not found
    return {
      difficulty: 3,
      duration: 30,
      title: '',
      description: ''
    };
  } catch (error) {
    console.error("Error fetching lecture metadata:", error);
    // Return default values on error
    return {
      difficulty: 3,
      duration: 30,
      title: '',
      description: ''
    };
  }
};

/**
 * Calculate half-life based on user performance using the Half-Life Regression model
 * 
 * @param score - Test score (0-100)
 * @param studyDuration - Time spent studying in minutes
 * @param taskComplexity - Complexity rating (1-5)
 * @param timeSinceLastReview - Time since last review in days
 * @param previousHalfLife - Previous half-life in days (if available)
 * @param studyCount - Number of times this material has been studied
 * @returns Half-life in days
 */
export const calculateHalfLife = (
  score: number,
  studyDuration: number,
  taskComplexity: number,
  timeSinceLastReview: number,
  previousHalfLife?: number,
  studyCount: number = 1
): number => {
  // Normalize score to 0-1 range
  const normalizedScore = score / 100;
  
  // Base half-life calculation
  let baseHalfLife = 2 * normalizedScore * studyDuration / taskComplexity;
  
  // Adjust for spacing effect - longer intervals lead to stronger memories
  if (timeSinceLastReview > 0) {
    baseHalfLife *= (1 + 0.1 * timeSinceLastReview);
  }
  
  // Adjust for previous half-life (if available)
  if (previousHalfLife && previousHalfLife > 0) {
    baseHalfLife = (baseHalfLife + previousHalfLife) / 2;
  }
  
  // Apply study count modifier - retention improves with repetition
  baseHalfLife *= (1 + 0.2 * (studyCount - 1));
  
  // Ensure minimum half-life is 1 day
  return Math.max(1, baseHalfLife);
};

/**
 * Schedule the next review session based on the calculated half-life
 * 
 * @param halfLife - Half-life in days
 * @param quizDate - Date when the quiz was taken (defaults to current date if not provided)
 * @returns Date object for the next review
 */
export const scheduleNextReview = (halfLife: number, quizDate?: Date | string): Date => {
  // Use provided quiz date or fall back to current date
  const baseDate = quizDate ? new Date(quizDate) : new Date();
  
  // Add the half-life in days to the base date
  const nextReviewDate = new Date(baseDate.getTime() + (halfLife * 24 * 60 * 60 * 1000));
  return nextReviewDate;
};

/**
 * Estimate study duration based on lecture data
 * This implementation tries to use lecture metadata when available
 * 
 * @param lectureId - ID of the lecture
 * @param lectureTitle - Title of the lecture (fallback)
 * @param lectureDescription - Description of the lecture (fallback)
 * @returns Estimated study duration in minutes
 */
export const estimateStudyDuration = async (
  lectureId?: string,
  lectureTitle?: string, 
  lectureDescription?: string
): Promise<number> => {
  // If we have lecture ID, try to get metadata
  if (lectureId) {
    try {
      const metadata = await getLectureMetadata(lectureId);
      if (metadata.duration > 0) {
        // Return actual lecture duration as base study time
        // Adjust by a factor to get recommended study time (e.g., 1.5x lecture time)
        return metadata.duration * 1.5;
      }
    } catch (error) {
      console.error('Error getting lecture duration:', error);
    }
  }
  
  // Fallbacks if no metadata or error occurred
  
  // Check if the title or description gives hints about the duration
  const content = `${lectureTitle || ''} ${lectureDescription || ''}`.toLowerCase();
  
  if (content.includes('introduction') || content.includes('overview')) {
    return 20; // Introductory content tends to be shorter
  } else if (content.includes('advanced') || content.includes('complex')) {
    return 45; // Advanced topics may need more study time
  } else if (content.includes('workshop') || content.includes('practical')) {
    return 60; // Practical sessions typically take longer
  }
  
  // Default to 30 minutes if no other information is available
  return 30;
};

/**
 * Estimate task complexity based on lecture data
 * This implementation tries to use lecture metadata when available
 * 
 * @param lectureId - ID of the lecture
 * @param lectureTitle - Title of the lecture (fallback)
 * @param lectureDescription - Description of the lecture (fallback)
 * @returns Complexity rating (1-5)
 */
export const estimateTaskComplexity = async (
  lectureId?: string,
  lectureTitle?: string, 
  lectureDescription?: string
): Promise<number> => {
  // If we have lecture ID, try to get metadata
  if (lectureId) {
    try {
      const metadata = await getLectureMetadata(lectureId);
      if (metadata.difficulty > 0) {
        // Return actual lecture difficulty if available
        // Ensure it's in the 1-5 range
        return Math.min(5, Math.max(1, metadata.difficulty));
      }
    } catch (error) {
      console.error('Error getting lecture complexity:', error);
    }
  }
  
  // Fallback to keyword-based complexity estimation
  const complexityKeywords = [
    // Level 5 (most complex)
    ['quantum', 'algorithm', 'neural network', 'differential equation', 'genome', 'theorem'],
    // Level 4
    ['advanced', 'complex', 'framework', 'architecture', 'implementation', 'analysis'],
    // Level 3
    ['concept', 'model', 'system', 'function', 'process', 'structure'],
    // Level 2
    ['principle', 'method', 'basic', 'technique', 'application', 'simple'],
    // Level 1 (least complex)
    ['introduction', 'overview', 'fundamentals', 'beginner', 'basic', 'review']
  ];
  
  const content = `${lectureTitle || ''} ${lectureDescription || ''}`.toLowerCase();
  
  // Check for matches starting from most complex
  for (let level = 0; level < complexityKeywords.length; level++) {
    if (complexityKeywords[level].some(keyword => content.includes(keyword))) {
      return 5 - level; // Convert to 1-5 scale (5 being most complex)
    }
  }
  
  // Default to medium complexity if no keywords match
  return 3;
};

/**
 * Save or update a scheduled review for a user
 * 
 * @param userId - ID of the user
 * @param courseId - ID of the course
 * @param lectureId - ID of the lecture
 * @param score - Quiz score (0-100)
 * @param studyCount - Number of times this lecture has been studied
 * @param quizDate - Date when the quiz was taken (defaults to current date if not provided)
 * @returns Whether the review was successfully scheduled
 */
export const saveScheduledReview = async (
  userId: string,
  courseId: string,
  lectureId: string,
  score: number,
  studyCount: number = 1,
  quizDate?: Date | string
): Promise<boolean> => {
  try {
    // If quizDate is not provided, use current date
    const quizDateTime = quizDate ? new Date(quizDate) : new Date();
    const lastReviewDate = quizDateTime.toISOString();
    
    // Get lecture metadata for better calculations
    const metadata = await getLectureMetadata(lectureId);
    
    // Calculate estimated task complexity based on lecture data
    const taskComplexity = await estimateTaskComplexity(
      lectureId, 
      metadata.title || undefined, 
      metadata.description || undefined
    );
    
    // Estimate study duration based on lecture data
    const studyDuration = await estimateStudyDuration(
      lectureId,
      metadata.title || undefined,
      metadata.description || undefined
    );
    
    // Get time since last review (in days)
    const timeSinceLastReview = await getTimeSinceLastReview(userId, lectureId);
    
    // Calculate half-life based on performance and other factors
    const halfLife = calculateHalfLife(score, studyDuration, taskComplexity, timeSinceLastReview);
    
    // Schedule next review date using the quiz date
    const reviewDate = scheduleNextReview(halfLife, quizDateTime);
    
    // First try to update an existing record for this specific lecture
    const existingReviews = await client.models.ScheduledReviews.list({
      filter: {
        userId: { eq: userId },
        lectureId: { eq: lectureId }
      }
    });
    
    if (existingReviews.data.length > 0) {
      // Update existing record for this lecture
      const existingReview = existingReviews.data[0];
      await client.models.ScheduledReviews.update({
        id: existingReview.id,
        userId,
        courseId,
        lectureId,
        reviewDate: reviewDate.toISOString(),
        halfLife,
        lastScore: score,
        lastReviewDate,
        studyCount
      });
      console.log(`Updated scheduled review for lecture: ${lectureId} with next review on ${reviewDate.toLocaleString()}`);
    } else {
      // Create new record for this lecture
      await client.models.ScheduledReviews.create({
        userId,
        courseId,
        lectureId,
        reviewDate: reviewDate.toISOString(),
        halfLife,
        lastScore: score,
        lastReviewDate,
        studyCount
      });
      console.log(`Created new scheduled review for lecture: ${lectureId} with next review on ${reviewDate.toLocaleString()}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error saving scheduled review:', error);
    return false;
  }
};

/**
 * Get all scheduled reviews for a user
 * 
 * @param userId - User ID
 * @returns Promise resolving to an array of scheduled reviews
 */
export const getScheduledReviews = async (userId: string) => {
  try {
    console.log("Fetching scheduled reviews for user:", userId);
    
    const response = await client.models.ScheduledReviews.list({
      filter: {
        userId: { eq: userId }
      }
    });
    
    console.log("Scheduled reviews result:", response);
    return response.data || [];
  } catch (error) {
    console.error("Error getting scheduled reviews:", error);
    throw error;
  }
};

/**
 * Calculate time since last review for a specific lecture
 * 
 * @param userId - ID of the user
 * @param lectureId - ID of the lecture
 * @returns Time since last review in days
 */
export const getTimeSinceLastReview = async (userId: string, lectureId: string): Promise<number> => {
  try {
    // Try to find the most recent review record for this user and lecture
    const existingReviews = await client.models.ScheduledReviews.list({
      filter: {
        userId: { eq: userId },
        lectureId: { eq: lectureId }
      }
    });
    
    if (existingReviews.data.length > 0) {
      // Get the last review date from the existing record
      const lastReviewDate = existingReviews.data[0].lastReviewDate;
      
      if (lastReviewDate) {
        const lastReview = new Date(lastReviewDate);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - lastReview.getTime());
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        
        return diffDays;
      }
    }
    
    // No previous reviews found, return 0
    return 0;
  } catch (error) {
    console.error('Error getting time since last review:', error);
    return 0;
  }
}; 