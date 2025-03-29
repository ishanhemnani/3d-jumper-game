// Initialize Supabase client
const supabaseUrl = 'https://gajefcrasblgadhiriae.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamVmY3Jhc2JsZ2FkaGlyaWFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzU3NjQ0MDAsImV4cCI6MjA1ODg1NDM0MH0.XT-bVE_nr6BssChQ14izWwiz8XzZNOE8QTHgHB8Qg2o';

// Create a real Supabase client
const supabase = supabase.createClient(supabaseUrl, supabaseKey);
console.log('Supabase client created:', supabase);

// Make Supabase client available globally
window.supabaseClient = supabase;

// Define database reference function
window.dbRef = function() {
    return { 
        table: 'leaderboard',
        difficulty: null // Property that can be set later
    };
};

// Define push function for adding scores - actually push to Supabase
window.dbPush = async function(ref, data) {
    try {
        console.log('Pushing data to leaderboard:', data);
        console.log('Reference table:', ref.table);
        console.log('Reference difficulty:', ref.difficulty);
        
        // Actually insert data into Supabase
        const { data: result, error } = await supabase
            .from('leaderboard')
            .insert([{
                player_name: data.playerName,
                score: data.score,
                coins: data.coins,
                difficulty: data.difficulty || ref.difficulty,
                created_at: new Date().toISOString()
            }]);
            
        if (error) {
            console.error('Supabase insertion error:', error);
            throw error;
        }
        
        console.log('Data successfully inserted into Supabase:', result);
        return { data: result, error: null };
    } catch (error) {
        console.error('Error in dbPush:', error);
        throw error;
    }
};

// Define onValue function for retrieving leaderboard data - actually fetch from Supabase
window.dbOnValue = async function(ref, callback) {
    try {
        console.log('Loading leaderboard for difficulty:', ref.difficulty);
        
        // Actually fetch data from Supabase
        const { data, error } = await supabase
            .from('leaderboard')
            .select('*')
            .eq('difficulty', ref.difficulty)
            .order('score', { ascending: false })
            .limit(10);
        
        if (error) {
            console.error('Supabase fetch error:', error);
            throw error;
        }
        
        console.log('Fetched leaderboard data:', data);
        
        // Transform the data to match the expected format
        callback({
            forEach: (fn) => (data || []).forEach(item => {
                fn({
                    key: item.id,
                    val: () => ({
                        playerName: item.player_name,
                        score: item.score,
                        coins: item.coins,
                        timestamp: new Date(item.created_at).getTime()
                    })
                });
            })
        });
    } catch (error) {
        console.error('Error in dbOnValue:', error);
        throw error;
    }
};

console.log('Supabase functions initialized successfully');
console.log('dbRef type:', typeof window.dbRef);
console.log('dbPush type:', typeof window.dbPush);
console.log('dbOnValue type:', typeof window.dbOnValue);
