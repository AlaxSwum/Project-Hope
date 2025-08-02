import { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';

const Home: NextPage = () => {
  return (
    <div>
      <Head>
        <title>Hope Pharmacy Management System</title>
        <meta name="description" content="Secure pharmacy management system" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-primary-100">
        {/* Header */}
        <div className="bg-white shadow-soft">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary-600 rounded-lg"></div>
                <h1 className="text-xl font-bold text-primary-800">Hope Pharmacy</h1>
              </div>
              <div className="space-x-3">
                <Link 
                  href="/login"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Staff Login
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <div className="container mx-auto px-4 py-16">
          <div className="text-center max-w-4xl mx-auto">
            <h2 className="text-5xl font-bold text-primary-800 mb-6">
              Modern Pharmacy Management System
            </h2>
            <p className="text-xl text-primary-600 mb-8 leading-relaxed">
              Streamline your pharmacy operations with our secure, HIPAA-compliant management system. 
              Manage prescriptions, inventory, patients, and more with confidence.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link 
                href="/login"
                className="px-8 py-4 bg-primary-600 text-white text-lg font-semibold rounded-xl hover:bg-primary-700 transition-colors shadow-medium"
              >
                Get Started
              </Link>
              <Link 
                href="/login"
                className="px-8 py-4 border-2 border-primary-300 text-primary-600 text-lg font-semibold rounded-xl hover:bg-primary-50 transition-colors"
              >
                Staff Access
              </Link>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-3 gap-8 mt-16">
              <div className="bg-white p-6 rounded-2xl shadow-soft hover:shadow-medium transition-shadow">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <div className="w-6 h-6 bg-primary-600 rounded"></div>
                </div>
                <h3 className="text-xl font-semibold text-primary-800 mb-3">Prescription Management</h3>
                <p className="text-primary-600">
                  Efficiently process prescriptions with automated verification and drug interaction checking.
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-soft hover:shadow-medium transition-shadow">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <div className="w-6 h-6 bg-primary-600 rounded"></div>
                </div>
                <h3 className="text-xl font-semibold text-primary-800 mb-3">Inventory Control</h3>
                <p className="text-primary-600">
                  Real-time inventory tracking with automated reorder alerts and expiration monitoring.
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-soft hover:shadow-medium transition-shadow">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <div className="w-6 h-6 bg-primary-600 rounded"></div>
                </div>
                <h3 className="text-xl font-semibold text-primary-800 mb-3">Patient Records</h3>
                <p className="text-primary-600">
                  Secure patient data management with encrypted PHI and comprehensive audit trails.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-primary-800 text-white py-8">
          <div className="container mx-auto px-4 text-center">
            <p className="text-primary-200">
              © 2024 Hope Pharmacy Management System. All rights reserved.
            </p>
            <p className="text-primary-300 text-sm mt-2">
              HIPAA-compliant • Secure • Reliable
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Home; 