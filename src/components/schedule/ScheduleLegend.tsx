import React from 'react';
import { eventTypeColors } from './types';

const ScheduleLegend: React.FC = () => {
  return (
    <div className="legend" style={{
      display: 'flex',
      justifyContent: 'center',
      gap: '20px',
      marginTop: '20px',
      padding: '10px',
      backgroundColor: '#f5f5f5',
      borderRadius: '5px'
    }}>
      <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <div className="color-box" style={{ 
          backgroundColor: eventTypeColors.WORK,
          width: '15px',
          height: '15px',
          borderRadius: '3px'
        }}></div>
        <span>Work</span>
      </div>
      <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <div className="color-box" style={{ 
          backgroundColor: eventTypeColors.STUDY,
          width: '15px',
          height: '15px',
          borderRadius: '3px'
        }}></div>
        <span>Study</span>
      </div>
      <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <div className="color-box" style={{ 
          backgroundColor: eventTypeColors.MEETING,
          width: '15px',
          height: '15px',
          borderRadius: '3px'
        }}></div>
        <span>Meeting</span>
      </div>
      <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <div className="color-box" style={{ 
          backgroundColor: eventTypeColors.OTHER,
          width: '15px',
          height: '15px',
          borderRadius: '3px'
        }}></div>
        <span>Other</span>
      </div>
      <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <div className="color-box" style={{ 
          backgroundColor: eventTypeColors.LECTURE,
          width: '15px',
          height: '15px',
          borderRadius: '3px'
        }}></div>
        <span>Lecture</span>
      </div>
      <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <div className="color-box" style={{ 
          backgroundColor: eventTypeColors.LAB,
          width: '15px',
          height: '15px',
          borderRadius: '3px'
        }}></div>
        <span>Lab</span>
      </div>
    </div>
  );
};

export default ScheduleLegend; 