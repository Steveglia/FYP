import React from 'react';
import { Card, CardContent, Typography, Button, Box } from '@mui/material';
import { Event } from '../types';
import { saveAcceptedStudySession } from '../scheduleService';
import { useAuthenticator } from '@aws-amplify/ui-react';

interface StudySessionCardProps {
  session: Event;
  weekStartDate: Date;
  onAccept?: () => void;
  onReject?: () => void;
}

const StudySessionCard: React.FC<StudySessionCardProps> = ({ 
  session, 
  weekStartDate,
  onAccept,
  onReject
}) => {
  const { user } = useAuthenticator();
  const [isAccepting, setIsAccepting] = React.useState(false);
  const [isAccepted, setIsAccepted] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSaved, setIsSaved] = React.useState(false);
  
  // Format the date and time for display
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Extract course name from title (format is "Study: Course Name")
  const getCourse = () => {
    if (!session.title) return 'Study Session';
    return session.title.startsWith('Study: ') 
      ? session.title.substring(7) 
      : session.title;
  };
  
  // Handle accepting the study session
  const handleAccept = async () => {
    if (!user) return;
    
    setIsAccepting(true);
    try {
      const success = await saveAcceptedStudySession(session, user.userId, weekStartDate);
      if (success) {
        setIsAccepted(true);
        setIsSaved(true); // Also mark as saved when accepted
        if (onAccept) onAccept();
      }
    } catch (error) {
      console.error('Error accepting study session:', error);
    } finally {
      setIsAccepting(false);
    }
  };
  
  // Handle saving the study session without accepting
  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const success = await saveAcceptedStudySession(session, user.userId, weekStartDate);
      if (success) {
        setIsSaved(true);
      }
    } catch (error) {
      console.error('Error saving study session:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle rejecting the study session
  const handleReject = () => {
    if (onReject) onReject();
  };
  
  return (
    <Card sx={{ mb: 2, border: isAccepted ? '2px solid #4caf50' : isSaved ? '2px solid #2196f3' : undefined }}>
      <CardContent>
        <Typography variant="h6" component="div">
          {getCourse()}
        </Typography>
        
        <Typography color="text.secondary">
          {session.startDate && session.endDate ? (
            `${formatDateTime(session.startDate)} - ${formatDateTime(session.endDate)}`
          ) : 'Time not specified'}
        </Typography>
        
        <Typography variant="body2" sx={{ mt: 1 }}>
          {session.description || 'No description provided'}
        </Typography>
        
        {!isAccepted && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button 
              variant="outlined" 
              color="error" 
              onClick={handleReject}
              disabled={isAccepting || isSaving}
            >
              Reject
            </Button>
            
            <Button 
              variant="outlined" 
              color="primary" 
              onClick={handleSave}
              disabled={isAccepting || isSaving || isSaved}
            >
              {isSaving ? 'Saving...' : isSaved ? 'Saved' : 'Save'}
            </Button>
            
            <Button 
              variant="contained" 
              color="primary" 
              onClick={handleAccept}
              disabled={isAccepting || isSaving}
            >
              {isAccepting ? 'Accepting...' : 'Accept'}
            </Button>
          </Box>
        )}
        
        {isAccepted && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <Typography variant="body2" color="success.main" sx={{ display: 'flex', alignItems: 'center' }}>
              ✓ Accepted <span style={{ marginLeft: '4px', fontSize: '14px' }}>&#8645; (Drag to reschedule)</span>
            </Typography>
          </Box>
        )}
        
        {!isAccepted && isSaved && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Typography variant="body2" color="primary">
              ✓ Saved
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default StudySessionCard; 