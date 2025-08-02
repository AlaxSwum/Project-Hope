const { createClient } = require('@supabase/supabase-js');

// Correct project with real API keys
const supabaseUrl = 'https://tvfgnkrugsvititxqayk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2Zmdua3J1Z3N2aXRpdHhxYXlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDU0MTEsImV4cCI6MjA2ODA4MTQxMX0.7Yb8uJDFHxETL9vLuG5WCsjAR5-bQNVAZASUM0AayGE';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2Zmdua3J1Z3N2aXRpdHhxYXlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUwNTQxMiwiZXhwIjoyMDY4MDgxNDEyfQ.lb595Er8Xa67BMy6FODr4PAU7DaRJDbXV33RxhcxEyQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function setupAdminFinal() {
  console.log('🚀 Final Admin Setup - Hope Pharmacy IMS\n');
  console.log('Project:', supabaseUrl);
  console.log('Project ID: tvfgnkrugsvititxqayk\n');

  try {
    // 1. Check users table
    console.log('1️⃣ Checking users table...');
    const { data: existingUsers, error: usersError, count } = await supabase
      .from('users')
      .select('*', { count: 'exact' });

    if (usersError) {
      console.log('❌ Error accessing users table:', usersError.message);
      return;
    }

    console.log(`📊 Found ${count} users in database`);
    
    if (count > 0) {
      console.log('\n👥 Existing users:');
      existingUsers.forEach((user, index) => {
        console.log(`\n   User ${index + 1}:`);
        console.log(`     📧 Email: ${user.email}`);
        console.log(`     👤 Name: ${user.first_name} ${user.last_name}`);
        console.log(`     👑 Role: ${user.role}`);
        console.log(`     ✅ Active: ${user.is_active}`);
      });
    }

    // 2. Check auth users
    console.log('\n2️⃣ Checking auth users...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.log('❌ Error accessing auth:', authError.message);
      return;
    }

    console.log(`🔐 Found ${authUsers.users.length} auth users`);
    
    // Check if admin exists in auth
    let adminUser = authUsers.users.find(u => u.email === 'soneswumpyae@gmail.com');
    
    if (!adminUser) {
      // 3. Create admin auth user
      console.log('\n3️⃣ Creating admin auth user...');
      
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: 'soneswumpyae@gmail.com',
        password: 'Rother123',
        email_confirm: true,
        user_metadata: {
          first_name: 'Admin',
          last_name: 'User',
          username: 'admin',
          phone: '07774413295',
          role: 'administrator',
          position: 'System Administrator',
          full_name: 'Admin User'
        }
      });

      if (createError) {
        console.log('❌ Error creating auth user:', createError.message);
        return;
      }

      adminUser = newUser.user;
      console.log('✅ Admin auth user created');
      console.log(`   🆔 ID: ${adminUser.id}`);
      console.log(`   📧 Email: ${adminUser.email}`);
    } else {
      console.log('✅ Admin auth user already exists');
      console.log(`   🆔 ID: ${adminUser.id}`);
      console.log(`   📧 Email: ${adminUser.email}`);
    }

    // 4. Add admin to users table if not exists
    const adminInDb = existingUsers.find(u => u.email === 'soneswumpyae@gmail.com');
    
    if (!adminInDb) {
      console.log('\n4️⃣ Adding admin to users table...');
      
      const { data: insertData, error: insertError } = await supabase
        .from('users')
        .insert({
          id: adminUser.id,
          email: 'soneswumpyae@gmail.com',
          first_name: 'Admin',
          last_name: 'User',
          username: 'admin',
          phone: '07774413295',
          role: 'administrator',
          position: 'System Administrator',
          is_active: true
        })
        .select();

      if (insertError) {
        console.log('❌ Error inserting admin:', insertError.message);
        return;
      }

      console.log('✅ Admin added to users table');
      console.log('   👤 Name: Admin User');
      console.log('   👑 Role: administrator');
    } else {
      console.log('✅ Admin already exists in users table');
    }

    // 5. Test complete login flow
    console.log('\n5️⃣ Testing complete login flow...');
    
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'soneswumpyae@gmail.com',
      password: 'Rother123'
    });

    if (loginError) {
      console.log('❌ Login failed:', loginError.message);
      return;
    }

    console.log('✅ Login successful!');
    console.log(`   🆔 User ID: ${loginData.user.id}`);
    console.log(`   📧 Email: ${loginData.user.email}`);

    // Test database access
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', loginData.user.id)
      .single();

    if (profileError) {
      console.log('❌ Database profile access failed:', profileError.message);
    } else {
      console.log('✅ Database profile access successful!');
      console.log(`   👤 Profile: ${profile.first_name} ${profile.last_name}`);
      console.log(`   👑 Role: ${profile.role}`);
      console.log(`   📱 Phone: ${profile.phone}`);
      console.log(`   ✅ Active: ${profile.is_active}`);
    }

    await supabase.auth.signOut();

    // 6. Final verification
    console.log('\n6️⃣ Final verification...');
    const { data: finalUsers, error: finalError, count: finalCount } = await supabase
      .from('users')
      .select('*', { count: 'exact' });

    if (finalError) {
      console.log('❌ Final verification failed:', finalError.message);
    } else {
      console.log(`✅ Final verification successful!`);
      console.log(`📊 Total users in database: ${finalCount}`);
    }

    console.log('\n🎉 SETUP COMPLETE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 Admin Login Credentials:');
    console.log('📧 Email: soneswumpyae@gmail.com');
    console.log('🔑 Password: Rother123');
    console.log('🌐 Login URL: http://localhost:3000/login');
    console.log('\n📊 Database Status:');
    console.log('✅ Users table exists and accessible');
    console.log('✅ Admin user exists in both auth and database');
    console.log('✅ Login and database access working perfectly');
    console.log('\n🚀 Ready to start your app:');
    console.log('   npm run dev');

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

setupAdminFinal(); 