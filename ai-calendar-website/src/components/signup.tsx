/* 
 Creating a Signup component:
*/
import { useState } from "react";
import { db } from '../database/db'


interface SignupProps {
    onToggle: () => void;
    onSuccess: () => void;
}

function Signup({ onToggle, onSuccess }: SignupProps) {
    
    const [firstName, setFirstName] = useState("");
    const [username, setUsername] = useState("");
    const [lastName, setLastName] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setIsLoading] = useState(false);

    async function signUpWithUsername(e: React.FormEvent) {
        
        //halts the page refresh and loads the page
        e.preventDefault(); // prevents the page refresh
        setIsLoading(true);
        setError("");

        const trimmedUsername = username.trim().toLowerCase();
        const trimmedFirstName = firstName.trim();
        const trimmedLastName = lastName.trim();

        if (!trimmedUsername || !password || !trimmedFirstName) {
            setError("Please fill out all required fields.");
            setIsLoading(false);
            return;
        }

        // check the length of the password
        if (password.length < 8) {
            // future work -> make it a the error message red and under the password box
            setError("Password must be at least 8 characters.")
            setIsLoading(false);
            return;
        }
        
        const generatedEmail = `${trimmedUsername}@cal.local`;
        const { data: authData, error: authError } = await db.auth.signUp({
            email: generatedEmail,
            password,
            options : {
                data: {
                    username: trimmedUsername,
                    first_name: trimmedFirstName,
                    last_name: trimmedLastName,
                },
            },
        });
        // if there's an error, add the message to setError
        if (authError) {
            setError(authError.message);
            return;
        }

        if (authData.user) {
            const { error: dbError } = await db
                .from('users')
                .insert([
                    {
                        id: authData.user.id,
                        email: generatedEmail,
                        first_name: trimmedFirstName,
                        last_name: trimmedLastName,
                        username: trimmedUsername,
                    },
                ]);

                if (dbError) {
                    console.error('Error adding user info to database', dbError)
                    setError('There is an issue saving a profile to the database')
                }

                onSuccess();
        } 
        setIsLoading(false);
    };
    return (
        <div>

            <h1>Create Account</h1>
            <p>Sign up to get started with AI Calendar</p>
            {error && <div>{error}</div>}
            <form onSubmit={signUpWithUsername}>
                <div>
                    <label>First Name</label>
                    <input 
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required 
                    />
                </div>
                
                <div>
                    <label>Last Name</label>
                    <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    />
                </div>

                <div>
                    <label>Username</label>
                    <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    />
                </div>

                <div>
                    <label>Password</label>
                    <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Must be 8 characters long"
                    />
                </div>

                <button type="submit" disabled={loading}>
                    {loading ? "Creating account..." : "Sign up"}
                </button>
            </form>
            <div>
                Already have an account?{' '}
                <button onClick={onToggle}>
                    Log In
                </button>
            </div>
        </div>
    );
}

export default Signup;