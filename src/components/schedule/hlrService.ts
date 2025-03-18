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
 * @param getCurrentTime - Function to get the current time (optional)
 * @returns Date object for the next review
 */
export const scheduleNextReview = (halfLife: number, quizDate?: Date | string, getCurrentTime?: () => Date): Date => {
  // Convert quizDate to Date object if it's a string
  let quizDateObj: Date;
  if (quizDate) {
    quizDateObj = typeof quizDate === 'string' ? new Date(quizDate) : quizDate;
  } else {
    // Use provided current time function or default to new Date()
    quizDateObj = getCurrentTime ? getCurrentTime() : new Date();
  }
  
  // Calculate next review date by adding half-life in days to the quiz date
  const nextReviewDate = new Date(quizDateObj);
  nextReviewDate.setDate(nextReviewDate.getDate() + halfLife);
  
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
 * @param getCurrentTime - Function to get the current time (optional)
 * @returns Whether the review was successfully scheduled
 */
export const saveScheduledReview = async (
  userId: string,
  courseId: string,
  lectureId: string,
  score: number,
  studyCount: number = 1,
  quizDate?: Date | string,
  getCurrentTime?: () => Date
): Promise<boolean> => {
  try {
    console.log(`Saving scheduled review for user ${userId}, lecture ${lectureId} with score ${score}`);
    
    // Get task complexity and estimated study duration
    const { data: lectureData } = await client.models.Lectures.get({ id: lectureId });
    
    // Use defaults if lecture not found
    const taskComplexity = lectureData?.difficulty ? parseInt(lectureData.difficulty, 10) : 5;
    const studyDuration = lectureData?.duration ? parseInt(lectureData.duration, 10) : 60;
    
    console.log(`Lecture metadata - complexity: ${taskComplexity}, duration: ${studyDuration} minutes`);
    
    // Get time since last review (in hours)
    const timeSinceLastReview = await getTimeSinceLastReview(userId, lectureId);
    
    // Get existing half-life if available
    let previousHalfLife: number | undefined;
    try {
      const existingReviews = await client.models.ScheduledReviews.list({
        filter: {
          and: [
            { userId: { eq: userId } },
            { lectureId: { eq: lectureId } }
          ]
        }
      });
      
      if (existingReviews.data && existingReviews.data.length > 0) {
        previousHalfLife = existingReviews.data[0].halfLife;
        console.log(`Previous half-life: ${previousHalfLife} hours`);
      }
    } catch (error) {
      console.error("Error fetching previous half-life:", error);
    }
    
    // Calculate new half-life
    const halfLife = calculateHalfLife(
      score,
      studyDuration,
      taskComplexity,
      timeSinceLastReview,
      previousHalfLife,
      studyCount
    );
    
    console.log(`Calculated half-life: ${halfLife} hours`);
    
    // Schedule next review
    const nextReviewDate = scheduleNextReview(halfLife, quizDate, getCurrentTime);
    
    console.log(`Next review scheduled for: ${nextReviewDate.toISOString()}`);
    
    // Check for existing review
    const existingReviews = await client.models.ScheduledReviews.list({
      filter: {
        and: [
          { userId: { eq: userId } },
          { lectureId: { eq: lectureId } }
        ]
      }
    });
    
    if (existingReviews.data && existingReviews.data.length > 0) {
      // Update existing review
      const existingReview = existingReviews.data[0];
      
      const updateResult = await client.models.ScheduledReviews.update({
        id: existingReview.id,
        halfLife: halfLife,
        lastScore: score,
        reviewDate: nextReviewDate.toISOString(),
        lastReviewDate: nextReviewDate.toISOString(),
        studyCount: studyCount
      });
      
      console.log("Updated scheduled review:", updateResult);
      return true;
    } else {
      // Create new review
      const createResult = await client.models.ScheduledReviews.create({
        userId: userId,
        courseId: courseId,
        lectureId: lectureId,
        halfLife: halfLife,
        lastScore: score,
        reviewDate: nextReviewDate.toISOString(),
        lastReviewDate: nextReviewDate.toISOString(),
        studyCount: studyCount
      });
      
      console.log("Created scheduled review:", createResult);
      return true;
    }
  } catch (error) {
    console.error("Error saving scheduled review:", error);
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

/**
 * Delete scheduled reviews with optional filtering by course or lecture
 * 
 * @param userId - ID of the user
 * @param courseId - Optional course ID to filter by
 * @param lectureId - Optional lecture ID to filter by 
 * @returns Number of deleted reviews
 */
export const deleteScheduledReviews = async (
  userId: string,
  courseId?: string,
  lectureId?: string
): Promise<number> => {
  try {
    console.log("Deleting scheduled reviews with filters:", { userId, courseId, lectureId });
    
    // Build filter based on provided parameters
    const filter: any = { userId: { eq: userId } };
    
    if (courseId) {
      filter.courseId = { eq: courseId };
    }
    
    if (lectureId) {
      filter.lectureId = { eq: lectureId };
    }
    
    // Get all matching reviews
    const reviews = await client.models.ScheduledReviews.list({ filter });
    
    if (!reviews.data || reviews.data.length === 0) {
      console.log("No matching scheduled reviews found to delete");
      return 0;
    }
    
    console.log(`Found ${reviews.data.length} reviews to delete`);
    
    // Delete each review
    const deletePromises = reviews.data.map(review => 
      client.models.ScheduledReviews.delete({ id: review.id })
    );
    
    // Wait for all deletions to complete
    const results = await Promise.all(deletePromises);
    
    const successCount = results.filter(result => !result.errors).length;
    console.log(`Successfully deleted ${successCount} scheduled reviews`);
    
    return successCount;
  } catch (error) {
    console.error("Error deleting scheduled reviews:", error);
    throw error;
  }
};

/**
 * Synchronize deletion between UserProgress and ScheduledReviews
 * This function deletes UserProgress records and their associated scheduled reviews
 * 
 * @param userId - ID of the user
 * @param courseId - Optional course ID to filter by
 * @param lectureId - Optional lecture ID to filter by
 * @returns Object with counts of deleted records
 */
export const syncDeleteUserData = async (
  userId: string,
  courseId?: string,
  lectureId?: string
): Promise<{progressDeleted: number, reviewsDeleted: number}> => {
  try {
    console.log("Synchronizing deletion of user data:", { userId, courseId, lectureId });
    
    // Build filter based on provided parameters
    const filter: any = { userId: { eq: userId } };
    
    if (courseId) {
      filter.courseId = { eq: courseId };
    }
    
    if (lectureId) {
      filter.lectureId = { eq: lectureId };
    }
    
    // 1. First get all matching UserProgress records
    const progressRecords = await client.models.UserProgress.list({ filter });
    
    if (!progressRecords.data || progressRecords.data.length === 0) {
      console.log("No matching progress records found to delete");
      
      // Even if no progress records exist, we should still delete scheduled reviews
      const reviewsDeleted = await deleteScheduledReviews(userId, courseId, lectureId);
      
      return { progressDeleted: 0, reviewsDeleted };
    }
    
    // 2. Delete each progress record
    const deleteProgressPromises = progressRecords.data.map(record => 
      client.models.UserProgress.delete({ id: record.id })
    );
    
    // 3. Delete associated scheduled reviews
    const reviewsDeleted = await deleteScheduledReviews(userId, courseId, lectureId);
    
    // 4. Wait for all progress deletions to complete
    const progressResults = await Promise.all(deleteProgressPromises);
    const progressDeleted = progressResults.filter(result => !result.errors).length;
    
    console.log(`Successfully synchronized deletion: ${progressDeleted} progress records and ${reviewsDeleted} scheduled reviews`);
    
    return { progressDeleted, reviewsDeleted };
  } catch (error) {
    console.error("Error synchronizing deletion:", error);
    throw error;
  }
}; 