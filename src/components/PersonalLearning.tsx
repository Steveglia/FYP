import React, { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/api';
import { useAuthenticator } from '@aws-amplify/ui-react';
import type { Schema } from '../../amplify/data/resource';
import './PersonalLearning.css';

const client = generateClient<Schema>();

interface PersonalLearningItem {
  id?: string;
  userId: string;
  subject: string;
  totalRequiredHours: number;
  weeklyDedicationHours: number;
  isActive?: boolean;
}

const PersonalLearning: React.FC = () => {
  const { user } = useAuthenticator();
  const [learningItems, setLearningItems] = useState<PersonalLearningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    loadPersonalLearningItems();
  }, [user]);

  const loadPersonalLearningItems = async () => {
    if (!user?.username) return;
    
    setLoading(true);
    setMessage(null);
    
    try {
      // Load personal learning items
      const result = await client.models.PersonalLearning.list({
        filter: { userId: { eq: user.username } }
      });
      
      if (result.errors) {
        throw new Error(`Failed to load items: ${JSON.stringify(result.errors)}`);
      }
      
      // If no items found and it's the current user, create a sample item
      if (result.data.length === 0) {
        await createSampleItem();
        return;
      }
      
      // Transform API response to match our expected types
      const transformedItems = result.data.map((item: any) => ({
        id: item.id,
        userId: item.userId,
        subject: item.subject,
        totalRequiredHours: item.totalRequiredHours,
        weeklyDedicationHours: item.weeklyDedicationHours,
        isActive: true // Default to active
      }));

      setLearningItems(transformedItems);
    } catch (error) {
      console.error("Error loading personal learning items:", error);
      setMessage({ 
        type: 'error', 
        text: `Error loading items: ${(error as Error).message}`
      });
    } finally {
      setLoading(false);
    }
  };
  
  const createSampleItem = async () => {
    try {
      const { errors } = await client.models.PersonalLearning.create({
        userId: user!.username,
        subject: "Learn Python",
        totalRequiredHours: 30,
        weeklyDedicationHours: 2
      });
      
      if (errors) {
        throw new Error(`Failed to create sample item: ${JSON.stringify(errors)}`);
      }
      
      // Reload items to show the newly created one
      await loadPersonalLearningItems();
    } catch (error) {
      console.error("Error creating sample item:", error);
      setMessage({
        type: 'error',
        text: `Error creating sample item: ${(error as Error).message}`
      });
      setLoading(false);
    }
  };

  const handleToggleActive = (id: string) => {
    setLearningItems(prevItems => 
      prevItems.map(item => 
        item.id === id ? { ...item, isActive: !item.isActive } : item
      )
    );
  };

  const handleWeeklyHoursChange = async (id: string, newHours: number) => {
    // Update locally first
    setLearningItems(prevItems => 
      prevItems.map(item => 
        item.id === id ? { ...item, weeklyDedicationHours: newHours } : item
      )
    );
    
    // Then update in database
    try {
      const item = learningItems.find(item => item.id === id);
      if (!item?.id) return;
      
      const result = await client.models.PersonalLearning.update({
        id: item.id,
        weeklyDedicationHours: newHours
      });

      if (result.errors) {
        throw new Error(`Failed to update: ${JSON.stringify(result.errors)}`);
      }
      
      setMessage({ type: 'success', text: 'Weekly hours updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Error updating weekly hours:", error);
      setMessage({ 
        type: 'error', 
        text: `Update failed: ${(error as Error).message}`
      });
    }
  };

  // Calculate estimated completion time based on weekly dedication
  const calculateEstimatedWeeks = (total: number, weekly: number): number => {
    if (weekly <= 0) return 0;
    return Math.ceil(total / weekly);
  };

  // Calculate total active hours per week
  const totalActiveHoursPerWeek = learningItems
    .filter(item => item.isActive)
    .reduce((total, item) => total + item.weeklyDedicationHours, 0);

  if (loading) {
    return <div className="personal-learning">Loading personal learning items...</div>;
  }

  return (
    <div className="personal-learning">
      <h2>Personal Learning</h2>
      
      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}
      
      <div className="learning-summary">
        <div className="total-weekly-hours">
          <h3>Total Weekly Hours: <span>{totalActiveHoursPerWeek}</span></h3>
          <p>Hours dedicated to learning across all active subjects this week</p>
        </div>
      </div>

      <div className="learning-items">
        <h3>Your Learning Items</h3>
        
        {learningItems.length === 0 ? (
          <div className="no-items">
            <p>No learning items found in the database.</p>
            <button 
              className="refresh-button"
              onClick={loadPersonalLearningItems}
            >
              Refresh Data
            </button>
          </div>
        ) : (
          <div className="items-list">
            {learningItems.map(item => (
              <div key={item.id} className={`learning-item ${item.isActive ? 'active' : 'inactive'}`}>
                <div className="item-header">
                  <div className="item-title">
                    <h4>{item.subject}</h4>
                  </div>
                  <div className="item-toggle">
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={item.isActive} 
                        onChange={() => handleToggleActive(item.id || '')}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <span className="toggle-label">{item.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
                
                <div className="item-details">
                  <div className="hours-info">
                    <div className="total-hours">
                      <span className="label">Total Required Hours:</span> 
                      <span className="value">{item.totalRequiredHours}</span>
                    </div>
                    <div className="weekly-hours-control">
                      <span className="label">Weekly Hours:</span>
                      <div className="hours-adjuster">
                        <button 
                          onClick={() => item.weeklyDedicationHours > 1 && 
                            handleWeeklyHoursChange(item.id || '', item.weeklyDedicationHours - 1)}
                          disabled={!item.isActive || item.weeklyDedicationHours <= 1}
                          className="adjuster-btn"
                        >
                          -
                        </button>
                        <span className="hours-value">{item.weeklyDedicationHours}</span>
                        <button 
                          onClick={() => item.weeklyDedicationHours < item.totalRequiredHours && 
                            handleWeeklyHoursChange(item.id || '', item.weeklyDedicationHours + 1)}
                          disabled={!item.isActive || item.weeklyDedicationHours >= item.totalRequiredHours}
                          className="adjuster-btn"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {item.isActive && (
                    <div className="estimated-completion">
                      <span className="label">Estimated Completion:</span> 
                      <span className="value">
                        {calculateEstimatedWeeks(item.totalRequiredHours, item.weeklyDedicationHours)} weeks
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalLearning; 