"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugHalfLifeCalculation = exports.debugScheduledReviews = exports.getTimeSinceLastReview = exports.getScheduledReviews = exports.saveScheduledReview = exports.estimateTaskComplexity = exports.estimateStudyDuration = exports.scheduleNextReview = exports.calculateHalfLife = exports.getLectureMetadata = exports.convertDifficultyToNumeric = exports.SpacedRepetitionParams = void 0;
const api_1 = require("aws-amplify/api");
const client = (0, api_1.generateClient)();
/**
 * SPACED REPETITION IMPLEMENTATION OVERVIEW
 * -----------------------------------------
 * This implementation uses a Half-Life Regression (HLR) model for spaced repetition scheduling.
 *
 * Key principles:
 * 1. The "half-life" represents the time it takes for memory retention to drop to 50%.
 * 2. Better performance on tests leads to longer intervals between reviews.
 * 3. More study repetitions strengthen memory and extend intervals.
 * 4. Time since last review affects memory strength (spacing effect).
 * 5. Task complexity/difficulty reduces the half-life (harder = reviewed sooner).
 *
 * The algorithm workflow:
 * - Calculate a base half-life from score, study duration, and complexity
 * - Apply adjustments for quiz performance relative to 50%
 * - Apply logarithmic spacing effect adjustment
 * - Incorporate previous half-life using a weighted average
 * - Apply repetition effect for multiple study sessions
 *
 * Algorithm parameters are configurable in the SpacedRepetitionParams object.
 * For theoretical background, see:
 * - Ebbinghaus forgetting curve: https://en.wikipedia.org/wiki/Forgetting_curve
 * - Half-life regression: https://fasiha.github.io/ebisu/
 * - Spaced repetition research: https://www.gwern.net/Spaced-repetition
 */
// Configurable constants for spaced repetition algorithm
// These values can be adjusted based on empirical data and research findings
/**
 * Constants for the spaced repetition algorithm
 * These parameters can be adjusted to fine-tune the memory model
 *
 * Values have been calibrated based on cognitive research to reflect:
 * - Realistic base half-life for initial learning (1-3 days)
 * - Strong impact of quiz performance on retention
 * - Exponential growth of retention with repeated reviews
 * - Logarithmic scaling for time-since-review effects
 */
exports.SpacedRepetitionParams = {
    // Base scaling factor for half-life calculation
    // Lowered to produce more realistic initial half-lives of 1-3 days
    BASE_CONSTANT: 0.5,
    // Factor for adjusting half-life based on time since last review (spacing effect)
    // Used in logarithmic calculation to model diminishing returns of long intervals
    TIME_SINCE_REVIEW_FACTOR: 0.3,
    // Factor for adjusting half-life based on study count (repetition effect)
    // Increased to produce approximately doubling effect with each successful review
    STUDY_COUNT_FACTOR: 0.8,
    // Factor for adjusting half-life based on quiz performance
    // Increased for stronger differentiation between perfect and partial recall
    QUIZ_SCORE_FACTOR: 0.4,
    // Minimum half-life in days
    MIN_HALF_LIFE: 1.0
};
/**
 * Convert string difficulty values to numeric scale (1-5)
 *
 * @param difficultyString - String representation of difficulty
 * @returns Numeric difficulty on 1-5 scale
 */
const convertDifficultyToNumeric = (difficultyString) => {
    if (!difficultyString)
        return 3; // Default to medium difficulty
    // If it's already a number, parse and validate it
    if (/^\d+$/.test(difficultyString)) {
        const parsed = parseInt(difficultyString, 10);
        return Math.min(5, Math.max(1, parsed)); // Ensure it's between 1-5
    }
    // Convert common string representations to numeric values
    const lowerDifficulty = difficultyString.toLowerCase();
    if (lowerDifficulty.includes('very easy') || lowerDifficulty.includes('beginner')) {
        return 1;
    }
    else if (lowerDifficulty.includes('easy') || lowerDifficulty.includes('simple')) {
        return 2;
    }
    else if (lowerDifficulty.includes('medium') || lowerDifficulty.includes('moderate') || lowerDifficulty.includes('intermediate')) {
        return 3;
    }
    else if (lowerDifficulty.includes('hard') || lowerDifficulty.includes('difficult') || lowerDifficulty.includes('advanced')) {
        return 4;
    }
    else if (lowerDifficulty.includes('very hard') || lowerDifficulty.includes('expert')) {
        return 5;
    }
    // Default to medium difficulty if no match
    return 3;
};
exports.convertDifficultyToNumeric = convertDifficultyToNumeric;
/**
 * Get lecture metadata including difficulty and duration
 *
 * @param lectureId - ID of the lecture
 * @returns Object containing lecture metadata
 */
const getLectureMetadata = async (lectureId) => {
    try {
        // Get lecture from Lectures model
        const lectureResult = await client.models.Lectures.get({ id: lectureId });
        if (lectureResult.data) {
            // Convert string difficulty to numeric value
            const difficultyValue = (0, exports.convertDifficultyToNumeric)(lectureResult.data.difficulty);
            // Parse duration from string format (e.g., "60 minutes" -> 60)
            let durationValue = 30; // Default
            if (lectureResult.data.duration) {
                const durationMatch = lectureResult.data.duration.match(/(\d+)/);
                if (durationMatch) {
                    durationValue = parseInt(durationMatch[1], 10);
                }
            }
            console.log(`Lecture ${lectureId} metadata:`, {
                title: lectureResult.data.title,
                difficulty: lectureResult.data.difficulty,
                difficultyValue,
                duration: lectureResult.data.duration,
                durationValue
            });
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
        console.log(`No lecture found for ID: ${lectureId}, using default values`);
        return {
            difficulty: 3,
            duration: 30,
            title: '',
            content: '',
            rawDifficulty: 'Medium'
        };
    }
    catch (error) {
        console.error("Error fetching lecture metadata:", error);
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
exports.getLectureMetadata = getLectureMetadata;
/**
 * Adjust half-life based on quiz performance
 * Apply a continuous adjustment based on normalized score relative to 0.5 (50%)
 * Uses a non-linear scaling to more strongly differentiate between perfect and partial recall
 *
 * @param baseHalfLife - Current half-life value
 * @param normalizedScore - Quiz score normalized to 0-1 range
 * @returns Adjusted half-life value
 */
const adjustForQuizPerformance = (baseHalfLife, normalizedScore) => {
    // Non-linear adjustment that more aggressively penalizes non-perfect scores
    // A score of 75% will reduce the half-life to about 60% of perfect performance
    // Square the normalized score to create a steeper curve for lower scores
    const normalizedEffect = normalizedScore ** 1.5; // Non-linear scaling
    const performanceModifier = 0.3 + normalizedEffect * exports.SpacedRepetitionParams.QUIZ_SCORE_FACTOR * 3.0;
    return baseHalfLife * performanceModifier;
};
/**
 * Adjust half-life based on time since last review (spacing effect)
 * Longer intervals lead to stronger memories when successfully recalled
 * Uses logarithmic scale to better model cognitive spacing effects
 *
 * @param baseHalfLife - Current half-life value
 * @param timeSinceLastReview - Time since last review in days
 * @returns Adjusted half-life value
 */
const adjustForTimeSinceLastReview = (baseHalfLife, timeSinceLastReview) => {
    if (timeSinceLastReview <= 0)
        return baseHalfLife;
    // Use logarithmic scaling to better model spacing effect
    // Math.log1p(x) = ln(1 + x) - better for small values of timeSinceLastReview
    // This creates diminishing returns for very long intervals
    return baseHalfLife * (1 + exports.SpacedRepetitionParams.TIME_SINCE_REVIEW_FACTOR * Math.log1p(timeSinceLastReview));
};
/**
 * Adjust half-life based on study count (repetition effect)
 * More study repetitions lead to stronger memory traces
 * Implements exponential-like growth in retention intervals with repetition
 *
 * @param baseHalfLife - Current half-life value
 * @param studyCount - Number of times material has been studied
 * @returns Adjusted half-life value
 */
const adjustForStudyCount = (baseHalfLife, studyCount) => {
    // Apply multiplicative growth that approximately doubles with each review
    // For first review, this has no effect (multiplier = 1)
    if (studyCount <= 1)
        return baseHalfLife;
    // Calculate growth factor to approximate doubling with each review
    // studyCount - 1 to ensure first review has no effect
    const repetitionBonus = Math.max(0, studyCount - 1);
    const growthFactor = Math.pow(1 + exports.SpacedRepetitionParams.STUDY_COUNT_FACTOR, repetitionBonus);
    return baseHalfLife * growthFactor;
};
/**
 * Weight current half-life with previous half-life
 * The weight of previous half-life increases with study count
 *
 * @param baseHalfLife - Newly calculated half-life value
 * @param previousHalfLife - Half-life from previous review
 * @param studyCount - Number of times material has been studied
 * @returns Weighted combination of current and previous half-life
 */
const weightWithPreviousHalfLife = (baseHalfLife, previousHalfLife, studyCount) => {
    if (previousHalfLife <= 0)
        return baseHalfLife;
    // Use weighted average where weight depends on study count
    // As study count increases, previous half-life gets more weight
    const weight = 1 / (studyCount + 1); // Weight for new calculation
    return (weight * baseHalfLife) + ((1 - weight) * previousHalfLife);
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
const calculateHalfLife = (score, studyDuration, taskComplexity, timeSinceLastReview, previousHalfLife, studyCount = 1) => {
    // Normalize score to 0-1 range
    const normalizedScore = score / 100;
    // Ensure task complexity is within valid range (1-5)
    const validComplexity = Math.min(5, Math.max(1, taskComplexity));
    // Base half-life calculation with parameterized constant
    let baseHalfLife = exports.SpacedRepetitionParams.BASE_CONSTANT *
        (normalizedScore * studyDuration) / validComplexity;
    // Log the calculation details for debugging
    console.log('Half-life calculation:', {
        score,
        normalizedScore,
        studyDuration,
        taskComplexity: validComplexity,
        baseHalfLife,
        timeSinceLastReview,
        previousHalfLife,
        studyCount
    });
    // Apply modular adjustments in sequence
    // 1. Adjust for quiz performance
    baseHalfLife = adjustForQuizPerformance(baseHalfLife, normalizedScore);
    console.log('After quiz performance adjustment:', baseHalfLife);
    // 2. Adjust for spacing effect - logarithmic adjustment
    baseHalfLife = adjustForTimeSinceLastReview(baseHalfLife, timeSinceLastReview);
    console.log('After spacing effect adjustment:', baseHalfLife);
    // 3. Weight with previous half-life (if available)
    if (previousHalfLife && previousHalfLife > 0) {
        baseHalfLife = weightWithPreviousHalfLife(baseHalfLife, previousHalfLife, studyCount);
        console.log('After weighting with previous half-life:', baseHalfLife);
    }
    // 4. Apply study count modifier - retention improves with repetition
    baseHalfLife = adjustForStudyCount(baseHalfLife, studyCount);
    console.log('After study count adjustment:', baseHalfLife);
    // Ensure minimum half-life is respected
    return Math.max(exports.SpacedRepetitionParams.MIN_HALF_LIFE, baseHalfLife);
};
exports.calculateHalfLife = calculateHalfLife;
/**
 * Schedule the next review session based on the calculated half-life
 *
 * @param halfLife - Half-life in days
 * @param quizDate - Date when the quiz was taken (defaults to current date if not provided)
 * @returns Date object for the next review
 */
const scheduleNextReview = (halfLife, quizDate) => {
    // Use provided quiz date or fall back to current date
    const baseDate = quizDate ? new Date(quizDate) : new Date();
    // Ensure half-life is valid
    const validHalfLife = Math.max(exports.SpacedRepetitionParams.MIN_HALF_LIFE, halfLife);
    // Convert half-life from days to milliseconds
    const halfLifeMs = validHalfLife * 24 * 60 * 60 * 1000;
    // Add the half-life in days to the base date
    const nextReviewDate = new Date(baseDate.getTime() + halfLifeMs);
    // Log scheduling information
    console.log(`Scheduling next review: halfLife=${validHalfLife.toFixed(2)} days, from ${baseDate.toLocaleString()} to ${nextReviewDate.toLocaleString()}`);
    return nextReviewDate;
};
exports.scheduleNextReview = scheduleNextReview;
/**
 * Estimate study duration based on lecture data
 *
 * @param lectureId - ID of the lecture
 * @returns Estimated study duration in minutes
 */
const estimateStudyDuration = async (lectureId) => {
    // Default study duration in minutes
    const DEFAULT_STUDY_DURATION = 30;
    // Multiplier for recommended study time relative to lecture duration
    const STUDY_DURATION_MULTIPLIER = 1.5;
    // If we have lecture ID, get metadata
    if (lectureId) {
        try {
            const metadata = await (0, exports.getLectureMetadata)(lectureId);
            if (metadata.duration > 0) {
                // Return actual lecture duration as base study time
                // Adjust by a factor to get recommended study time (e.g., 1.5x lecture time)
                const estimatedDuration = metadata.duration * STUDY_DURATION_MULTIPLIER;
                console.log(`Estimated study duration for lecture ${lectureId}: ${estimatedDuration} minutes (${metadata.duration} lecture minutes × ${STUDY_DURATION_MULTIPLIER})`);
                return estimatedDuration;
            }
        }
        catch (error) {
            console.error('Error getting lecture duration:', error);
        }
    }
    // Default to 30 minutes if no other information is available
    console.log(`No lecture data available, using default study duration: ${DEFAULT_STUDY_DURATION} minutes`);
    return DEFAULT_STUDY_DURATION;
};
exports.estimateStudyDuration = estimateStudyDuration;
/**
 * Estimate task complexity based on lecture data
 *
 * @param lectureId - ID of the lecture
 * @returns Complexity rating (1-5)
 */
const estimateTaskComplexity = async (lectureId) => {
    // If we have lecture ID, get metadata
    if (lectureId) {
        try {
            const metadata = await (0, exports.getLectureMetadata)(lectureId);
            // Use the difficulty from lecture data
            console.log(`Using lecture difficulty: ${metadata.difficulty} (raw: ${metadata.rawDifficulty})`);
            return metadata.difficulty;
        }
        catch (error) {
            console.error('Error getting lecture complexity:', error);
        }
    }
    // Default to medium complexity if no lecture ID or error occurred
    console.log('No lecture data available, defaulting to medium complexity (3)');
    return 3;
};
exports.estimateTaskComplexity = estimateTaskComplexity;
/**
 * Save or update a scheduled review for a user
 * Uses the improved half-life regression algorithm to calculate review intervals
 *
 * @param userId - ID of the user
 * @param courseId - ID of the course
 * @param lectureId - ID of the lecture
 * @param score - Quiz score (0-100)
 * @param studyCount - Number of times this lecture has been studied
 * @param quizDate - Date when the quiz was taken or when the review was scheduled for
 *                   (For reviews, this should be the date the review was scheduled for, not when it was completed)
 * @returns Whether the review was successfully scheduled
 */
const saveScheduledReview = async (userId, courseId, lectureId, score, studyCount = 1, quizDate) => {
    try {
        if (!userId || !courseId || !lectureId) {
            console.error('Missing required parameters:', { userId, courseId, lectureId });
            return false;
        }
        // Validate score is within acceptable range
        if (score < 0 || score > 100) {
            console.error(`Invalid score value: ${score} - must be between 0-100`);
            score = Math.max(0, Math.min(100, score));
        }
        // If quizDate is not provided, use current date
        let quizDateTime = quizDate ? new Date(quizDate) : new Date();
        // Make sure the date is valid
        if (isNaN(quizDateTime.getTime())) {
            console.error(`Invalid quizDate provided: ${quizDate}, using current date instead`);
            quizDateTime = new Date();
        }
        const lastReviewDate = quizDateTime.toISOString();
        console.log(`Scheduling review: userId=${userId}, lectureId=${lectureId}, score=${score}, studyCount=${studyCount}, date=${quizDateTime.toLocaleString()}`);
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
            console.log(`Found previous half-life: ${previousHalfLife} days`);
        }
        // Get lecture metadata for better calculations
        const metadata = await (0, exports.getLectureMetadata)(lectureId);
        console.log(`Using lecture metadata:`, metadata);
        // Use the difficulty directly from lecture data
        const taskComplexity = metadata.difficulty;
        console.log(`Lecture difficulty: ${metadata.rawDifficulty} → Converted to numeric: ${taskComplexity}`);
        // Use duration from lecture data
        const studyDuration = metadata.duration;
        // Get time since last review (in days)
        const timeSinceLastReview = await (0, exports.getTimeSinceLastReview)(userId, lectureId);
        // Calculate half-life based on performance and other factors
        // Now includes previous half-life in calculation for better continuity
        const halfLife = (0, exports.calculateHalfLife)(score, studyDuration, taskComplexity, timeSinceLastReview, previousHalfLife, studyCount);
        // Schedule next review date using the quiz date
        const reviewDate = (0, exports.scheduleNextReview)(halfLife, quizDateTime);
        console.log(`Calculated next review: halfLife=${halfLife.toFixed(2)} days, next review on ${reviewDate.toLocaleString()}`);
        // Save review data to database
        console.log(`Found ${existingReviews.data.length} existing scheduled reviews for lecture ${lectureId}`);
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
                console.log('Updating existing review with data:', updateData);
                const updateResult = await client.models.ScheduledReviews.update(updateData);
                if (updateResult.errors) {
                    throw new Error(`Error updating scheduled review: ${JSON.stringify(updateResult.errors)}`);
                }
                console.log(`Updated scheduled review for lecture: ${lectureId} with next review on ${reviewDate.toLocaleString()}`);
            }
            else {
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
                console.log('Creating new scheduled review with data:', createData);
                const createResult = await client.models.ScheduledReviews.create(createData);
                if (createResult.errors) {
                    throw new Error(`Error creating scheduled review: ${JSON.stringify(createResult.errors)}`);
                }
                console.log(`Created new scheduled review for lecture: ${lectureId} with next review on ${reviewDate.toLocaleString()}`);
            }
            // Verify the review was saved
            const verifyReview = await client.models.ScheduledReviews.list({
                filter: {
                    userId: { eq: userId },
                    lectureId: { eq: lectureId }
                }
            });
            if (verifyReview.data.length === 0) {
                console.error('Verification failed: Review was not created/updated in the database');
                return false;
            }
            console.log('Verified review exists in database:', verifyReview.data[0]);
            return true;
        }
        catch (dbError) {
            console.error('Database operation failed:', dbError);
            throw dbError;
        }
    }
    catch (error) {
        console.error('Error saving scheduled review:', error);
        return false;
    }
};
exports.saveScheduledReview = saveScheduledReview;
/**
 * Get all scheduled reviews for a user
 *
 * @param userId - User ID
 * @returns Promise resolving to an array of scheduled reviews
 */
const getScheduledReviews = async (userId) => {
    try {
        console.log("Fetching scheduled reviews for user:", userId);
        const response = await client.models.ScheduledReviews.list({
            filter: {
                userId: { eq: userId }
            }
        });
        console.log("Scheduled reviews result:", response);
        return response.data || [];
    }
    catch (error) {
        console.error("Error getting scheduled reviews:", error);
        throw error;
    }
};
exports.getScheduledReviews = getScheduledReviews;
/**
 * Calculate time since last review for a specific lecture
 *
 * @param userId - ID of the user
 * @param lectureId - ID of the lecture
 * @returns Time since last review in days
 */
const getTimeSinceLastReview = async (userId, lectureId) => {
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
    }
    catch (error) {
        console.error('Error getting time since last review:', error);
        return 0;
    }
};
exports.getTimeSinceLastReview = getTimeSinceLastReview;
/**
 * Debug helper to log all scheduled reviews for specific user and optionally lecture
 *
 * @param userId - User ID to look up
 * @param lectureId - Optional lecture ID to filter by
 * @returns Promise that resolves when logging is complete
 */
const debugScheduledReviews = async (userId, lectureId) => {
    try {
        console.log(`DEBUG: Checking scheduled reviews for user ${userId}${lectureId ? ` and lecture ${lectureId}` : ''}`);
        // Build the filter
        let filter = { userId: { eq: userId } };
        if (lectureId) {
            filter.lectureId = { eq: lectureId };
        }
        // Query reviews
        const reviews = await client.models.ScheduledReviews.list({ filter });
        // Get user progress records to determine completion status
        const progress = await client.models.UserProgress.list({
            filter: {
                userId: { eq: userId },
                ...(lectureId ? { lectureId: { eq: lectureId } } : {})
            }
        });
        // Create a map of lectureId to their latest submission times
        const progressMap = {};
        if (progress.data) {
            progress.data.forEach(record => {
                if (record.lectureId && record.lastAccessed) {
                    const submissionTime = new Date(record.lastAccessed);
                    const existingTime = progressMap[record.lectureId];
                    if (!existingTime || submissionTime > existingTime) {
                        progressMap[record.lectureId] = submissionTime;
                    }
                }
            });
        }
        // Log results
        console.log(`DEBUG: Found ${reviews.data.length} scheduled reviews`);
        if (reviews.data.length > 0) {
            console.table(reviews.data.map(r => {
                // Determine if review is completed by comparing dates
                const reviewDate = new Date(r.reviewDate);
                const progressDate = progressMap[r.lectureId];
                const isCompleted = progressDate && progressDate > reviewDate;
                return {
                    id: r.id,
                    lectureId: r.lectureId,
                    reviewDate: reviewDate.toLocaleString(),
                    score: r.lastScore,
                    studyCount: r.studyCount,
                    halfLife: r.halfLife.toFixed(2),
                    isCompleted: isCompleted ? 'Yes' : 'No',
                    lastProgress: progressDate ? progressDate.toLocaleString() : 'None'
                };
            }));
        }
        else {
            console.log('DEBUG: No scheduled reviews found!');
        }
        console.log(`DEBUG: Found ${progress.data.length} progress records for this user`);
        if (progress.data.length > 0) {
            console.table(progress.data.map(p => ({
                id: p.id,
                lectureId: p.lectureId,
                quizScore: p.quizScores,
                lastAccessed: new Date(p.lastAccessed).toLocaleString()
            })));
        }
    }
    catch (error) {
        console.error('Error in debugScheduledReviews:', error);
    }
};
exports.debugScheduledReviews = debugScheduledReviews;
/**
 * Debug the half-life calculation with different parameter values
 * Useful for testing and calibrating the algorithm
 *
 * @param score - Test score (0-100)
 * @param studyDuration - Study duration in minutes
 * @param taskComplexity - Task complexity (1-5)
 * @param timeSinceLastReview - Time since last review in days
 * @param previousHalfLife - Previous half-life (if available)
 * @param studyCount - Number of study repetitions
 * @param customParams - Optional custom parameters to override defaults
 * @returns An object with the calculated half-life and intermediate values
 */
const debugHalfLifeCalculation = (score, studyDuration, taskComplexity, timeSinceLastReview = 0, previousHalfLife, studyCount = 1, customParams) => {
    // Create a temporary set of parameters by combining defaults with any custom values
    const params = { ...exports.SpacedRepetitionParams, ...customParams };
    // Normalize score to 0-1 range
    const normalizedScore = score / 100;
    // Ensure task complexity is within valid range (1-5)
    const validComplexity = Math.min(5, Math.max(1, taskComplexity));
    // Base half-life calculation
    const baseHalfLife = params.BASE_CONSTANT * (normalizedScore * studyDuration) / validComplexity;
    // Non-linear performance adjustment
    const normalizedEffect = normalizedScore ** 1.5;
    const performanceModifier = 0.3 + normalizedEffect * params.QUIZ_SCORE_FACTOR * 3.0;
    const afterPerformance = baseHalfLife * performanceModifier;
    // Spacing effect adjustment with logarithmic scaling
    let afterSpacing = afterPerformance;
    if (timeSinceLastReview > 0) {
        const spacingEffect = 1 + params.TIME_SINCE_REVIEW_FACTOR * Math.log1p(timeSinceLastReview);
        afterSpacing = afterPerformance * spacingEffect;
    }
    // Previous half-life weighting
    let afterPrevious = afterSpacing;
    if (previousHalfLife && previousHalfLife > 0) {
        const weight = 1 / (studyCount + 1);
        afterPrevious = (weight * afterSpacing) + ((1 - weight) * previousHalfLife);
    }
    // Study count adjustment with exponential growth
    let afterStudyCount = afterPrevious;
    if (studyCount > 1) {
        const repetitionBonus = Math.max(0, studyCount - 1);
        const growthFactor = Math.pow(1 + params.STUDY_COUNT_FACTOR, repetitionBonus);
        afterStudyCount = afterPrevious * growthFactor;
    }
    // Final half-life with minimum enforced
    const finalHalfLife = Math.max(params.MIN_HALF_LIFE, afterStudyCount);
    // Return all calculation steps and values for analysis
    return {
        input: {
            score,
            normalizedScore,
            studyDuration,
            taskComplexity: validComplexity,
            timeSinceLastReview,
            previousHalfLife,
            studyCount
        },
        params,
        calculations: {
            baseHalfLife,
            normalizedEffect,
            performanceModifier,
            afterPerformance,
            spacingEffect: timeSinceLastReview > 0 ? 1 + params.TIME_SINCE_REVIEW_FACTOR * Math.log1p(timeSinceLastReview) : 1,
            afterSpacing,
            weightForPrevious: previousHalfLife && previousHalfLife > 0 ? 1 / (studyCount + 1) : null,
            afterPrevious,
            growthFactor: studyCount > 1 ? Math.pow(1 + params.STUDY_COUNT_FACTOR, studyCount - 1) : 1,
            afterStudyCount
        },
        halfLife: finalHalfLife,
        nextReviewIn: {
            days: finalHalfLife,
            hours: finalHalfLife * 24
        }
    };
};
exports.debugHalfLifeCalculation = debugHalfLifeCalculation;
