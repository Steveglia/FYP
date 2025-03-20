import React, { useState, useEffect } from 'react';
import { ScheduleEvent } from './types';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from "../../../amplify/data/resource";
import { useAuthenticator } from '@aws-amplify/ui-react';
import * as hlrService from './hlrService';
import './LectureQuizModal.css';

const client = generateClient<Schema>();

interface LectureQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  lecture: ScheduleEvent | null;
  onProgressSaved?: (lectureId: string) => void;
}

interface ProgressData {
  completedLectures: string[];
  quizScore: number;
}

const LectureQuizModal: React.FC<LectureQuizModalProps> = ({
  isOpen,
  onClose,
  lecture,
  onProgressSaved
}) => {
  const { user } = useAuthenticator();
  const [score, setScore] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lectureScores, setLectureScores] = useState<Record<string, number>>({});
  
  // Load user progress data when modal opens
  useEffect(() => {
    if (isOpen && lecture) {
      setScore(0);
      setErrorMessage(null);
      loadUserProgress();
    }
  }, [isOpen, lecture, user]);
  
  // Load user progress data for all courses and lectures
  const loadUserProgress = async () => {
    if (!user?.username || !lecture?.id) return;
    
    try {
      // Get all progress records for this user
      const userProgress = await client.models.UserProgress.list({
        filter: { userId: { eq: user.username } }
      });
      
      if (userProgress.data && userProgress.data.length > 0) {
        const scoresByLectureId: Record<string, number> = {};
        
        // Process all progress records
        userProgress.data.forEach(record => {
          // Store lecture-specific scores
          if (record.lectureId) {
            scoresByLectureId[record.lectureId] = record.quizScores || 0;
          }
        });
        
        setLectureScores(scoresByLectureId);
        
        // Pre-fill with existing score if available for this specific lecture
        const lectureId = lecture.id;
        if (scoresByLectureId[lectureId]) {
          setScore(scoresByLectureId[lectureId]);
        } else {
          // Fallback to course score if no lecture-specific score
          const courseId = lecture.title?.split(':')[0]?.trim() || '';
          // Assuming progressByLecture is not used in this function
        }
      }
    } catch (error) {
      console.error('Error loading user progress:', error);
    }
  };
  
  const handleSaveProgress = async () => {
    if (!lecture || !user?.username) {
      setErrorMessage("Missing required information to save progress");
      return;
    }
    
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const courseId = lecture.title?.split(':')[0]?.trim() || 'UNKNOWN';
      const lectureId = lecture.id || '';
      const now = new Date();
      const nowISOString = now.toISOString();
      
      // First, check if there's an existing progress record for this specific lecture
      const existingLectureProgress = await client.models.UserProgress.list({
        filter: {
          and: [
            { userId: { eq: user.username } },
            { lectureId: { eq: lectureId } },
          ]
        }
      });
      
      // Save the quiz score progress
      let savedSuccessfully = false;
      let isFirstSubmission = false;
      
      if (existingLectureProgress.data && existingLectureProgress.data.length > 0) {
        // Update existing lecture-specific progress record
        const progressRecord = existingLectureProgress.data[0];
        
        // Check if this is essentially a first submission (no previous valid score)
        if (progressRecord.quizScores === null || progressRecord.quizScores === undefined) {
          isFirstSubmission = true;
        }
        
        // Update the quiz score
        try {
          const updateResult = await client.models.UserProgress.update({
            id: progressRecord.id,
            quizScores: score,
            lastAccessed: nowISOString
          });
          
          if (updateResult.errors) {
            throw new Error(`Failed to update: ${JSON.stringify(updateResult.errors)}`);
          }
          
          savedSuccessfully = true;
        } catch (updateError) {
          throw updateError;
        }
      } else {
        // Creating a new progress record - definitely a first submission
        isFirstSubmission = true;
        
        // Also check if we have a course-level progress record
        const existingCourseProgress = await client.models.UserProgress.list({
          filter: {
            and: [
              { userId: { eq: user.username } },
              { courseId: { eq: courseId } },
            ]
          }
        });
        
        // If there's an existing course record, make sure to maintain the completedLectures
        let completedLectures: string[] = [lectureId];
        if (existingCourseProgress.data && existingCourseProgress.data.length > 0) {
          const courseRecord = existingCourseProgress.data[0];
          completedLectures = [
            ...(courseRecord.completedLectures || []).filter((id): id is string => !!id && id !== lectureId),
            lectureId
          ];
        }
        
        const newProgressData = {
          userId: user.username,
          courseId: courseId,
          lectureId: lectureId,
          completedLectures: completedLectures,
          quizScores: score,
          lastAccessed: nowISOString
        };
        
        try {
          const createResult = await client.models.UserProgress.create(newProgressData);
          
          if (createResult.errors) {
            throw new Error(`Failed to create: ${JSON.stringify(createResult.errors)}`);
          }
          
          savedSuccessfully = true;
        } catch (createError) {
          throw createError;
        }
      }
      
      // Calculate and schedule next review session using Half-Life Regression
      if (savedSuccessfully) {
        try {
          // Check if there's already a scheduled review for this lecture
          const existingReviews = await client.models.ScheduledReviews.list({
            filter: {
              and: [
                { userId: { eq: user.username } },
                { lectureId: { eq: lectureId } }
              ]
            }
          });
          
          // Whether we need to create a new review schedule
          const shouldCreateReview = isFirstSubmission || existingReviews.data.length === 0;
          
          if (shouldCreateReview) {
            // For first submission, start with study count of 1
            let studyCount = 1;
            
            // Use the lecture date as the quiz completion time if available, otherwise use now
            const quizCompletionTime = lecture?.startDate ? new Date(lecture.startDate) : now;
            
            // Save the review using the enhanced HLR service with the actual quiz completion time
            const reviewScheduled = await hlrService.saveScheduledReview(
              user.username,
              courseId,
              lectureId,
              score,
              studyCount,
              quizCompletionTime
            );
            
            if (!reviewScheduled) {
              throw new Error('Failed to schedule review session');
            }
          }
        } catch (schedulingError) {
          setErrorMessage(`Saved progress but failed to schedule review: ${schedulingError instanceof Error ? schedulingError.message : 'Unknown error'}`);
        }
      }
      
      // Refresh progress data
      await loadUserProgress();
      
      // Only proceed with success steps if there wasn't an error message set above
      if (!errorMessage) {
        // Notify parent component
        if (onProgressSaved && lectureId) {
          onProgressSaved(lectureId);
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
        
        let confirmationMessage = `Progress saved! Score: ${score}% for ${lecture.title}`;
        
        if (scheduledReviews.data && scheduledReviews.data.length > 0) {
          const nextReview = new Date(scheduledReviews.data[0].reviewDate);
          confirmationMessage += `\n\nNext recommended review: ${nextReview.toLocaleDateString()} at ${nextReview.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else {
          confirmationMessage += `\n\nWarning: No upcoming review was scheduled. Please contact support.`;
        }
        
        alert(confirmationMessage);
        
        // Close the modal after saving
        onClose();
      }
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
      return '';
    }
  };
  
  // Helper function to safely format times
  const formatTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };
  
  // Handle score change
  const handleScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newScore = parseInt(e.target.value, 10);
    setScore(isNaN(newScore) ? 0 : Math.min(100, Math.max(0, newScore)));
  };
  
  if (!isOpen || !lecture) return null;
  
  return (
    <div className={`modal ${isOpen ? 'open' : ''}`}>
      <div className="modal-content">
        <span className="close-button" onClick={onClose}>&times;</span>
        
        <h2>Quiz Score for Lecture</h2>
        
        {lecture && (
          <div className="lecture-details">
            <p><strong>Title:</strong> {lecture.title}</p>
            <p><strong>Date:</strong> {formatDate(lecture.startDate)} at {formatTime(lecture.startDate)}</p>
            {lecture.description && <p><strong>Description:</strong> {lecture.description}</p>}
            {lecture.location && <p><strong>Location:</strong> {lecture.location}</p>}
            
            {/* Show previous score if it exists */}
            {lecture.id && lectureScores[lecture.id] > 0 && (
              <div className="previous-score-alert">
                <p>You previously submitted a score of <strong>{lectureScores[lecture.id]}%</strong> for this lecture.</p>
                <p>You can update your score below if needed.</p>
              </div>
            )}
            
            <div className="quiz-score-input">
              <label htmlFor="quiz-score">
                Enter your quiz score (0-100%) for this specific lecture:
              </label>
              <input
                type="number"
                id="quiz-score"
                min="0"
                max="100"
                value={score}
                onChange={handleScoreChange}
              />
            </div>
            
            {errorMessage && (
              <div className="error-message">
                {errorMessage}
              </div>
            )}
            
            <div className="button-container">
              <button
                className="submit-button"
                onClick={handleSaveProgress}
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : lecture.id && lectureScores[lecture.id] > 0 ? 'Update Score' : 'Save Score'}
              </button>
              <button className="cancel-button" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LectureQuizModal; 