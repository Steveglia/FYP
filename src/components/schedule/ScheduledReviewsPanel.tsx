import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import type { Schema } from '../../../amplify/data/resource';
import * as hlrService from './hlrService';
import './ScheduledReviewsPanel.css';
import { useTimeContext } from '../../context/TimeContext';

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
}

interface LectureInfo {
  id: string;
  title?: string;
  description?: string;
  courseId?: string;
}

interface DeleteDialogOptions {
  isOpen: boolean;
  type: 'all' | 'course' | 'lecture';
  courseId?: string;
  lectureId?: string;
  title?: string;
}

const client = generateClient<Schema>();

const ScheduledReviewsPanel: React.FC<ScheduledReviewsProps> = ({ userId }) => {
  const { getCurrentTime } = useTimeContext();
  const [upcomingReviews, setUpcomingReviews] = useState<ScheduledReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lectures, setLectures] = useState<Record<string, LectureInfo>>({});
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogOptions>({
    isOpen: false,
    type: 'all'
  });
  const [showManagementOptions, setShowManagementOptions] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchScheduledReviews();
    }
  }, [userId]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (deleteSuccess) {
      const timer = setTimeout(() => {
        setDeleteSuccess(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [deleteSuccess]);

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
      
      console.log('Scheduled reviews response:', response);
      
      if (response.data && response.data.length > 0) {
        // Filter for upcoming reviews
        const now = new Date();
        const upcoming = response.data
          .filter(review => new Date(review.reviewDate) >= now)
          .map(review => ({
            id: review.id,
            courseId: review.courseId,
            lectureId: review.lectureId,
            reviewDate: review.reviewDate,
            lastScore: review.lastScore || 0,
            halfLife: review.halfLife,
            studyCount: review.studyCount || 1,
            lastReviewDate: review.lastReviewDate || now.toISOString()
          }))
          .sort((a, b) => new Date(a.reviewDate).getTime() - new Date(b.reviewDate).getTime());
        
        console.log('Filtered upcoming reviews:', upcoming.length);
        setUpcomingReviews(upcoming);
        
        // Fetch lecture info for these reviews
        const lectureIds = [...new Set(upcoming.map(review => review.lectureId))];
        if (lectureIds.length > 0) {
          fetchLectureInfo(lectureIds);
        }
      } else {
        // If no data is found, set an empty array
        setUpcomingReviews([]);
      }
    } catch (err) {
      console.error('Error fetching scheduled reviews:', err);
      setError('Failed to load your scheduled reviews. Please try again later.');
    } finally {
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
    try {
      const reviewDate = new Date(dateString);
      // Use the global current time for calculations
      const now = getCurrentTime();
      
      // Reset time part for accurate day calculation
      now.setHours(0, 0, 0, 0);
      const tempReviewDate = new Date(reviewDate);
      tempReviewDate.setHours(0, 0, 0, 0);
      
      const diffTime = tempReviewDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Tomorrow';
      if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
      return `In ${diffDays} days`;
    } catch (e) {
      console.error('Error calculating days until:', e);
      return 'Unknown';
    }
  };
  
  const getDaysSinceLastReview = (lastReviewDate: string) => {
    try {
      const reviewDate = new Date(lastReviewDate);
      // Use the global current time for calculations
      const now = getCurrentTime();
      
      // Reset time part for accurate day calculation
      now.setHours(0, 0, 0, 0);
      const tempReviewDate = new Date(reviewDate);
      tempReviewDate.setHours(0, 0, 0, 0);
      
      const diffTime = now.getTime() - tempReviewDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      return `${diffDays} days ago`;
    } catch (e) {
      console.error('Error calculating days since last review:', e);
      return 'Unknown';
    }
  };

  // Toggle the management options section
  const toggleManagementOptions = () => {
    setShowManagementOptions(!showManagementOptions);
  };

  // Open confirmation dialog for deleting
  const openDeleteDialog = (type: 'all' | 'course' | 'lecture', courseId?: string, lectureId?: string, title?: string) => {
    setDeleteDialog({
      isOpen: true,
      type,
      courseId,
      lectureId,
      title
    });
  };

  // Close the delete confirmation dialog
  const closeDeleteDialog = () => {
    setDeleteDialog({
      ...deleteDialog,
      isOpen: false
    });
  };

  // Handle the actual deletion
  const handleDelete = async () => {
    if (!userId) return;
    
    setIsDeleting(true);
    
    try {
      const { type, courseId, lectureId } = deleteDialog;
      
      // Delete both progress and scheduled reviews
      const result = await hlrService.syncDeleteUserData(
        userId,
        type === 'course' ? courseId : undefined,
        type === 'lecture' ? lectureId : undefined
      );
      
      // Show success message
      setDeleteSuccess(`Successfully deleted ${result.reviewsDeleted} reviews and ${result.progressDeleted} progress records.`);
      
      // Refresh reviews
      await fetchScheduledReviews();
      
      // Close dialog
      closeDeleteDialog();
    } catch (error) {
      console.error('Error during deletion:', error);
      setError('Failed to delete records. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Get unique course IDs from reviews
  const getUniqueCourses = (): {id: string, name: string}[] => {
    const courseMap = new Map<string, string>();
    
    upcomingReviews.forEach(review => {
      if (!courseMap.has(review.courseId)) {
        const lectureName = lectures[review.lectureId]?.title || '';
        const courseName = lectureName.split(':')[0]?.trim() || review.courseId;
        courseMap.set(review.courseId, courseName);
      }
    });
    
    return Array.from(courseMap.entries()).map(([id, name]) => ({ id, name }));
  };

  return (
    <div className="scheduled-reviews-panel">
      <div className="panel-header">
        <h2>Upcoming Review Sessions</h2>
        <div className="panel-actions">
          <button 
            className="manage-button" 
            onClick={toggleManagementOptions}
            aria-label="Manage reviews"
          >
            ⚙️
          </button>
          <button 
            className="refresh-button" 
            onClick={fetchScheduledReviews} 
            aria-label="Refresh reviews"
          >
            ⟳
          </button>
        </div>
      </div>
      
      {/* Success message */}
      {deleteSuccess && (
        <div className="success-message">
          {deleteSuccess}
        </div>
      )}
      
      {/* Management options */}
      {showManagementOptions && (
        <div className="management-options">
          <h3>Manage Your Reviews</h3>
          <p className="management-description">
            Clear your progress and scheduled reviews. This action cannot be undone.
          </p>
          
          <div className="management-actions">
            <button 
              className="delete-all-button"
              onClick={() => openDeleteDialog('all')}
              disabled={upcomingReviews.length === 0}
            >
              Clear All Reviews & Progress
            </button>
          </div>
          
          {upcomingReviews.length > 0 && (
            <div className="course-management">
              <h4>Clear by Course</h4>
              <div className="course-list">
                {getUniqueCourses().map(course => (
                  <div key={course.id} className="course-item">
                    <span className="course-name">{course.name}</span>
                    <button 
                      className="delete-course-button"
                      onClick={() => openDeleteDialog('course', course.id, undefined, course.name)}
                    >
                      Clear
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Delete confirmation dialog */}
      {deleteDialog.isOpen && (
        <div className="delete-dialog-overlay">
          <div className="delete-dialog">
            <h3>Confirm Deletion</h3>
            <p>
              {deleteDialog.type === 'all' && 'Are you sure you want to clear all your progress and scheduled reviews?'}
              {deleteDialog.type === 'course' && `Are you sure you want to clear all progress and reviews for ${deleteDialog.title || 'this course'}?`}
              {deleteDialog.type === 'lecture' && `Are you sure you want to clear progress and reviews for ${deleteDialog.title || 'this lecture'}?`}
            </p>
            <p className="warning-text">This action cannot be undone.</p>
            
            <div className="dialog-actions">
              <button 
                className="cancel-button"
                onClick={closeDeleteDialog}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                className="confirm-delete-button"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      
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
                      <button 
                        className="delete-review-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteDialog('lecture', undefined, review.lectureId, title);
                        }}
                      >
                        Clear this review
                      </button>
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