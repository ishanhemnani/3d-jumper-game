import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gajefcrasblgadhiriae.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamVmY3Jhc2JsZ2FkaGlyaWFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMyNzgzNDAsImV4cCI6MjA1ODg1NDM0MH0.XT-bVE_nr6BssChQ14izWwiz8XzZNOE8QTHgHB8Qg2o'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Initialize Supabase functions globally
window.supabaseClient = supabase;
window.dbRef = () => supabase.from('leaderboard');
window.dbPush = async (ref, data) => {
    try {
        const { data: result, error } = await supabase
            .from('leaderboard')
            .insert([{
                player_name: data.playerName,
                score: data.score,
                coins: data.coins,
                difficulty: data.difficulty,
                created_at: new Date().toISOString()
            }]);
            
        if (error) throw error;
        return result;
    } catch (error) {
        console.error('Error submitting score:', error);
        throw error;
    }
}

window.dbOnValue = async (ref, callback) => {
    try {
        const { data, error } = await supabase
            .from('leaderboard')
            .select('*')
            .eq('difficulty', ref.difficulty)
            .order('score', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        callback({
            forEach: (fn) => data.forEach(item => {
                fn({
                    key: item.id,
                    val: () => ({
                        playerName: item.player_name,
                        score: item.score,
                        coins: item.coins,
                        timestamp: new Date(item.created_at).getTime()
                    })
                })
            })
        });
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        throw error;
    }
}
