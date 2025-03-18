import React, { useState, useEffect } from 'react';
import { ScheduleEvent, Event } from './types';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from "../../../amplify/data/resource";
import { useAuthenticator } from '@aws-amplify/ui-react';
import * as hlrService from './hlrService';
import { useTimeContext } from '../../context/TimeContext';
import './QuizModal.css';

const client = generateClient<Schema>();

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  studySession: ScheduleEvent | null;
  lectures: Event[];
  onProgressSaved?: () => void;
}

const QuizModal: React.FC<QuizModalProps> = ({
  isOpen,
  onClose,
  studySession,
  lectures,
  onProgressSaved
}) => {
  const { user } = useAuthenticator();
  const { getCurrentTime, useCustomTime: globalUseCustomTime } = useTimeContext();
  
  const [selectedLectureData, setSelectedLectureData] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasExistingScore, setHasExistingScore] = useState<boolean>(false);
  const [existingScore, setExistingScore] = useState<number | null>(null);
  const [useCustomTime, setUseCustomTime] = useState<boolean>(false);
  const [customQuizDate, setCustomQuizDate] = useState<string>('');
  const [customQuizTime, setCustomQuizTime] = useState<string>('');
  const [useGlobalTime, setUseGlobalTime] = useState<boolean>(false);
  
  // Load user progress data when modal opens
  useEffect(() => {
    if (isOpen && studySession && studySession.isLecture) {
      // Add a test to validate that we can access the database
      const testDatabaseAccess = async () => {
        try {
          console.log("Testing database access...");
          console.log("Current user from hook:", user);
          
          const modelList = await client.models;
          console.log("Available models:", Object.keys(modelList));
          
          // Try a simple list operation
          const testQuery = await client.models.UserProgress.list({
            limit: 1
          });
          console.log("Test query result:", testQuery);
          
          console.log("Database access test completed");
        } catch (error) {
          console.error("Database access test failed:", error);
        }
      };
      
      testDatabaseAccess();
      
      // Get the selected lecture data
      const lecture = lectures.find(l => l.id === studySession.id) || null;
      setSelectedLectureData(lecture);
      
      setErrorMessage(null);
      
      // Initialize date fields based on current global time
      const currentGlobalTime = getCurrentTime();
      const formattedDate = currentGlobalTime.toISOString().split('T')[0];
      const formattedTime = currentGlobalTime.toTimeString().slice(0, 5);
      
      // Initialize date fields from global time or default
      setCustomQuizDate(formattedDate);
      setCustomQuizTime(formattedTime);
      
      // By default, take the date values from global time if it's set
      setUseGlobalTime(globalUseCustomTime);
      
      // Load existing progress data when modal opens
      loadUserProgress();
    }
  }, [isOpen, studySession, user, lectures, getCurrentTime, globalUseCustomTime]);
  
  const loadUserProgress = async () => {
    if (!user || !user.username || !studySession) return;
    
    try {
      setIsLoading(true);
      
      // Attempt to load existing progress data
      const response = await client.models.UserProgress.get({
        id: user.username
      });
      
      if (response?.data) {
        // Parse the progress data from the user's record
        const userProgressData = response.data;
        
        if (userProgressData) {
          // Update state to indicate if we have existing score for this lecture
          if (studySession.isLecture && userProgressData.courseId && userProgressData.lectureId) {
            // If this lecture matches the one in the progress record
            if (userProgressData.lectureId && userProgressData.quizScores !== null && userProgressData.quizScores !== undefined) {
              setHasExistingScore(true);
              setExistingScore(userProgressData.quizScores);
            }
          }
        }
        
        console.log('Loaded user progress:', userProgressData);
      } else {
        console.log('No user progress data available');
      }
      
    } catch (error) {
      console.error('Error loading progress:', error);
      setErrorMessage('Unable to load your progress.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSaveProgress = async () => {
    if (!selectedLectureData || !user?.username || !studySession || !studySession.isLecture) {
      setErrorMessage("Missing required information to save quiz result");
      console.error("Save failed - missing data:", { 
        selectedLectureData, 
        userId: user?.username,
        studySession
      });
      return;
    }
    
    const lectureId = selectedLectureData.id || '';
    
    // Double check the database directly before saving to ensure this lecture doesn't already have a score
    try {
      const existingLectureProgress = await client.models.UserProgress.list({
        filter: {
          and: [
            { userId: { eq: user.username } },
            { completedLectures: { contains: lectureId } }
          ]
        }
      });
      
      if (existingLectureProgress.data && existingLectureProgress.data.length > 0) {
        setErrorMessage("You have already submitted a quiz for this lecture. Each lecture can only be scored once.");
        setHasExistingScore(true);
        setExistingScore(existingLectureProgress.data[0].quizScores || 0);
        return;
      }
    } catch (error) {
      console.error('Error checking for existing lecture progress:', error);
    }
    
    // Check if this lecture already has a score (from local state)
    if (hasExistingScore) {
      setErrorMessage("You have already submitted a quiz for this lecture. Each lecture can only be scored once.");
      return;
    }
    
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const courseId = selectedLectureData.title?.split(':')[0]?.trim() || 'UNKNOWN';
      const now = new Date().toISOString();
      
      // Create quiz completion time based on user selection
      let quizCompletionTime: Date;
      
      if (useGlobalTime && globalUseCustomTime) {
        // Use the global custom time settings
        quizCompletionTime = getCurrentTime();
      } else if (useCustomTime && customQuizDate && customQuizTime) {
        // Use the quiz-specific custom time
        quizCompletionTime = new Date(`${customQuizDate}T${customQuizTime}`);
        
        // Validate the date isn't in the future
        const currentSystemTime = new Date();
        if (quizCompletionTime > currentSystemTime) {
          throw new Error("Quiz completion time cannot be in the future");
        }
      } else {
        // Default to lecture date or current time if not using custom time
        quizCompletionTime = studySession.startDate ? new Date(studySession.startDate) : new Date(now);
      }
      
      console.log("Attempting to save quiz result with:", {
        userId: user.username,
        courseId,
        lectureId, 
        score,
        timestamp: quizCompletionTime.toISOString(),
        usingGlobalTime: useGlobalTime && globalUseCustomTime,
        usingCustomTime: useCustomTime
      });
      
      // Check if there's an existing progress record for this user and course
      const existingProgress = await client.models.UserProgress.list({
        filter: {
          and: [
            { userId: { eq: user.username } },
            { courseId: { eq: courseId } },
          ]
        }
      });
      
      console.log("Existing progress query result:", existingProgress);
      
      // Save the quiz score progress
      let savedSuccessfully = false;
      
      if (existingProgress.data && existingProgress.data.length > 0) {
        // Update existing progress record
        const progressRecord = existingProgress.data[0];
        console.log("Found existing progress record:", progressRecord);
        
        // Update completedLectures array if lecture not already marked as completed
        let completedLectures = progressRecord.completedLectures || [];
        if (!completedLectures.includes(lectureId)) {
          completedLectures = [...completedLectures, lectureId];
        }
        
        console.log("Updating progress record with:", {
          id: progressRecord.id,
          quizScores: score, // We'll still use this field for backward compatibility
          completedLectures,
          lastAccessed: now
        });
        
        try {
          const updateResult = await client.models.UserProgress.update({
            id: progressRecord.id,
            quizScores: score, // Store the most recent score in this field
            completedLectures,
            lastAccessed: now
          });
          
          console.log("Update result:", updateResult);
          
          if (updateResult.errors) {
            throw new Error(`Failed to update: ${JSON.stringify(updateResult.errors)}`);
          }
          
          console.log(`Updated progress for user ${user.username}, course ${courseId}, lecture ${lectureId} with score ${score}%`);
          savedSuccessfully = true;
        } catch (updateError) {
          console.error("Error during update operation:", updateError);
          throw updateError;
        }
      } else {
        // Create new progress record
        console.log("No existing progress found, creating new record");
        
        const newProgressData = {
          userId: user.username,
          courseId: courseId,
          lectureId: lectureId, // Store the specific lecture ID
          completedLectures: [lectureId],
          quizScores: score,
          lastAccessed: now
        };
        
        console.log("Creating new progress with:", newProgressData);
        
        try {
          const createResult = await client.models.UserProgress.create(newProgressData);
          
          console.log("Create result:", createResult);
          
          if (createResult.errors) {
            throw new Error(`Failed to create: ${JSON.stringify(createResult.errors)}`);
          }
          
          console.log(`Created new progress record for user ${user.username}, course ${courseId}, lecture ${lectureId} with score ${score}%`);
          savedSuccessfully = true;
        } catch (createError) {
          console.error("Error during create operation:", createError);
          throw createError;
        }
      }
      
      // Calculate and schedule next review session using Half-Life Regression
      if (savedSuccessfully) {
        try {
          console.log('Scheduling next review session using HLR...');
          
          // Get study count by checking existing reviews
          let studyCount = 1;
          
          // Check for existing scheduled reviews to get the study count
          try {
            const existingReviews = await client.models.ScheduledReviews.list({
              filter: {
                and: [
                  { userId: { eq: user.username } },
                  { lectureId: { eq: lectureId } }
                ]
              }
            });
            
            if (existingReviews.data && existingReviews.data.length > 0) {
              const review = existingReviews.data[0];
              studyCount = (review.studyCount || 1) + 1;
            }
          } catch (reviewError) {
            console.error("Error fetching existing reviews:", reviewError);
          }
          
          console.log(`Quiz completion time: ${quizCompletionTime.toLocaleString()}`);
          
          // Save the review using the enhanced HLR service with the actual quiz completion time
          const reviewScheduled = await hlrService.saveScheduledReview(
            user.username,
            courseId,
            lectureId, // Schedule review for the specific lecture
            score,
            studyCount,
            quizCompletionTime,
            getCurrentTime
          );
          
          if (reviewScheduled) {
            console.log(`Successfully scheduled next review session for lecture ${lectureId} based on quiz taken at ${quizCompletionTime.toLocaleString()}`);
          } else {
            console.warn('Failed to schedule next review session');
          }
        } catch (schedulingError) {
          console.error("Error scheduling next review:", schedulingError);
          // Don't throw error here - we still want to show success for saving the progress
        }
      }
      
      // After saving, update local state to reflect the new score
      setHasExistingScore(true);
      setExistingScore(score);
      
      // Refresh progress data
      await loadUserProgress();
      
      // Notify parent component
      if (onProgressSaved) {
        onProgressSaved();
      }
      
      // Show confirmation with next review date information
      const scheduledReviews = await client.models.ScheduledReviews.list({
        filter: {
          and: [
            { userId: { eq: user.username } },
            { lectureId: { eq: lectureId } }
          ]
        }
      });
      
      let confirmationMessage = `Quiz submitted! Score: ${score}% for ${selectedLectureData.title}`;
      
      if (scheduledReviews.data && scheduledReviews.data.length > 0) {
        const nextReview = new Date(scheduledReviews.data[0].reviewDate);
        confirmationMessage += `\n\nNext recommended review: ${nextReview.toLocaleDateString()} at ${nextReview.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      
      alert(confirmationMessage);
      
      // Close the modal after saving
      onClose();
    } catch (error) {
      console.error('Error saving quiz result:', error);
      setErrorMessage(`Failed to save quiz result: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper function to safely format dates
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch (e) {
      console.error('Invalid date:', dateStr);
      return '';
    }
  };
  
  // Helper function to safely format times
  const formatTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      console.error('Invalid date:', dateStr);
      return '';
    }
  };
  
  // Handle score change
  const handleScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (hasExistingScore) return; // Don't allow changing score if already submitted
    
    const newScore = parseInt(e.target.value, 10);
    setScore(isNaN(newScore) ? 0 : Math.min(100, Math.max(0, newScore)));
  };
  
  if (!isOpen || !studySession || !studySession.isLecture) return null;
  
  return (
    <div className="quiz-modal-overlay" onClick={onClose}>
      <div className="quiz-modal-content" onClick={e => e.stopPropagation()}>
        <div className="quiz-modal-header">
          <h2>Lecture Quiz</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="quiz-modal-body">
          <p>
            Record your understanding of this lecture from {formatDate(studySession.startDate)} at {formatTime(studySession.startDate)}.
          </p>
          
          {selectedLectureData && (
            <div className="lecture-details">
              <h3>{selectedLectureData.title}</h3>
              {selectedLectureData.description && (
                <p className="lecture-description">{selectedLectureData.description}</p>
              )}
            </div>
          )}
          
          {hasExistingScore ? (
            <div className="existing-score-container">
              <div className="existing-score-message">
                <h3>Quiz Already Completed</h3>
                <p>You have already submitted a quiz for this lecture with a score of <span className="highlight-score">{existingScore}%</span>.</p>
                <p>Each lecture can only be scored once.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="score-input-container">
                <label htmlFor="score-input">Your quiz score (0-100%):</label>
                <div className="score-input-wrapper">
                  <input
                    id="score-input"
                    type="number"
                    min="0"
                    max="100"
                    value={score}
                    onChange={handleScoreChange}
                    className="score-input"
                  />
                  <span className="percentage-sign">%</span>
                </div>
                <div className="score-slider-container">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={score}
                    onChange={handleScoreChange}
                    className="score-slider"
                  />
                  <div className="score-labels">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
              
              <div className="quiz-time-container">
                {globalUseCustomTime && (
                  <div className="custom-time-toggle">
                    <label>
                      <input
                        type="checkbox"
                        checked={useGlobalTime}
                        onChange={(e) => {
                          setUseGlobalTime(e.target.checked);
                          if (e.target.checked) {
                            // Disable local custom time if using global time
                            setUseCustomTime(false);
                          }
                        }}
                      />
                      <span>Use application's global time setting ({getCurrentTime().toLocaleString('en-GB')})</span>
                    </label>
                  </div>
                )}
                
                {!useGlobalTime && (
                  <div className="custom-time-toggle">
                    <label>
                      <input
                        type="checkbox"
                        checked={useCustomTime}
                        onChange={(e) => setUseCustomTime(e.target.checked)}
                      />
                      <span>Specify when you actually took this quiz</span>
                    </label>
                  </div>
                )}
                
                {!useGlobalTime && useCustomTime && (
                  <div className="custom-time-inputs">
                    <div className="input-group">
                      <label htmlFor="custom-date">Date:</label>
                      <input
                        type="date"
                        id="custom-date"
                        value={customQuizDate}
                        onChange={(e) => setCustomQuizDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]} // Limit to today
                      />
                    </div>
                    <div className="input-group">
                      <label htmlFor="custom-time">Time:</label>
                      <input
                        type="time"
                        id="custom-time"
                        value={customQuizTime}
                        onChange={(e) => setCustomQuizTime(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          
          {errorMessage && (
            <div className="error-message">
              {errorMessage}
            </div>
          )}
        </div>
        
        <div className="quiz-modal-footer">
          <button className="cancel-btn" onClick={onClose}>
            {hasExistingScore ? "Close" : "Cancel"}
          </button>
          {!hasExistingScore && (
            <button 
              className="start-quiz-btn" 
              disabled={isLoading}
              onClick={handleSaveProgress}
            >
              {isLoading ? 'Saving...' : 'Submit Quiz'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizModal; 