// cite: https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { google } from 'googleapis';

//configure environmental keys
//keys are loaded in as `process.env.VAR_NAME`
dotenv.config();

const app = express(); //creates backend server
app.use(cors());
app.use(express.json());


//Import Supabase
const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

const PORT = process.env.PORT || 3001;

// Import gemini api key
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = gemini.getGenerativeModel({ model: 'gemini-3.6-flash' });

let gmailTokens: any = null;

// Generate Gmail auth URL
app.get('/api/auth/gmail/url', (req, res) => {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI
    )

    const authURL = oauth2Client.generateAuthUrl({
       access_type: 'offline',
       scope: ['https://www.googleapis.com/auth/gmail.readonly'],
       prompt: 'consent'
    });

    res.json({ authURL });
});

// handle callback
app.post('/api/auth/gmail/callback', async (req, res) => {
    const { code } = req.body;

    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GMAIL_CLIENT_ID,
            process.env.GMAIL_CLIENT_SECRET,
            process.env.GMAIL_REDIRECT_URI
        );

        const { tokens } = await oauth2Client.getToken(code);
        gmailTokens = tokens;

        console.log('Gmail authenticated succssfully!');
        res.json({ success: true}); 
    } catch (error) {
        console.log('Auth Error: ', error);
        res.status(500).json({ error: 'Failed to authenticate gmail' });
    }
});
// connect the gmail
app.get('/api/auth/gmail/callback', async (req, res) => {
    const { code } = req.query; // code comes from URL query parameter
    
    if (!code) {
        return res.status(400).send('Missing authorization code');
    }

    try {
        const oauth2Client = new google.auth.OAuth2(
           process.env.GMAIL_CLIENT_ID,
            process.env.GMAIL_CLIENT_SECRET,
            process.env.GMAIL_REDIRECT_URI
        );
        const { tokens } = await oauth2Client.getToken(code as string);
        gmailTokens = tokens;

        console.log('Gmail authenticated successfully!');

        res.send(`
            <html>
                <body>
                    <h1>Gmail Connected</h1>
                    <p>Now, you can close this window and return to the original app.</p>
                    <script>
                        if (window.opener) {
                            console.log('Sending message to parent');
                            window.opener.postMessage({
                                type: 'gmail-auth-success'
                            }, '*');
                            console.log('Message is sent!');
                        }
                        else {
                            console.log('No parent window found');    
                        }

                        // close window after 5 seconds
                        setTimeout(() => {
                            window.close()
                        }, 5000);
                    </script>
                </body>
            </html>
            `);
    }
    catch (error) {
        console.error('Authentication error:', error);
        res.status(500).send(`
            <html>
                <body>
                    <h1>Gmail Authenication Failed</h1>
                    <p>Please try again!</p>

                </body>
            </html>
            `);
    }
});

app.get('/api/auth/gmail/status', (req, res) => {
    res.json({
        connected: !!gmailTokens,
        hasAccessTokens: !!gmailTokens?.acces_token,
        hasRefreshToken: !!gmailTokens?.refresh_token
    });
});

// ******************
// FETCH EMAILS
// returns res value with a list of emails or null
// ******************
app.post('/api/emails/fetch', async (req, res) => {
    // TRIAL: obtain the 5 most recent emails
    const {maxResults = 1 } = req.body;
    try {
        // check if gmail is authenticated first
        if (!gmailTokens) {
            return res.status(401).json({
                error: 'Gmail is not authenticated. Please connect your gmail first.'
            })
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GMAIL_CLIENT_ID,
            process.env.GMAIL_CLIENT_SECRET,
            process.env.GMAIL_REDIRECT_URI
        );

        oauth2Client.setCredentials(gmailTokens);

        // Initialize Gmail API
        const gmail = google.gmail({version: 'v1', auth: oauth2Client});

        // specify the query
        const query = [
            'meeting',
            'assignment',
            'call',
            '"schedule a meeting"'
        ].join(' OR ');

        console.log('Searching for emails with query');

        // obtains a lists the messages in the user's mailbox
        // request body ----> empty
        // response body ----> contains the messages
        const response = await gmail.users.messages.list({
            userId: 'me',
            maxResults,
            q: query
        });
        const messages = response.data.messages || [];

        //if no messages
        if (messages.length === 0) {
            console.log('There are no emails that fit the query');
            return res.json({ emails: [] });
        }

        console.log(`Found ${messages.length} emails that match the criteria, fetching details...`);

        const emails = await Promise.all(
            messages.slice(0, maxResults).map(async (message) => {
                try{
                    // get the specified message
                    const email = await gmail.users.messages.get({
                        userId: 'me',
                        id: message.id!,
                        format: 'full'
                    })
                    // obtain headers: a list of headers that contain "Subject", "Start Time", "End Time", etc
                    const headerList = email.data.payload?.headers;

                    const to = headerList?.find(t => t.name === "To")?.value || '';
                    const from = headerList?.find(f => f.name === "From")?. value || '';
                    const subject = headerList?.find(s => s.name === "Subject")?.value || 'No Subject';
                    const date = headerList?.find(d => d.name === 'Date')?.value || '';

                    //obtain the body
                    let body = '';
                    const payload = email.data.payload;

                    if (payload) {
                        // check if the paylaod is multi-part (payload.part is valid)
                        if (payload.parts) {
                            const textPart = payload.parts.find(t => t.mimeType === 'text/plain');
                            
                            // might be empty for non-MIME messsage parts; verfy that it exists
                            if (textPart?.body?.data) {
                                // must decode Base64url (default) string into UTF-8; using Buffer.from function
                                body = Buffer.from(textPart.body.data, 'base64url').toString('utf-8');
                            }
                        }
                        else if (payload.body?.data){
                            body = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
                        }
                    }
                    return {
                        id: message.id,
                        from,
                        to,
                        date,
                        subject,
                        body: body.substring(0, 2000), //Limit for future AI use (testing)
                        snippet: email.data.snippet || ''
                    }
                }
                catch (error) {
                    console.error('Error fetching emails: ', error);
                    return null;
                }
            }) 
        )
        // verify how many emails returned a non-null value
        const verifyEmail = emails.filter(num => num !== null);
        console.log(`There were ${verifyEmail.length} emails that were returned with a valid value`);

        // return to frontend
        res.json({ emails : verifyEmail });
    }
    catch (error) {
        console.error('Error fetching emails: ', error);
        return null;
    }

})

// *******************************
// ANALYZE EMAILS USING GEMINI API
// *******************************
app.post('/api/emails/analyze', async (req, res) => {
    const { emails } = req.body; // contains the fetched emails

    if (emails.length === 0) {
        return res.status(401).json({
            error: 'No emails to error'
        });
    }
    console.log(`Analyzing ${emails.length} emails`);
    try {
        // create a prompt
        const prompt = `
        You are a AI calendar assistant. Analyze the emails and extract any events, deadlines,
        meetings, or assignments to be added to a calendar.

        For each event that's extracted, return a JSON array with objects containing:
            - title: Clear and concise title that takes after the subject of the email (max 50 characters)
            - start_date: ISO date string (YYYY-MM-DD)
            - start_time: Time in 24-hour format (HH:MM) or null (if all day)
            - end_date: ISO date string (YYYY-MM-DD)
            - end_time: Time in 24-hour format (HH:MM) or null (if all day)
            - location: Location if mentioned in the event or null
            - description: Brief description from the email's text (max 100 characters)
            - email-id: The ID of the email
            - confidence: a 1-10 rating of how sure you are (1 = unsure, 10 = very sure)

        If no events were found, just return an empty array [].

        IMPORTANT DETAILS:
            - only include events that have a clear date/time mentioned.
            - If the email is only informational, skip it
            - for deadlines, treat the due date as the start_date with no start_time
            - For meetings, extract the specific time
        
        Emails to analyze:
        ${emails.map((e: any) => `
        ID: ${e.id}
        Subject: ${e.subject}
        From: ${e.from}
        Date: ${e.date}  
        Body: ${e.body}  
        `).join('\n')}

        Return ONLY a valid JSON array. Don't have other text, markdowns or explanations.
        `;

        // obtain the response text
        const content = await model.generateContent(prompt);
        const response = await content.response;
        const text = response.text(); // is a JSON array
        console.log(typeof text);

        // parse the text
        let events = [];
        try {
            // Extract the JSON from the response
            const extract = text.match(/\[[\s\S]*\]/);
            if (extract) {
                events = JSON.parse(extract[0]);
            } else {
                events = JSON.parse(text);
            }
        }
        catch (error){
            events = []
            console.error('Failed to parse text ', error);
        }
        
        return res.json({ events });
    }
    catch (error) {
        console.error('Gemini API error: ', error);
        res.status(500).json({
            error: 'AI analysis failed',
        })
    }
})

// add specific event to Supabase
app.post('/api/events/add', async (req, res) => {
    const { event } = req.body; //obtains the specific event (from frontend) 

    // format it in preparation to add to supabase

    // double check if event exists
    if (!event || !event.title) {
        return res.status(400).json({error: 'Invalid event'});
    }

    console.log('Adding event to Supabase');
    try {
        // define the row that will be inputted into the database
        const row = {
            title: event.title,
            start_time: event.start_time ? `${event.start_date}T${event.start_time}:00`:
                event.start_date,
            end_time: event.end_time ? `${event.end_date}T${event.end_time}:00`
                :event.end_date,
            location: event.location,
            description: event.description,
            emailID: event.emailID || null,
            source: 'ai_recommended_event',
            confidence: event.confidence ?? null
        }

        // add to supabase
        const { data, error } = await supabase
            .from('cal_events')
            .insert([row])
            .select();
        
        if (error) {
            console.error('Error in inserting event to Supabase', error)
            res.status(500).json({ error: error.message});
        }
        
        // else, there's success
        console.log('Data successfully saved to supabase: ', data);
        return res.json({ success: true })
    }
    catch(error) {
        console.error('Error in adding event', error);
        res.status(500).json({error: 'Failed to add event'});
    }
})

// Sanity check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Backend is running...',
        gmailConnected: !!gmailTokens
    });
});

// start server
app.listen(PORT, () => {
    console.log(`Backend server running on https://localhost:${PORT}`);
});

