import React, { useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import { useAuthenticator } from '@aws-amplify/ui-react';
import type { Schema } from "../../../amplify/data/resource";
import * as hlrService from './hlrService';
import './ReviewCard.css';

const client = generateClient<Schema>();

interface ReviewCardProps {
  review: {
    id: string;
    courseId: string;
    lectureId: string;
    reviewDate: string;
    lastScore: number;
    halfLife: number;
    studyCount: number;
    lastReviewDate: string;
    isCompleted?: boolean;
  };
  lectureInfo?: {
    id: string;
    title?: string;
    content?: string;
    courseId?: string;
  };
  onReviewCompleted: () => void;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ review, lectureInfo, onReviewCompleted }) => {
  const { user } = useAuthenticator();
  const [expanded, setExpanded] = useState(false);
  const [showQuizInput, setShowQuizInput] = useState(false);
  const [quizScore, setQuizScore] = useState(review?.lastScore || 70);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Safety check - if review is undefined, render a placeholder
  if (!review) {
    return (
      <div className="review-card error">
        <div className="review-card-header">
          <div className="review-title">Error: Review data is missing</div>
        </div>
        <div className="review-card-content">
          <p>The review data appears to be missing or invalid.</p>
        </div>
      </div>
    );
  }

  const handleCardClick = () => {
    setExpanded(!expanded);
  };

  const handleStartReview = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click
    setShowQuizInput(true);
  };

  const handleScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newScore = parseInt(e.target.value, 10);
    setQuizScore(isNaN(newScore) ? 0 : Math.min(100, Math.max(0, newScore)));
  };

  const handleSubmitScore = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent triggering card expansion
    
    setIsSubmitting(true);
    setErrorMessage(null);
    
    try {
      // Get user ID from authenticator hook
      if (!user?.username) {
        throw new Error('User not found');
      }
      
      const userId = user.username;
      const now = new Date();
      const nowISOString = now.toISOString();
      
      // Use the scheduled review date instead of current date for spacing algorithm
      const scheduledReviewDate = new Date(review.reviewDate);
      
      // 1. Update progress record in UserProgress to record this review completion
      // First check if there's an existing progress record for this lecture
      const existingProgress = await client.models.UserProgress.list({
        filter: {
          and: [
            { userId: { eq: userId } },
            { lectureId: { eq: review.lectureId } }
          ]
        }
      });
      
      let progressRecordUpdated = false;
      
      if (existingProgress.data && existingProgress.data.length > 0) {
        // Update existing record with the new score from this review
        const progressRecord = existingProgress.data[0];
        
        try {
          await client.models.UserProgress.update({
            id: progressRecord.id,
            quizScores: quizScore,
            lastAccessed: nowISOString // Use current time for when the progress was updated
          });
          progressRecordUpdated = true;
        } catch (error) {
          console.error("Error updating progress record:", error);
          throw error;
        }
      } else {
        // Create new progress record if one doesn't exist
        const courseId = review.courseId || (lectureInfo?.courseId || '');
        
        try {
          await client.models.UserProgress.create({
            userId,
            lectureId: review.lectureId,
            courseId,
            quizScores: quizScore,
            completedLectures: [review.lectureId],
            lastAccessed: nowISOString // Use current time for when the progress was created
          });
          progressRecordUpdated = true;
        } catch (error) {
          console.error("Error creating progress record:", error);
          throw error;
        }
      }
      
      if (!progressRecordUpdated) {
        throw new Error("Failed to update progress record");
      }
      
      // 2. Mark the current review as completed
      try {
        // Get the current review to update
        const existingReviews = await client.models.ScheduledReviews.list({
          filter: {
            userId: { eq: userId },
            lectureId: { eq: review.lectureId }
          }
        });
      } catch (error) {
        console.error("Error handling review completion status:", error);
        // Continue with scheduling next review even if marking as completed fails
      }
      
      // 3. Schedule next review based on this new score
      // Increment study count since this is another review
      const nextStudyCount = review.studyCount + 1;
      
      const reviewScheduled = await hlrService.saveScheduledReview(
        userId,
        review.courseId,
        review.lectureId,
        quizScore,               // Use the score from the review quiz
        nextStudyCount,
        scheduledReviewDate      // Use scheduled review date rather than actual completion date
      );
      
      if (!reviewScheduled) {
        throw new Error('Failed to schedule next review');
      }
      
      // 4. Show success and reset UI
      alert(`Review completed! Score: ${quizScore}% saved. Your next review has been scheduled based on your performance.`);
      setShowQuizInput(false);
      
      // 5. Refresh parent component to show updated data
      onReviewCompleted();
      
    } catch (error) {
      console.error('Error saving review score:', error);
      setErrorMessage(`Failed to save review: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelQuiz = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click
    setShowQuizInput(false);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        year: 'numeric' 
      });
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString(undefined, { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (e) {
      return 'Invalid Time';
    }
  };

  const getDaysUntil = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = date.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Tomorrow';
      if (diffDays < 0) return 'Past due';
      return `In ${diffDays} days`;
    } catch (e) {
      return 'Unknown';
    }
  };
  
  const getDaysSinceLastReview = (lastReviewDate: string) => {
    try {
      const reviewDate = new Date(lastReviewDate);
      const now = new Date();
      const diffTime = now.getTime() - reviewDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      return `${diffDays} days ago`;
    } catch (e) {
      return 'Unknown';
    }
  };

  const isPastDue = () => {
    try {
      const reviewDate = new Date(review.reviewDate);
      const now = new Date();
      return reviewDate < now;
    } catch (e) {
      return false;
    }
  };

  const isToday = () => {
    try {
      const reviewDate = new Date(review.reviewDate);
      const now = new Date();
      return reviewDate.toDateString() === now.toDateString();
    } catch (e) {
      return false;
    }
  };

  return (
    <div 
      className={`review-card ${expanded ? 'expanded' : ''} ${isPastDue() ? 'past-due' : ''} ${isToday() ? 'today' : ''}`}
      onClick={handleCardClick}
    >
      <div className="review-card-header">
        <div className="review-date">
          <div className="date-display">{formatDate(review.reviewDate)}</div>
          <div className="time-display">{formatTime(review.reviewDate)}</div>
          <div className="days-until">{getDaysUntil(review.reviewDate)}</div>
        </div>
        <div className="review-title">
          {lectureInfo?.title || `Lecture ID: ${review.lectureId.substring(0, 8)}...`}
        </div>
      </div>
      
      <div className="review-card-content">
        <div className="review-meta">
          <span className="review-score">Last score: {review.lastScore}%</span>
          <span className="review-count">Study count: {review.studyCount}</span>
        </div>
        
        {expanded && (
          <div className="review-details">
            <div className="review-calculated-info">
              <p>Half-life: {review.halfLife.toFixed(1)} days</p>
              <p>Last reviewed: {formatDate(review.lastReviewDate)} ({getDaysSinceLastReview(review.lastReviewDate)})</p>
              <p>Course: {lectureInfo?.courseId || review.courseId || 'Unknown'}</p>
              {isPastDue() && <p className="status-message warning">This review is past due.</p>}
            </div>
            
            {!showQuizInput && (
              <button 
                className="start-review-button" 
                onClick={handleStartReview}
              >
                Record Review Score
              </button>
            )}
            
            {showQuizInput && (
              <form className="quiz-form" onSubmit={handleSubmitScore} onClick={e => e.stopPropagation()}>
                <h3>Enter your quiz score for this review</h3>
                <div className="score-input-container">
                  <label htmlFor="quiz-score">Score (0-100%)</label>
                  <input
                    type="number"
                    id="quiz-score"
                    min="0"
                    max="100"
                    value={quizScore}
                    onChange={handleScoreChange}
                  />
                </div>
                
                {errorMessage && (
                  <div className="error-message">{errorMessage}</div>
                )}
                
                <div className="form-buttons">
                  <button 
                    type="submit" 
                    className="submit-score-button"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Score'}
                  </button>
                  <button 
                    type="button" 
                    className="cancel-button"
                    onClick={handleCancelQuiz}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewCard; 