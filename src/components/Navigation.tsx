import { useAuthenticator } from '@aws-amplify/ui-react';
import { Link, useLocation } from 'react-router-dom';

const Navigation = () => {
  const { user, signOut } = useAuthenticator();
  const location = useLocation();

  return (
    <nav className="navigation">
      <div className="nav-header">
        <h2>Welcome, {user?.signInDetails?.loginId}</h2>
      </div>
      <div className="nav-links">
        <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
          Home
        </Link>
        <Link to="/schedule" className={location.pathname === '/schedule' ? 'active' : ''}>
          Weekly Schedule
        </Link>
        <Link to="/preferences" className={location.pathname === '/preferences' ? 'active' : ''}>
          Preferences
        </Link>
      </div>
      <button onClick={signOut} className="sign-out-btn">Sign out</button>
    </nav>
  );
};

export default Navigation; 