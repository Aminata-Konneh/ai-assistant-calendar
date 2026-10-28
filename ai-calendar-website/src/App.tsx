import { useState, useEffect } from 'react'
import './App.css'
import { db } from './database/db';
// import Signup from './components/signup';
import Calendar from './calendar/calendar';
import AI_assistant from './ai-modal/ai-modal';

// Modal.setAppElement('#root')

function Dashboard() {
  // will store the user profile data
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const getUser = async () => {
      // gets the currently authenticated user from Supabase Auth
      
      const { data: { user }} = await db.auth.getUser();

      if (user) { // if its already authenticated, will extract `user` from the response
        const { data } = await db
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        // extracts the profile data from the users table
        setUser(data); // will store the entire data in the user state variable
      }
    };
    getUser();
  }, []);

  const handleLogout = async () => {
    await db.auth.signOut(); // waits for the user to be signed out
    window.location.reload(); // reloads the window
  }

  return (
    <>
      <div>
        <header>
          <h1>AI Calendar Assistant</h1>
          <div>
            <span>Welcome, {user?.first_name | user?.email}</span>
            <button onClick={handleLogout}>Logout</button>
          </div>
        </header>
      </div>
      <main>
        <h2>Your Dashboard</h2>
        <p>You're logged in! Your calendar features will appear here.</p>
      </main>
      
    </> 
  )
}

function App() {
  const [session, setSession] = useState<any>(null);
  // const [showsSignup, setShowSignup] = useState(false);
  const [loading, setIsLoading] = useState(true);


  useEffect(() => {
    db.auth.getSession().then(({data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div>Loadding...</div>;
  }

  if (session) {
    return <Dashboard/>;
  }

  return (
    <div>
        <Calendar/>
        <AI_assistant/>
    </div>
  )
}

export default App;


