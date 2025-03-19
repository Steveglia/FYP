import { generateClient } from "aws-amplify/api";
import type { Schema } from "../../../amplify/data/resource";

const client = generateClient<Schema>();

/**
 * Spaced repetition implementation using Half-Life Regression (HLR) model.
 * Algorithm calculates optimal intervals between reviews based on:
 * - Test performance (primary factor)
 * - Material complexity 
 * - Study count (with diminishing returns)
 * - Time since last review (logarithmic spacing effect)
 */

/**
 * Algorithm parameters - calibrated based on cognitive research
 */
export const SpacedRepetitionParams = {
  BASE_CONSTANT: 0.5,              // Base scaling for initial intervals (1-3 days)
  TIME_SINCE_REVIEW_FACTOR: 0.3,   // Spacing effect with logarithmic scaling
  STUDY_COUNT_FACTOR: 0.4,         // Moderate repetition effect with square root scaling
  QUIZ_SCORE_FACTOR: 0.7,          // Test performance impact (primary driver)
  MIN_HALF_LIFE: 1.0               // Minimum half-life in days
};

/**
 * Convert string difficulty values to numeric scale (1-5)
 */
export const convertDifficultyToNumeric = (difficultyString?: string | null): number => {
  if (!difficultyString) return 3; // Default to medium difficulty
  
  // If it's already a number, parse and validate it
  if (/^\d+$/.test(difficultyString)) {
    const parsed = parseInt(difficultyString, 10);
    return Math.min(5, Math.max(1, parsed)); // Ensure it's between 1-5
  }
  
  // Convert common string representations to numeric values
  const lowerDifficulty = difficultyString.toLowerCase();
  
  if (lowerDifficulty.includes('very easy') || lowerDifficulty.includes('beginner')) {
    return 1;
  } else if (lowerDifficulty.includes('easy') || lowerDifficulty.includes('simple')) {
    return 2;
  } else if (lowerDifficulty.includes('medium') || lowerDifficulty.includes('moderate') || lowerDifficulty.includes('intermediate')) {
    return 3;
  } else if (lowerDifficulty.includes('hard') || lowerDifficulty.includes('difficult') || lowerDifficulty.includes('advanced')) {
    return 4;
  } else if (lowerDifficulty.includes('very hard') || lowerDifficulty.includes('expert')) {
    return 5;
  }
  
  return 3; // Default to medium difficulty
};

/**
 * Get lecture metadata including difficulty and duration
 */
export const getLectureMetadata = async (lectureId: string) => {
  try {
    // Get lecture from Lectures model
    const lectureResult = await client.models.Lectures.get({ id: lectureId });
    
    if (lectureResult.data) {
      // Convert string difficulty to numeric value
      const difficultyValue = convertDifficultyToNumeric(lectureResult.data.difficulty);
      
      // Parse duration from string format (e.g., "60 minutes" -> 60)
      let durationValue = 30; // Default
      if (lectureResult.data.duration) {
        const durationMatch = lectureResult.data.duration.match(/(\d+)/);
        if (durationMatch) {
          durationValue = parseInt(durationMatch[1], 10);
        }
      }
      
      // Return metadata from Lectures model
      return {
        difficulty: difficultyValue,
        duration: durationValue,
        title: lectureResult.data.title,
        content: lectureResult.data.content,
        rawDifficulty: lectureResult.data.difficulty
      };
    }
    
    // Return default values if lecture not found
    return {
      difficulty: 3,
      duration: 30,
      title: '',
      content: '',
      rawDifficulty: 'Medium'
    };
  } catch (error) {
    // Return default values on error
    return {
      difficulty: 3,
      duration: 30,
      title: '',
      content: '',
      rawDifficulty: 'Medium'
    };
  }
};

/**
 * Adjust half-life based on quiz performance
 * Uses squared scoring to more strongly differentiate between perfect and partial recall
 */
const adjustForQuizPerformance = (baseHalfLife: number, normalizedScore: number): number => {
  const normalizedEffect = normalizedScore ** 2; // Squared for more pronounced effect
  const performanceModifier = 0.2 + normalizedEffect * SpacedRepetitionParams.QUIZ_SCORE_FACTOR * 2.5;
  return baseHalfLife * performanceModifier;
};

/**
 * Adjust half-life based on time since last review (spacing effect)
 * Uses logarithmic scale for diminishing returns on longer intervals
 */
const adjustForTimeSinceLastReview = (baseHalfLife: number, timeSinceLastReview: number): number => {
  if (timeSinceLastReview <= 0) return baseHalfLife;
  return baseHalfLife * (1 + SpacedRepetitionParams.TIME_SINCE_REVIEW_FACTOR * Math.log1p(timeSinceLastReview));
};

/**
 * Adjust half-life based on study count (repetition effect)
 * Uses square root scaling to prevent excessive growth with high repetition
 */
const adjustForStudyCount = (baseHalfLife: number, studyCount: number): number => {
  if (studyCount <= 1) return baseHalfLife;
  
  const repetitionBonus = Math.max(0, studyCount - 1);
  const adjustedBonus = Math.sqrt(repetitionBonus); // Square root for diminishing returns
  const growthFactor = 1 + adjustedBonus * SpacedRepetitionParams.STUDY_COUNT_FACTOR;
  
  return baseHalfLife * growthFactor;
};

/**
 * Weight current half-life with previous half-life
 */
const weightWithPreviousHalfLife = (
  baseHalfLife: number, 
  previousHalfLife: number, 
  studyCount: number
): number => {
  if (previousHalfLife <= 0) return baseHalfLife;
  
  const weight = 1 / (studyCount + 1); // Weight for new calculation
  return (weight * baseHalfLife) + ((1 - weight) * previousHalfLife);
};

/**
 * Calculate half-life based on user performance using the Half-Life Regression model
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
  
  // Ensure task complexity is within valid range (1-5)
  const validComplexity = Math.min(5, Math.max(1, taskComplexity));
  
  // Base half-life calculation
  let baseHalfLife = SpacedRepetitionParams.BASE_CONSTANT * 
                    (normalizedScore * studyDuration) / validComplexity;
  
  // Apply performance adjustment (primary factor)
  baseHalfLife = adjustForQuizPerformance(baseHalfLife, normalizedScore);
  
  // Apply spacing effect
  baseHalfLife = adjustForTimeSinceLastReview(baseHalfLife, timeSinceLastReview);
  
  // Incorporate previous half-life if available
  if (previousHalfLife && previousHalfLife > 0) {
    baseHalfLife = weightWithPreviousHalfLife(baseHalfLife, previousHalfLife, studyCount);
  }
  
  // Apply study count modifier with diminishing returns
  baseHalfLife = adjustForStudyCount(baseHalfLife, studyCount);
  
  // Ensure minimum half-life is respected
  return Math.max(SpacedRepetitionParams.MIN_HALF_LIFE, baseHalfLife);
};

/**
 * Schedule the next review session based on the calculated half-life
 */
export const scheduleNextReview = (halfLife: number, quizDate?: Date | string): Date => {
  // Use provided quiz date or fall back to current date
  const baseDate = quizDate ? new Date(quizDate) : new Date();
  
  // Ensure half-life is valid
  const validHalfLife = Math.max(SpacedRepetitionParams.MIN_HALF_LIFE, halfLife);
  
  // Convert half-life from days to milliseconds
  const halfLifeMs = validHalfLife * 24 * 60 * 60 * 1000;
  
  // Add the half-life in days to the base date
  const nextReviewDate = new Date(baseDate.getTime() + halfLifeMs);
  
  return nextReviewDate;
};

/**
 * Estimate study duration based on lecture data
 */
export const estimateStudyDuration = async (lectureId?: string): Promise<number> => {
  const DEFAULT_STUDY_DURATION = 30;
  const STUDY_DURATION_MULTIPLIER = 1.5;
  
  if (lectureId) {
    try {
      const metadata = await getLectureMetadata(lectureId);
      if (metadata.duration > 0) {
        return metadata.duration * STUDY_DURATION_MULTIPLIER;
      }
    } catch (error) {
      // Error fallback - use default
    }
  }
  
  return DEFAULT_STUDY_DURATION;
};

/**
 * Estimate task complexity based on lecture data
 */
export const estimateTaskComplexity = async (lectureId?: string): Promise<number> => {
  if (lectureId) {
    try {
      const metadata = await getLectureMetadata(lectureId);
      return metadata.difficulty;
    } catch (error) {
      // Error fallback - use default
    }
  }
  
  return 3; // Default to medium complexity
};

/**
 * Save or update a scheduled review for a user
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
    if (!userId || !courseId || !lectureId) {
      return false;
    }

    // Validate score is within acceptable range
    score = Math.max(0, Math.min(100, score));

    // If quizDate is not provided, use current date
    let quizDateTime = quizDate ? new Date(quizDate) : new Date();
    
    // Make sure the date is valid
    if (isNaN(quizDateTime.getTime())) {
      quizDateTime = new Date();
    }
    
    const lastReviewDate = quizDateTime.toISOString();
    
    // Get previous half-life (if available)
    let previousHalfLife = 0;
    const existingReviews = await client.models.ScheduledReviews.list({
      filter: {
        userId: { eq: userId },
        lectureId: { eq: lectureId }
      }
    });
    
    if (existingReviews.data.length > 0) {
      previousHalfLife = existingReviews.data[0].halfLife || 0;
    }
    
    // Get lecture metadata
    const metadata = await getLectureMetadata(lectureId);
    const taskComplexity = metadata.difficulty;
    const studyDuration = metadata.duration;
    
    // Get time since last review (in days)
    const timeSinceLastReview = await getTimeSinceLastReview(userId, lectureId);
    
    // Calculate half-life based on performance and other factors
    const halfLife = calculateHalfLife(
      score, 
      studyDuration, 
      taskComplexity, 
      timeSinceLastReview,
      previousHalfLife,
      studyCount
    );
    
    // Schedule next review date using the quiz date
    const reviewDate = scheduleNextReview(halfLife, quizDateTime);
    
    try {
      if (existingReviews.data.length > 0) {
        // Update existing record for this lecture
        const existingReview = existingReviews.data[0];
        const updateData = {
          id: existingReview.id,
          userId,
          courseId,
          lectureId,
          reviewDate: reviewDate.toISOString(),
          halfLife,
          lastScore: score,
          lastReviewDate,
          studyCount
        };
        
        const updateResult = await client.models.ScheduledReviews.update(updateData);
        
        if (updateResult.errors) {
          throw new Error(`Error updating scheduled review: ${JSON.stringify(updateResult.errors)}`);
        }
      } else {
        // Create new record for this lecture
        const createData = {
          userId,
          courseId,
          lectureId,
          reviewDate: reviewDate.toISOString(),
          halfLife,
          lastScore: score,
          lastReviewDate,
          studyCount
        };
        
        const createResult = await client.models.ScheduledReviews.create(createData);
        
        if (createResult.errors) {
          throw new Error(`Error creating scheduled review: ${JSON.stringify(createResult.errors)}`);
        }
      }
      
      // Verify the review was saved
      const verifyReview = await client.models.ScheduledReviews.list({
        filter: {
          userId: { eq: userId },
          lectureId: { eq: lectureId }
        }
      });
      
      if (verifyReview.data.length === 0) {
        return false;
      }
      
      return true;
    } catch (dbError) {
      throw dbError;
    }
  } catch (error) {
    return false;
  }
};

/**
 * Get all scheduled reviews for a user
 */
export const getScheduledReviews = async (userId: string) => {
  try {
    const response = await client.models.ScheduledReviews.list({
      filter: {
        userId: { eq: userId }
      }
    });
    
    return response.data || [];
  } catch (error) {
    throw error;
  }
};

/**
 * Calculate time since last review for a specific lecture
 */
export const getTimeSinceLastReview = async (userId: string, lectureId: string): Promise<number> => {
  try {
    // Find the most recent review record for this user and lecture
    const existingReviews = await client.models.ScheduledReviews.list({
      filter: {
        userId: { eq: userId },
        lectureId: { eq: lectureId }
      }
    });
    
    if (existingReviews.data.length > 0) {
      const lastReviewDate = existingReviews.data[0].lastReviewDate;
      
      if (lastReviewDate) {
        const lastReview = new Date(lastReviewDate);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - lastReview.getTime());
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        
        return diffDays;
      }
    }
    
    return 0; // No previous reviews found
  } catch (error) {
    return 0;
  }
}; 