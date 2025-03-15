import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { Event } from '../types';
import StudySessionCard from '../StudySessionCard';

interface StudySessionListProps {
  sessions: Event[];
  weekStartDate: Date;
  onSessionAccepted?: (session: Event) => void;
  onSessionRejected?: (session: Event) => void;
}

const StudySessionList: React.FC<StudySessionListProps> = ({
  sessions,
  weekStartDate,
  onSessionAccepted,
  onSessionRejected
}) => {
  // Filter to only show study sessions
  const studySessions = sessions.filter(session => session.type === 'STUDY');
  
  if (studySessions.length === 0) {
    return (
      <Paper sx={{ p: 3, mt: 2 }}>
        <Typography variant="body1" align="center">
          No study sessions available for this week.
        </Typography>
      </Paper>
    );
  }
  
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Suggested Study Sessions
      </Typography>
      
      {studySessions.map(session => (
        <StudySessionCard
          key={session.id}
          session={session}
          weekStartDate={weekStartDate}
          onAccept={() => onSessionAccepted?.(session)}
          onReject={() => onSessionRejected?.(session)}
        />
      ))}
    </Box>
  );
};

export default StudySessionList; 