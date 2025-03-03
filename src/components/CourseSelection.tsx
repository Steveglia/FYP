import React, { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import { useAuthenticator } from '@aws-amplify/ui-react';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

const courses = [
  'Compilers',
  'Maths',
  'Programming',
  'Machine Learning'
];

interface CourseSelectionProps {
  onCoursesChange?: (selectedCourses: string[]) => void;
}

const CourseSelection: React.FC<CourseSelectionProps> = ({ onCoursesChange }) => {
  const { user } = useAuthenticator();
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    async function loadCourses() {
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

    loadCourses();
  }, [user, onCoursesChange]);

  const handleCourseToggle = (course: string) => {
    setSelectedCourses(prev => {
      const newSelection = prev.includes(course)
        ? prev.filter(c => c !== course)
        : [...prev, course];
      
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

  if (loading) {
    return <div className="course-selection">Loading courses...</div>;
  }

  return (
    <div className="course-selection">
      <h2>Select Your Courses</h2>
      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}
      <div className="courses-grid">
        {courses.map(course => (
          <div key={course} className="course-item">
            <label>
              <input
                type="checkbox"
                checked={selectedCourses.includes(course)}
                onChange={() => handleCourseToggle(course)}
              />
              {course}
            </label>
          </div>
        ))}
      </div>
      
      <div className="selected-courses">
        <h3>Selected Courses: {selectedCourses.length}</h3>
        <ul>
          {selectedCourses.map(course => (
            <li key={course}>{course}</li>
          ))}
        </ul>
      </div>

      <button 
        className="save-button"
        onClick={handleSave}
        disabled={saving || !user}
      >
        {saving ? 'Saving...' : 'Save Courses'}
      </button>
    </div>
  );
};

export default CourseSelection; 