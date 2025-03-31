import { createClient } from '@supabase/supabase-js'

const supabaseUrl = window.SUPABASE_URL
const supabaseKey = window.SUPABASE_KEY

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
