// Test Supabase Connection Script
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tvfgnkrugsvititxqayk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2Zmdua3J1Z3N2aXRpdHhxYXlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDU0MTEsImV4cCI6MjA2ODA4MTQxMX0.7Yb8uJDFHxETL9vLuG5WCsjAR5-bQNVAZASUM0AayGE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('🔍 Testing Supabase connection...');
  
  try {
    // Test basic connection
    const { data, error } = await supabase.from('users').select('count').limit(1);
    
    if (error) {
      console.log('❌ Connection failed:', error.message);
      
      // Check if it's a CORS issue
      if (error.message.includes('CORS') || error.message.includes('fetch')) {
        console.log('🚨 CORS Issue Detected!');
        console.log('📝 To fix this, update your Supabase project settings:');
        console.log('   1. Go to: https://supabase.com/dashboard');
        console.log('   2. Select your project');
        console.log('   3. Go to Authentication > Settings');
        console.log('   4. Add "http://195.35.1.75" to Site URL and Redirect URLs');
      }
    } else {
      console.log('✅ Supabase connection successful!');
      console.log('📊 Response:', data);
    }
  } catch (err) {
    console.log('❌ Network error:', err.message);
    console.log('🔧 This might be a CORS issue. Please check Supabase settings.');
  }
}

testConnection();