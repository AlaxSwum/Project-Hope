const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tvfgnkrugsvititxqayk.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2Zmdua3J1Z3N2aXRpdHhxYXlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUwNTQxMiwiZXhwIjoyMDY4MDgxNDEyfQ.lb595Er8Xa67BMy6FODr4PAU7DaRJDbXV33RxhcxEyQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function showUserData() {
  console.log('👤 Showing User Data Storage...\n');

  try {
    // 1. Show what's in the users table (profile data)
    console.log('1️⃣ Data in public.users table (profile info):');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*');

    if (usersError) {
      console.log('❌ Error accessing users:', usersError.message);
      return;
    }

    if (users.length > 0) {
      users.forEach((user, index) => {
        console.log(`\n   📊 User ${index + 1} Profile Data:`);
        console.log(`     🆔 ID: ${user.id}`);
        console.log(`     📧 Email: ${user.email}`);
        console.log(`     👤 Name: ${user.first_name} ${user.last_name}`);
        console.log(`     🔤 Username: ${user.username}`);
        console.log(`     📱 Phone: ${user.phone}`);
        console.log(`     👑 Role: ${user.role}`);
        console.log(`     💼 Position: ${user.position}`);
        console.log(`     ✅ Active: ${user.is_active}`);
        console.log(`     📅 Created: ${new Date(user.created_at).toLocaleDateString()}`);
        console.log(`     🔄 Updated: ${new Date(user.updated_at).toLocaleDateString()}`);
        console.log(`     🔐 Password: ❌ NOT STORED HERE (security feature)`);
      });
    }

    // 2. Show what's in auth.users (authentication data)
    console.log('\n2️⃣ Data in auth.users table (authentication info):');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.log('❌ Error accessing auth users:', authError.message);
      return;
    }

    if (authUsers.users.length > 0) {
      authUsers.users.forEach((user, index) => {
        console.log(`\n   🔐 Auth User ${index + 1} Data:`);
        console.log(`     🆔 ID: ${user.id}`);
        console.log(`     📧 Email: ${user.email}`);
        console.log(`     ✅ Email Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
        console.log(`     📅 Created: ${new Date(user.created_at).toLocaleDateString()}`);
        console.log(`     🔐 Password: 🔒 ENCRYPTED/HASHED (not visible)`);
        console.log(`     📝 Metadata:`, JSON.stringify(user.user_metadata || {}, null, 6));
      });
    }

    console.log('\n📋 EXPLANATION:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔒 Password Security:');
    console.log('   ✅ Passwords are NEVER stored in your users table');
    console.log('   ✅ Passwords are encrypted/hashed in auth.users table');
    console.log('   ✅ Only Supabase can access the actual password data');
    console.log('   ✅ This is a security best practice');
    
    console.log('\n📊 Data Split:');
    console.log('   📁 public.users = Profile data (name, role, phone, etc.)');
    console.log('   🔐 auth.users = Authentication data (email, password hash)');
    
    console.log('\n🔑 Your Login Works Because:');
    console.log('   1. You enter: soneswumpyae@gmail.com + Rother123');
    console.log('   2. Supabase checks auth.users table (encrypted password)');
    console.log('   3. If match, you get logged in');
    console.log('   4. App can then access your profile from users table');

    console.log('\n💡 This is the CORRECT and SECURE way to handle passwords!');

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

showUserData(); 