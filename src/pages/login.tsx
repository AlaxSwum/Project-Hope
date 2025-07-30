    import { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { authService, userService } from '../lib/supabase-secure';

    const Login: NextPage = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { data, error } = await authService.signIn(formData.email, formData.password);

      if (error) {
        setError(error.message);
      } else if (data.user) {
        // Update last login time
        await userService.updateLastLogin(data.user.id);
        
        // Check user role and redirect accordingly
        const isAdmin = await authService.isAdmin();
        if (isAdmin) {
          router.push('/admin/dashboard');
        } else {
          router.push('/dashboard');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
        ...formData,
        [e.target.name]: e.target.value,
        });
    };

    return (
        <div>


        <main className="min-h-screen bg-gradient-to-br from-blue-50 to-primary-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
            {/* Logo and Header */}
            <div className="text-center mb-8">
            </div>

            {/* Login Form */}
            <div className="bg-white rounded-2xl shadow-medium p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <h1 className="text-primary-600 text-[28px] font-bold text-center mb-6">Hope Pharmacy IMS</h1>
                    <p className="text-gray-600 text-center mb-6">Internal Management System</p>
                    
                    {/* Error Message */}
                    {error && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm mb-6">
                        {error}
                      </div>
                    )}
                    <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-primary-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="Enter your email"
                    />
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-primary-700 mb-2">
                    Password
                    </label>
                    <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-primary-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="Enter your password"
                    />
                </div>

                <div className="flex items-center justify-between">
                    <label className="flex items-center">
                    <input
                        type="checkbox"
                        className="w-4 h-4 text-primary-600 border-primary-300 rounded focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-primary-600">Remember me</span>
                    </label>
                    <Link href="/forgot-password" className="text-sm text-primary-600 hover:text-primary-800">
                    Forgot password?
                    </Link>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full py-3 px-4 rounded-xl font-semibold focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors ${
                      isLoading 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-primary-600 hover:bg-primary-700'
                    } text-white`}
                >
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Signing In...
                      </span>
                    ) : (
                      'Sign In'
                    )}
                </button>
                </form>

                {/* Internal System Notice */}
                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-500">
                    Internal use only. Contact your administrator for account access.
                  </p>
                </div>
            </div>

            {/* Security Notice */}
            <div className="mt-6 text-center">

            </div>
            </div>
        </main>
        </div>
    );
    };

    export default Login; 