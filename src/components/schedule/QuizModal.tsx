import React, { useState, useEffect } from 'react';
import { ScheduleEvent, Event } from './types';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from "../../../amplify/data/resource";
import { useAuthenticator } from '@aws-amplify/ui-react';
import * as hlrService from './hlrService';
import './QuizModal.css';

const client = generateClient<Schema>();

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  studySession: ScheduleEvent | null;
  lectures: Event[];
  onProgressSaved?: () => void;
}

interface ProgressData {
  completedLectures: string[];
  quizScore: number;
}

const QuizModal: React.FC<QuizModalProps> = ({
  isOpen,
  onClose,
  studySession,
  lectures,
  onProgressSaved
}) => {
  const { user } = useAuthenticator();
  const [selectedLecture, setSelectedLecture] = useState<string>('');
  const [selectedLectureData, setSelectedLectureData] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, ProgressData>>({});
  
  // Load user progress data when modal opens
  useEffect(() => {
    if (isOpen && studySession) {
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
      
      // If it's a lecture, automatically select it
      if (studySession.isLecture && studySession.id) {
        setSelectedLecture(studySession.id);
      } else {
        setSelectedLecture('');
      }
      
      setSelectedLectureData(null);
      setScore(0);
      setErrorMessage(null);
      
      // Load existing progress data when modal opens
      loadUserProgress();
    }
  }, [isOpen, studySession, user]);
  
  // Load user progress data for all courses
  const loadUserProgress = async () => {
    if (!user?.username) return;
    
    try {
      const userProgress = await client.models.UserProgress.list({
        filter: { userId: { eq: user.username } }
      });
      
      if (userProgress.data && userProgress.data.length > 0) {
        const progressByLecture: Record<string, ProgressData> = {};
        
        userProgress.data.forEach(record => {
          if (record.courseId) {
            progressByLecture[record.courseId] = {
              completedLectures: record.completedLectures?.filter((item): item is string => item !== null) || [],
              quizScore: record.quizScores || 0
            };
          }
        });
        
        setProgress(progressByLecture);
        console.log('Loaded user progress:', progressByLecture);
      }
    } catch (error) {
      console.error('Error loading user progress:', error);
    }
  };
  
  // Update the selected lecture data when a lecture is selected
  useEffect(() => {
    if (selectedLecture) {
      const lecture = lectures.find(l => l.id === selectedLecture) || null;
      setSelectedLectureData(lecture);
      
      // Pre-fill with existing score if available
      if (lecture) {
        const courseId = lecture.title?.split(':')[0]?.trim() || '';
        if (progress[courseId]) {
          setScore(progress[courseId].quizScore);
        } else {
          setScore(0);
        }
      }
    } else {
      setSelectedLectureData(null);
    }
  }, [selectedLecture, lectures, progress]);
  
  // Filter for lectures from the current week
  const weekLectures = lectures.filter(lecture => lecture.isLecture);
  
  const handleSaveProgress = async () => {
    if (!selectedLecture || !selectedLectureData || !user?.username) {
      setErrorMessage("Missing required information to save progress");
      console.error("Save failed - missing data:", { 
        selectedLecture, 
        selectedLectureData, 
        userId: user?.username 
      });
      return;
    }
    
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const courseId = selectedLectureData.title?.split(':')[0]?.trim() || 'UNKNOWN';
      const lectureId = selectedLectureData.id || '';
      const now = new Date().toISOString();
      
      console.log("Attempting to save progress with:", {
        userId: user.username,
        courseId,
        lectureId, 
        score,
        timestamp: now
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
          quizScores: score,
          completedLectures,
          lastAccessed: now
        });
        
        try {
          const updateResult = await client.models.UserProgress.update({
            id: progressRecord.id,
            quizScores: score,
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
          lectureId: lectureId,
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
          
          // Use the study session date as the quiz completion time instead of current time
          // This ensures we're using the scheduled study session time, not when user submits
          const quizCompletionTime = studySession?.startDate ? new Date(studySession.startDate) : new Date(now);
          
          console.log(`Quiz completion time: ${quizCompletionTime.toLocaleString()} (based on scheduled study session)`);
          
          // Save the review using the enhanced HLR service with the actual quiz completion time
          const reviewScheduled = await hlrService.saveScheduledReview(
            user.username,
            courseId,
            lectureId,
            score,
            studyCount,
            quizCompletionTime
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
      
      let confirmationMessage = `Progress saved! Score: ${score}% for ${selectedLectureData.title}`;
      
      if (scheduledReviews.data && scheduledReviews.data.length > 0) {
        const nextReview = new Date(scheduledReviews.data[0].reviewDate);
        confirmationMessage += `\n\nNext recommended review: ${nextReview.toLocaleDateString()} at ${nextReview.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      
      alert(confirmationMessage);
      
      // Close the modal after saving
      onClose();
    } catch (error) {
      console.error('Error saving progress:', error);
      setErrorMessage(`Failed to save progress: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  
  // Helper function to get lecture previous score if available
  const getLecturePreviousScore = (lecture: Event): number | null => {
    if (!lecture || !lecture.title) return null;
    
    const courseId = lecture.title.split(':')[0]?.trim() || '';
    if (progress[courseId] && progress[courseId].quizScore > 0) {
      return progress[courseId].quizScore;
    }
    
    return null;
  };
  
  // Handle score change
  const handleScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newScore = parseInt(e.target.value, 10);
    setScore(isNaN(newScore) ? 0 : Math.min(100, Math.max(0, newScore)));
  };
  
  if (!isOpen || !studySession) return null;
  
  const isLectureQuiz = studySession.isLecture;
  const displayTitle = isLectureQuiz ? "Lecture Quiz" : "Track Study Progress";
  
  return (
    <div className="quiz-modal-overlay" onClick={onClose}>
      <div className="quiz-modal-content" onClick={e => e.stopPropagation()}>
        <div className="quiz-modal-header">
          <h2>{displayTitle}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="quiz-modal-body">
          <p>
            {isLectureQuiz 
              ? `Record your understanding of this lecture from ${formatDate(studySession.startDate)} at ${formatTime(studySession.startDate)}.` 
              : `Record your progress for this study session on ${formatDate(studySession.startDate)} from ${formatTime(studySession.startDate)} to ${formatTime(studySession.endDate)}.`
            }
          </p>
          
          {!isLectureQuiz && (
            <div className="lecture-selection">
              <h3>Select a lecture you studied:</h3>
              
              {weekLectures.length > 0 ? (
                <div className="lecture-options">
                  {weekLectures.map(lecture => {
                    const previousScore = getLecturePreviousScore(lecture);
                    
                    return (
                      <div 
                        key={lecture.id} 
                        className={`lecture-option ${selectedLecture === lecture.id ? 'selected' : ''} ${previousScore !== null ? 'has-score' : ''}`}
                        onClick={() => setSelectedLecture(lecture.id)}
                      >
                        <div className="radio-button">
                          <div className={`radio-inner ${selectedLecture === lecture.id ? 'checked' : ''}`} />
                        </div>
                        <div className="lecture-info">
                          <h4>{lecture.title}</h4>
                          <p>{lecture.description}</p>
                          <small>
                            {formatDate(lecture.startDate)} at {formatTime(lecture.startDate)}
                            {previousScore !== null && (
                              <span className="previous-score">
                                Previous score: {previousScore}%
                              </span>
                            )}
                          </small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="no-lectures">No lectures found for this week.</p>
              )}
            </div>
          )}
          
          {(selectedLecture || isLectureQuiz) && (
            <div className="score-input-container">
              <label htmlFor="score-input">Your {isLectureQuiz ? "quiz" : "progress"} score (0-100%):</label>
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
          )}
          
          {errorMessage && (
            <div className="error-message">
              {errorMessage}
            </div>
          )}
        </div>
        
        <div className="quiz-modal-footer">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button 
            className="start-quiz-btn" 
            disabled={((!selectedLecture && !isLectureQuiz) || isLoading)}
            onClick={handleSaveProgress}
          >
            {isLoading ? 'Saving...' : isLectureQuiz ? 'Submit Quiz' : 'Save Progress'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizModal; 