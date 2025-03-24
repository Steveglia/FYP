import { useState, useEffect } from 'react';
import { Component, ReactNode, ErrorInfo } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import './FocusCoefficient.css';

const client = generateClient<Schema>();

// Days and hours for display
const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const hours = Array.from({ length: 15 }, (_, i) => i + 8); // 8 AM to 22 PM

// Error boundary component to handle rendering errors
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

class FocusCoefficientErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Error in FocusCoefficient component:", error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong.</h2>
          <p>There was an error loading the Focus Coefficient page.</p>
          <button onClick={() => window.location.reload()}>Reload Page</button>
          <details>
            <summary>Error details</summary>
            <pre>{this.state.error?.toString()}</pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

// Interface for the coefficient data
interface CoefficientData {
  id?: string;
  userId?: string;
  focusVector?: string;
  lastUpdated?: string | null;
  useFocusCoefficient?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: any; // Allow for additional properties
}

const FocusCoefficient = () => {
  const { user } = useAuthenticator();
  const [focusVector, setFocusVector] = useState<number[]>(Array(105).fill(1.0));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [useFocusCoefficient, setUseFocusCoefficient] = useState<boolean>(true);
  const [vectorHeatmap, setVectorHeatmap] = useState<string[]>(Array(105).fill(''));
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedMessage, setSavedMessage] = useState<string>('');
  const [recordId, setRecordId] = useState<string | null>(null);

  // Fetch focus coefficient when component mounts
  useEffect(() => {
    const fetchFocusCoefficient = async () => {
      if (!user) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        console.log('Fetching focus coefficient for user ID:', user.username);
        
        const focusCoefficients = await client.models.FocusCoefficient.list({
          filter: { userId: { eq: user.username } }
        });
        
        console.log('Focus coefficient query response:', JSON.stringify(focusCoefficients));
        
        // Check if we have valid data or errors
        if (focusCoefficients.errors && focusCoefficients.errors.length > 0) {
          console.log('Found GraphQL errors in response, trying to extract data anyway');
          
          // Even with GraphQL errors, we might have usable data
          if (focusCoefficients.data && 
              focusCoefficients.data.length > 0 && 
              focusCoefficients.data[0] !== null) {
            // Process data even if there were errors
            processCoefficientsData(focusCoefficients.data[0]);
          } else if (focusCoefficients.data && 
                     focusCoefficients.data.length > 0 && 
                     focusCoefficients.data[0] === null) {
            // Data is null but might exist in the database with missing required fields
            console.log('Record exists but contains null values, trying fallback approach');
            await fetchFocusCoefficientFallback(user.username);
          } else {
            console.log('No usable data in response with errors, creating default values');
            // Use default values (all 1.0)
            setFocusVector(Array(105).fill(1.0));
            setUseFocusCoefficient(true);
          }
        } else if (focusCoefficients.data && 
                  focusCoefficients.data.length > 0 && 
                  focusCoefficients.data[0]) {
          // Normal case - we have good data with no errors
          processCoefficientsData(focusCoefficients.data[0]);
        } else {
          console.log('No focus coefficient found for user ID:', user.username);
          // Use default values (all 1.0)
          setFocusVector(Array(105).fill(1.0));
          setUseFocusCoefficient(true);
        }
      } catch (fetchError) {
        console.error('Error fetching focus coefficients:', fetchError);
        setError('Could not load focus coefficient data');
        
        // Initialize with default values on error
        setFocusVector(Array(105).fill(1.0));
        setUseFocusCoefficient(true);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Function to process coefficients data
    const processCoefficientsData = (coefficientData: CoefficientData) => {
      try {
        console.log('Processing coefficient data:', coefficientData);
        
        // Store the record ID for later updates if available
        if (coefficientData.id) {
          setRecordId(coefficientData.id);
          console.log('Using record ID:', coefficientData.id);
        }
        
        // Set the useFocusCoefficient value from the database
        // If it's undefined or null, default to true
        const useFocusValue = coefficientData.useFocusCoefficient !== undefined && 
                              coefficientData.useFocusCoefficient !== null ? 
                              coefficientData.useFocusCoefficient : true;
        
        setUseFocusCoefficient(useFocusValue);
        console.log('Set useFocusCoefficient to:', useFocusValue);
        
        // Parse the focus vector from the string if available
        if (coefficientData.focusVector) {
          try {
            let parsedVector: number[];
            
            // Try parsing as JSON first
            try {
              parsedVector = JSON.parse(coefficientData.focusVector);
            } catch (jsonError) {
              // If JSON parsing fails, try alternate parsing
              console.log('JSON parsing failed, trying alternate parsing');
              
              // Remove brackets and split by commas
              const cleanedStr = coefficientData.focusVector
                .replace('[', '')
                .replace(']', '')
                .split(',')
                .map((s: string) => parseFloat(s.trim()));
                
              if (cleanedStr.some(isNaN)) {
                throw new Error('Failed to parse vector using alternate method');
              }
              
              parsedVector = cleanedStr;
            }
            
            // Ensure vector has the right length
            if (parsedVector.length !== 105) {
              console.log(`Vector length mismatch: ${parsedVector.length}, adjusting...`);
              if (parsedVector.length < 105) {
                // Extend with 1.0 values
                parsedVector = [
                  ...parsedVector, 
                  ...Array(105 - parsedVector.length).fill(1.0)
                ];
              } else {
                // Truncate
                parsedVector = parsedVector.slice(0, 105);
              }
            }
            
            setFocusVector(parsedVector);
            console.log('Successfully parsed and set focus vector with length:', parsedVector.length);
          } catch (parseError) {
            console.error('Error parsing focus vector:', parseError);
            console.error('Raw focus vector string:', coefficientData.focusVector);
            setError('Could not parse focus coefficient data');
            setFocusVector(Array(105).fill(1.0)); // Use default on error
          }
        } else {
          console.log('No focus vector found in the record, using default values');
          setFocusVector(Array(105).fill(1.0));
        }
      } catch (processingError) {
        console.error('Error processing coefficient data:', processingError);
        setError('Error processing focus coefficient data');
        setFocusVector(Array(105).fill(1.0)); // Use default on error
        setUseFocusCoefficient(true);
      }
    };
    
    // Fallback method to get focus coefficient when GraphQL errors occur
    const fetchFocusCoefficientFallback = async (userId: string) => {
      try {
        console.log('Attempting direct query for userId:', userId);
        
        // Instead of using list with filter, try a direct query
        // This might bypass some GraphQL validation errors
        const directQuery = await client.models.FocusCoefficient.list({
          filter: { userId: { eq: userId } },
          selectionSet: ['id', 'userId', 'focusVector', 'useFocusCoefficient']
        });
        
        console.log('Direct query response:', JSON.stringify(directQuery));
        
        if (directQuery.data && directQuery.data.length > 0 && directQuery.data[0]) {
          processCoefficientsData(directQuery.data[0]);
        } else {
          // Still no data, use default
          console.log('No data found with direct query, using default values');
          setFocusVector(Array(105).fill(1.0));
          setUseFocusCoefficient(true);
        }
      } catch (fallbackError) {
        console.error('Error in fallback query:', fallbackError);
        // Use default values
        setFocusVector(Array(105).fill(1.0));
        setUseFocusCoefficient(true);
      }
    };
    
    fetchFocusCoefficient();
  }, [user]);
  
  // Update the heatmap colors whenever the focus vector changes
  useEffect(() => {
    try {
      updateHeatmap();
    } catch (e) {
      console.error('Error updating heatmap:', e);
    }
  }, [focusVector]);
  
  // Function to update the heatmap based on values
  const updateHeatmap = () => {
    const newHeatmap = focusVector.map(value => {
      // More precise mapping of values to CSS classes
      if (value <= 0.7) return 'very-low-focus';
      if (value <= 0.9) return 'low-focus';
      if (value >= 1.3) return 'very-high-focus';
      if (value >= 1.1) return 'high-focus';
      return 'neutral-focus'; // For values around 1.0
    });
    
    setVectorHeatmap(newHeatmap);
  };
  
  // Save focus coefficient to the database
  const saveFocusCoefficient = async () => {
    if (!user) return;
    
    setIsSaving(true);
    setSavedMessage('');
    
    try {
      const focusVectorString = JSON.stringify(focusVector);
      const currentDate = new Date().toISOString();
      
      console.log('Saving focus coefficient with:');
      console.log('- userId:', user.username);
      console.log('- useFocusCoefficient:', useFocusCoefficient);
      console.log('- vector length:', focusVector.length);
      
      if (recordId) {
        // Update existing record
        console.log('Updating existing record with ID:', recordId);
        
        const updatedRecord = await client.models.FocusCoefficient.update({
          id: recordId,
          focusVector: focusVectorString,
          lastUpdated: currentDate,
          useFocusCoefficient: useFocusCoefficient
        });
        
        console.log('Update response:', updatedRecord);
        console.log('Updated existing focus coefficient record');
      } else {
        // Create new record
        console.log('Creating new focus coefficient record');
        
        const newRecord = await client.models.FocusCoefficient.create({
          userId: user.username,
          focusVector: focusVectorString,
          lastUpdated: currentDate,
          useFocusCoefficient: useFocusCoefficient
        });
        
        console.log('Create response:', newRecord);
        
        // Store the new record ID (now correctly accessing the data property)
        if (newRecord && newRecord.data && newRecord.data.id) {
          setRecordId(newRecord.data.id);
          console.log('Created new focus coefficient record with ID:', newRecord.data.id);
        }
      }
      
      setSavedMessage('Focus settings saved successfully!');
    } catch (saveError) {
      console.error('Error saving focus coefficient:', saveError);
      setSavedMessage('Error saving focus settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Reset focus coefficient to default (all 1.0)
  const resetFocusCoefficient = () => {
    setFocusVector(Array(105).fill(1.0));
    setSavedMessage('');
  };
  
  // Helper function to get cell index
  const getCellIndex = (dayIndex: number, hourIndex: number): number => {
    return dayIndex * 15 + hourIndex;
  };
  
  // Handle cell click to edit value
  const handleCellClick = (dayIndex: number, hourIndex: number) => {
    const index = getCellIndex(dayIndex, hourIndex);
    const currentValue = focusVector[index];
    
    // Cycle through values: 0.7 -> 0.9 -> 1.0 -> 1.1 -> 1.3 -> 0.7
    let newValue = 1.0;
    
    if (currentValue === 1.0) newValue = 1.1;
    else if (currentValue === 1.1) newValue = 1.3;
    else if (currentValue === 1.3) newValue = 0.7;
    else if (currentValue === 0.7) newValue = 0.9;
    else if (currentValue === 0.9) newValue = 1.0;
    
    const newVector = [...focusVector];
    newVector[index] = newValue;
    setFocusVector(newVector);
  };
  
  // Helper function to format time
  const formatHour = (hour: number): string => {
    return `${hour}:00`;
  };
  
  return (
    <div className="focus-coefficient-page">
      <h1>Focus Coefficient Settings</h1>
      
      {isLoading ? (
        <div className="focus-loading">Loading focus coefficient data...</div>
      ) : error ? (
        <div className="focus-error">
          <p>Error: {error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      ) : (
        <>
          <div className="focus-controls">
            <div className="focus-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={useFocusCoefficient}
                  onChange={(e) => setUseFocusCoefficient(e.target.checked)}
                />
                Use focus coefficients for study scheduling
              </label>
            </div>
            
            <div className="focus-buttons">
              <button
                onClick={saveFocusCoefficient}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
              <button
                onClick={resetFocusCoefficient}
                disabled={isSaving}
              >
                Reset to Default
              </button>
            </div>
            
            {savedMessage && (
              <div className="saved-message">
                {savedMessage}
              </div>
            )}
          </div>
          
          <div className="focus-explanation">
            <h3>How to Use Focus Coefficients</h3>
            <p>
              Adjust your focus levels for different times of the week. 
              Values higher than 1.0 indicate higher focus, while values lower than 1.0 indicate lower focus.
            </p>
            <p>
              <strong>Click on a cell</strong> to cycle through focus levels: 
              0.7 (very low) → 0.9 (low) → 1.0 (neutral) → 1.1 (high) → 1.3 (very high)
            </p>
            
            <div className="focus-legend">
              <div className="legend-item">
                <div className="legend-color very-low-focus"></div>
                <span>Very Low (0.7)</span>
              </div>
              <div className="legend-item">
                <div className="legend-color low-focus"></div>
                <span>Low (0.9)</span>
              </div>
              <div className="legend-item">
                <div className="legend-color neutral-focus"></div>
                <span>Neutral (1.0)</span>
              </div>
              <div className="legend-item">
                <div className="legend-color high-focus"></div>
                <span>High (1.1)</span>
              </div>
              <div className="legend-item">
                <div className="legend-color very-high-focus"></div>
                <span>Very High (1.3)</span>
              </div>
            </div>
            
            <p className="instructions">
              Click on cells to adjust your focus level for each hour of the day.
            </p>
          </div>
          
          <div className="focus-grid-container">
            <div className="focus-grid-title">Weekly Focus Schedule</div>
            <div className="focus-grid-wrapper">
              <div className="focus-grid">
                <div className="focus-grid-header">
                  <div className="focus-grid-time-header"></div>
                  {hours.map((hour) => (
                    <div key={`hour-${hour}`} className="focus-grid-time">
                      {formatHour(hour)}
                    </div>
                  ))}
                </div>
                
                {weekDays.map((day, dayIndex) => (
                  <div key={`day-${day}`} className="focus-grid-row">
                    <div className="focus-grid-day">{day}</div>
                    {hours.map((_, hourIndex) => {
                      const cellIndex = getCellIndex(dayIndex, hourIndex);
                      const cellValue = focusVector[cellIndex] || 1.0; // Fallback if undefined
                      return (
                        <div
                          key={`cell-${dayIndex}-${hourIndex}`}
                          className={`focus-grid-cell ${vectorHeatmap[cellIndex] || 'neutral-focus'}`}
                          onClick={() => handleCellClick(dayIndex, hourIndex)}
                        >
                          {typeof cellValue === 'number' ? cellValue.toFixed(1) : '1.0'}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const FocusCoefficientWithErrorBoundary = () => (
  <FocusCoefficientErrorBoundary>
    <FocusCoefficient />
  </FocusCoefficientErrorBoundary>
);

export default FocusCoefficientWithErrorBoundary; 