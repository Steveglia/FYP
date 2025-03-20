import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import type { Schema } from '../../../amplify/data/resource';
import './ScheduledReviewsPanel.css';

interface ScheduledReviewsProps {
  userId: string;
}

interface ScheduledReview {
  id: string;
  courseId: string;
  lectureId: string;
  reviewDate: string;
  lastScore: number;
  halfLife: number;
  studyCount: number;
  lastReviewDate: string;
  isCompleted?: boolean;
}

interface LectureInfo {
  id: string;
  title?: string;
  description?: string;
  courseId?: string;
}

const client = generateClient<Schema>();

const ScheduledReviewsPanel: React.FC<ScheduledReviewsProps> = ({ userId }) => {
  const [upcomingReviews, setUpcomingReviews] = useState<ScheduledReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lectures, setLectures] = useState<Record<string, LectureInfo>>({});
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchScheduledReviews();
    }
  }, [userId]);

  const fetchScheduledReviews = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Use the Amplify Data API directly to fetch reviews
      const response = await client.models.ScheduledReviews.list({
        filter: {
          userId: { eq: userId }
        }
      });
      
      if (response.data && response.data.length > 0) {
        // Get all user progress records to check which reviews have quiz scores
        const progressRecords = await client.models.UserProgress.list({
          filter: { userId: { eq: userId } }
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
        
        // Transform review data and filter out completed reviews
        const upcoming = response.data
          .map(review => {
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
          })
          // Show all reviews, including completed ones
          // .filter(review => !review.isCompleted)
          .sort((a, b) => new Date(a.reviewDate).getTime() - new Date(b.reviewDate).getTime());
        
        setUpcomingReviews(upcoming);
        
        // Fetch lecture info for these reviews
        const lectureIds = [...new Set(upcoming.map(review => review.lectureId))];
        if (lectureIds.length > 0) {
          // Wait for lecture info to be fetched before setting loading to false
          await fetchLectureInfo(lectureIds);
        }
      } else {
        // If no data is found, set an empty array
        setUpcomingReviews([]);
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
      
      // Fetch lecture info from both lectures and calendar events
      for (const id of lectureIds) {
        // Try CalendarEvent first
        try {
          const calendarResult = await client.models.CalendarEvent.get({ id });
          if (calendarResult.data) {
            const event = calendarResult.data;
            // Try to extract course ID from title (assuming format "COURSE: Lecture")
            let courseId = '';
            if (event.title) {
              const titleParts = event.title.split(':');
              if (titleParts.length > 0) {
                courseId = titleParts[0].trim();
              }
            }
            
            lectureInfo[id] = {
              id: event.id,
              title: event.title || undefined,
              description: event.description || undefined,
              courseId: courseId
            };
            continue; // Skip to next ID if found
          }
        } catch (e) {
          console.log(`Calendar event not found for lecture ID: ${id}`);
        }
        
        // Try Lectures model if calendar event not found
        try {
          const lectureResult = await client.models.Lectures.get({ id });
          if (lectureResult.data) {
            const lecture = lectureResult.data;
            lectureInfo[id] = {
              id: lecture.id,
              title: lecture.title || undefined,
              description: lecture.content || undefined,
              courseId: lecture.courseId || undefined
            };
          }
        } catch (e) {
          console.log(`Lecture not found for ID: ${id}`);
        }
      }
      
      setLectures(lectureInfo);
      console.log('Lecture information loaded:', Object.keys(lectureInfo).length, 'lectures');
    } catch (err) {
      console.error('Error fetching lecture information:', err);
    }
  };

  const handleReviewClick = (reviewId: string) => {
    setSelectedReviewId(reviewId === selectedReviewId ? null : reviewId);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getDaysUntil = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return `In ${diffDays} days`;
  };
  
  const getDaysSinceLastReview = (lastReviewDate: string) => {
    const reviewDate = new Date(lastReviewDate);
    const now = new Date();
    const diffTime = now.getTime() - reviewDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  return (
    <div className="scheduled-reviews-panel">
      <div className="panel-header">
        <h2>Upcoming Review Sessions</h2>
        <button 
          className="refresh-button" 
          onClick={fetchScheduledReviews} 
          aria-label="Refresh reviews"
        >
          ⟳
        </button>
      </div>
      
      {isLoading ? (
        <div className="loading-indicator">Loading your scheduled reviews...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : upcomingReviews.length === 0 ? (
        <div className="no-reviews-message">
          <p>You don't have any upcoming review sessions scheduled.</p>
          <p>Complete study sessions and record your progress to get personalized review recommendations.</p>
        </div>
      ) : (
        <div className="reviews-list">
          {upcomingReviews.map(review => {
            const lecture = lectures[review.lectureId];
            const title = lecture?.title || 'Unknown Lecture';
            
            return (
              <div 
                key={review.id} 
                className={`review-item ${selectedReviewId === review.id ? 'expanded' : ''}`}
                onClick={() => handleReviewClick(review.id)}
              >
                <div className="review-date">
                  <div className="date-display">{formatDate(review.reviewDate)}</div>
                  <div className="time-display">{formatTime(review.reviewDate)}</div>
                  <div className="days-until">{getDaysUntil(review.reviewDate)}</div>
                </div>
                <div className="review-details">
                  <div className="review-title">{title}</div>
                  {lecture?.description && (
                    <div className="review-description">{lecture.description}</div>
                  )}
                  <div className="review-meta">
                    <span className="review-score">Last score: {review.lastScore}%</span>
                    <span className="review-count">Study count: {review.studyCount}</span>
                  </div>
                  {selectedReviewId === review.id && (
                    <div className="review-extra-details">
                      <div className="review-calculated-info">
                        <p>Half-life: {review.halfLife.toFixed(1)} days</p>
                        <p>Last reviewed: {formatDate(review.lastReviewDate)} ({getDaysSinceLastReview(review.lastReviewDate)})</p>
                        <p>Course: {lecture?.courseId || review.courseId || 'Unknown'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ScheduledReviewsPanel; 