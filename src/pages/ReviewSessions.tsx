import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { useAuthenticator } from '@aws-amplify/ui-react';
import ReviewCard from '../components/schedule/ReviewCard';
import './ReviewSessions.css';

interface ScheduledReview {
  id: string;
  courseId: string;
  lectureId: string;
  reviewDate: string;
  lastScore: number;
  halfLife: number;
  studyCount: number;
  lastReviewDate: string;
  isCompleted?: boolean; // Flag to mark if review has been completed
}

interface LectureInfo {
  id: string;
  title?: string;
  content?: string;
  courseId?: string;
}

const client = generateClient<Schema>();

const ReviewSessions: React.FC = () => {
  const { user } = useAuthenticator();
  const [reviewSessions, setReviewSessions] = useState<ScheduledReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lectures, setLectures] = useState<Record<string, LectureInfo>>({});
  
  useEffect(() => {
    if (user?.username) {
      fetchScheduledReviews();
    }
  }, [user]);

  const fetchScheduledReviews = async () => {
    if (!user?.username) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Use the Amplify Data API to fetch all reviews
      const response = await client.models.ScheduledReviews.list({
        filter: {
          userId: { eq: user.username }
        }
      });
      
      if (response.data && response.data.length > 0) {
        // Get all user progress records to check which reviews have quiz scores
        const progressRecords = await client.models.UserProgress.list({
          filter: { userId: { eq: user.username } }
        });
        
        // Create a map of lectureId to their latest quiz score submission times
        const lectureProgressMap: Record<string, { hasSubmitted: boolean, submissionTime: Date }> = {};
        
        if (progressRecords.data) {
          progressRecords.data.forEach(record => {
            if (record.lectureId && record.lastAccessed) {
              // Check if this is a newer submission than any existing one
              const currentSubmission = new Date(record.lastAccessed);
              const existingRecord = lectureProgressMap[record.lectureId];
              
              if (!existingRecord || currentSubmission > existingRecord.submissionTime) {
                lectureProgressMap[record.lectureId] = {
                  hasSubmitted: (record.quizScores !== null && record.quizScores !== undefined),
                  submissionTime: currentSubmission
                };
              }
            }
          });
        }
        
        // Transform all review data
        const allReviews = response.data.map(review => {
          // A review is considered "completed" if:
          // 1. There's a progress record for this lecture
          // 2. AND the submission time is AFTER the scheduled review date
          const reviewDate = new Date(review.reviewDate);
          const progress = lectureProgressMap[review.lectureId];
          
          const isCompleted = progress && 
                             progress.hasSubmitted && 
                             progress.submissionTime > reviewDate;
          
          return {
            id: review.id,
            courseId: review.courseId,
            lectureId: review.lectureId,
            reviewDate: review.reviewDate,
            lastScore: review.lastScore || 0,
            halfLife: review.halfLife,
            studyCount: review.studyCount || 1,
            lastReviewDate: review.lastReviewDate || new Date().toISOString(),
            isCompleted
          };
        });
        
        // Only show non-completed reviews
        const activeReviews = allReviews
          // Commenting out the filter to show ALL reviews, including past ones
          // .filter(review => !review.isCompleted)
          .sort((a, b) => new Date(a.reviewDate).getTime() - new Date(b.reviewDate).getTime());
        
        setReviewSessions(activeReviews);
        
        // Fetch lecture info for all reviews
        const lectureIds = [...new Set(allReviews.map(review => review.lectureId))];
        if (lectureIds.length > 0) {
          // Keep loading state on until both the reviews and lecture info are loaded
          await fetchLectureInfo(lectureIds);
        }
      } else {
        // If no data is found, set empty array
        setReviewSessions([]);
      }
    } catch (err) {
      console.error('Error fetching scheduled reviews:', err);
      setError('Failed to load your scheduled reviews. Please try again later.');
    } finally {
      // Only complete loading once everything is done
      setIsLoading(false);
    }
  };

  const fetchLectureInfo = async (lectureIds: string[]) => {
    try {
      const lectureInfo: Record<string, LectureInfo> = {};
      
      // Fetch lecture info from Lectures model
      for (const id of lectureIds) {
        try {
          const lectureResult = await client.models.Lectures.get({ id });
          if (lectureResult.data) {
            const lecture = lectureResult.data;
            lectureInfo[id] = {
              id: lecture.id,
              title: lecture.title || undefined,
              content: lecture.content || undefined,
              courseId: lecture.courseId || undefined
            };
          }
        } catch (e) {
          console.log(`Lecture not found for ID: ${id}`);
        }
      }
      
      setLectures(lectureInfo);
    } catch (err) {
      console.error('Error fetching lecture information:', err);
    }
  };

  const handleReviewCompleted = () => {
    // Refresh the review data
    fetchScheduledReviews();
  };

  return (
    <div className="review-sessions-page">
      <div className="reviews-header">
        <h1>Review Sessions</h1>
        <p className="page-description">
          Manage your scheduled review sessions based on your learning patterns and progress.
        </p>
        
        <div className="refresh-button-container">
          <button 
            className="refresh-button" 
            onClick={fetchScheduledReviews} 
            aria-label="Refresh reviews"
          >
            Refresh ⟳
          </button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="loading-indicator">
          <span className="loading-spinner"></span>
          <span className="loading-text">Loading your review sessions...</span>
        </div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : reviewSessions.length === 0 ? (
        <div className="no-reviews-message">
          <p>You don't have any scheduled review sessions.</p>
          <p>Complete study sessions and record your progress to get personalized review recommendations.</p>
        </div>
      ) : (
        <div className="reviews-container">
          <div className="group-header">
            <h3>Available Reviews</h3>
            <p className="group-description">
              Review sessions are scheduled based on your memory retention patterns for optimal learning.
            </p>
          </div>
          <div className="reviews-card-grid">
            {reviewSessions.map(review => (
              <ReviewCard
                key={review.id}
                review={review}
                lectureInfo={lectures[review.lectureId]}
                onReviewCompleted={handleReviewCompleted}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewSessions; 