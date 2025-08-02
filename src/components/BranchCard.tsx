import React from 'react';

interface BranchCardProps {
  branch: any;
  onManageStaff: () => void;
  onViewDetails: () => void;
  onTimeManagement: () => void;
  onSetLocation: () => void;
  activeStaffCount: number;
  onBreakCount: number;
  totalStaffCount: number;
}

const BranchCard: React.FC<BranchCardProps> = ({
  branch,
  onManageStaff,
  onViewDetails,
  onTimeManagement,
  onSetLocation,
  activeStaffCount,
  onBreakCount,
  totalStaffCount
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{branch.branch_name}</h3>
              <p className="text-sm text-gray-500">{branch.branch_code} • {branch.city}</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-sm text-green-600 font-medium">Active</div>
            <div className="text-xl font-bold text-green-700">{activeStaffCount}</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <div className="text-sm text-orange-600 font-medium">On Break</div>
            <div className="text-xl font-bold text-orange-700">{onBreakCount}</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-sm text-blue-600 font-medium">Total Staff</div>
            <div className="text-xl font-bold text-blue-700">{totalStaffCount}</div>
          </div>
        </div>

        {/* Action Sections */}
        <div className="space-y-4">
          {/* Staff Management */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Staff Management</h4>
            <div className="flex space-x-2">
              <button
                onClick={onManageStaff}
                className="flex-1 bg-purple-50 hover:bg-purple-100 text-purple-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Manage Staff
              </button>
              <button
                onClick={onViewDetails}
                className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                View Details
              </button>
            </div>
          </div>

          {/* Time Management */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Time Management</h4>
            <button
              onClick={onTimeManagement}
              className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>View Time Entries</span>
            </button>
          </div>

          {/* Location Settings */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Location Settings</h4>
            <button
              onClick={onSetLocation}
              className="w-full bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Set Location</span>
            </button>
          </div>
        </div>
      </div>

      {/* Branch Type Badge */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {branch.branch_type}
        </span>
      </div>
    </div>
  );
};

export default BranchCard; 