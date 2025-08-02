const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncUsers() {
  try {
    console.log('Syncing users from auth.users to users table...');
    
    // Get all auth users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error fetching auth users:', authError);
      return;
    }
    
    console.log(`Found ${authUsers.users.length} auth users`);
    
    // For each auth user, insert/update in users table
    for (const authUser of authUsers.users) {
      const userData = {
        id: authUser.id,
        first_name: authUser.user_metadata?.first_name || authUser.email?.split('@')[0] || 'User',
        last_name: authUser.user_metadata?.last_name || '',
        email: authUser.email,
        role: authUser.user_metadata?.role || 'staff'
      };
      
      const { error } = await supabase
        .from('users')
        .upsert(userData, { onConflict: 'id' });
      
      if (error) {
        console.error(`Error syncing user ${authUser.email}:`, error);
      } else {
        console.log(`Synced user: ${authUser.email}`);
      }
    }
    
    console.log('User sync completed');
  } catch (error) {
    console.error('Error in syncUsers:', error);
  }
}

syncUsers(); 