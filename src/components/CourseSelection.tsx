import React, { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import { useAuthenticator } from '@aws-amplify/ui-react';
import type { Schema } from '../../amplify/data/resource';
import './CourseSelection.css';

const client = generateClient<Schema>();

// Simplify to just use string IDs instead of the CourseData interface
interface CourseSelectionProps {
  onCoursesChange?: (selectedCourses: string[]) => void;
}

const CourseSelection: React.FC<CourseSelectionProps> = ({ onCoursesChange }) => {
  const { user } = useAuthenticator();
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [allCourses, setAllCourses] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Fetch courses from the Lectures database
  useEffect(() => {
    async function fetchCourses() {
      try {
        const { data: lectures, errors } = await client.models.Lectures.list();
        
        if (errors) {
          throw new Error('Failed to load lecture data');
        }
        
        // Extract unique course IDs from lectures and filter out any null values
        const uniqueCourseIds = Array.from(
          new Set(
            lectures
              .map(lecture => lecture.courseId)
              .filter((courseId): courseId is string => courseId !== null && courseId !== undefined)
          )
        );
        
        setAllCourses(uniqueCourseIds);
      } catch (error) {
        console.error("Error fetching courses:", error);
        setMessage({ type: 'error', text: 'Failed to fetch available courses' });
      } finally {
        setLoading(false);
      }
    }
    
    fetchCourses();
  }, []);

  useEffect(() => {
    async function loadUserSelectedCourses() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data: preferences, errors } = await client.models.StudyPreference.list({
          filter: { owner: { eq: user.username } }
        });

        if (errors) {
          throw new Error('Failed to load courses');
        }

        if (preferences.length > 0 && preferences[0].courses) {
          const validCourses = preferences[0].courses.filter((course): course is string => course !== null);
          setSelectedCourses(validCourses);
          onCoursesChange?.(validCourses);
        }
      } catch (error) {
        console.error("Error loading courses:", error);
        setMessage({ type: 'error', text: 'Failed to load courses' });
      } finally {
        setLoading(false);
      }
    }

    loadUserSelectedCourses();
  }, [user, onCoursesChange]);

  const handleCourseToggle = (courseId: string) => {
    setSelectedCourses(prev => {
      const newSelection = prev.includes(courseId)
        ? prev.filter(c => c !== courseId)
        : [...prev, courseId];
      
      onCoursesChange?.(newSelection);
      return newSelection;
    });
  };

  const handleSave = async () => {
    if (!user) {
      setMessage({ type: 'error', text: 'Please log in to save courses' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const { data: preferences, errors: listErrors } = await client.models.StudyPreference.list({
        filter: { owner: { eq: user.username } }
      });

      if (listErrors) {
        throw new Error('Failed to check existing preferences');
      }

      if (preferences.length > 0) {
        const { errors: updateErrors } = await client.models.StudyPreference.update({
          id: preferences[0].id,
          courses: selectedCourses,
          owner: user.username
        });

        if (updateErrors) {
          throw new Error('Failed to update courses');
        }
      } else {
        const { errors: createErrors } = await client.models.StudyPreference.create({
          courses: selectedCourses,
          owner: user.username
        });

        if (createErrors) {
          throw new Error('Failed to save courses');
        }
      }

      setMessage({ type: 'success', text: 'Courses saved successfully!' });
    } catch (error) {
      console.error("Error saving courses:", error);
      setMessage({ type: 'error', text: 'Failed to save courses' });
    } finally {
      setSaving(false);
    }
  };

  if (loading && allCourses.length === 0) {
    return (
      <div className="course-selection">
        <div className="courses-header">
          <h2>Course Selection</h2>
          <p className="page-description">
            Select the courses you're currently taking to customize your study schedule.
          </p>
        </div>
        <div className="loading-indicator">
          <span className="loading-spinner"></span>
          <span className="loading-text">Loading available courses...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="course-selection">
      <div className="courses-header">
        <h2>Course Selection</h2>
        <p className="page-description">
          Select the courses you're currently taking to customize your study schedule.
        </p>
      </div>
      
      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}
      
      <div className="courses-container">
        <div className="group-header">
          <h3>Available Courses</h3>
          <p className="group-description">
            Select the courses you are currently enrolled in to generate personalized study schedules.
          </p>
        </div>
        
        {allCourses.length === 0 ? (
          <div className="no-courses">No courses found. Please check the database.</div>
        ) : (
          <div className="courses-grid">
            {allCourses.map(courseId => (
              <div key={courseId} className="course-item">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedCourses.includes(courseId)}
                    onChange={() => handleCourseToggle(courseId)}
                  />
                  {courseId}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="selection-container">
        <div className="group-header">
          <h3>Your Selection</h3>
          <p className="group-description">
            Review and confirm your selected courses below.
          </p>
        </div>
        
        <div className="selected-courses">
          <h3>Selected Courses: {selectedCourses.length}</h3>
          {selectedCourses.length > 0 ? (
            <ul>
              {selectedCourses.map(courseId => (
                <li key={courseId}>{courseId}</li>
              ))}
            </ul>
          ) : (
            <p className="no-selection">You haven't selected any courses yet.</p>
          )}
        </div>
        
        <button 
          className="save-button"
          onClick={handleSave}
          disabled={saving || !user}
        >
          {saving ? 'Saving...' : 'Save Courses'}
        </button>
      </div>
    </div>
  );
};

export default CourseSelection; 