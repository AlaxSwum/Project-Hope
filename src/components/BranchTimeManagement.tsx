import { useState, useEffect } from 'react';
import { timeTrackingService } from '../lib/supabase';

interface TimeEntry {
  id: string;
  user_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  break_entries: BreakEntry[];
  notes: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    role: string;
  };
}

interface BreakEntry {
  id: string;
  time_entry_id: string;
  start_time: string;
  end_time: string | null;
  break_type: string;
  notes: string;
}

interface BranchTimeManagementProps {
  branch: any;
  staff: any[];
  onClose: () => void;
}

const BranchTimeManagement: React.FC<BranchTimeManagementProps> = ({ branch, staff, onClose }) => {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [activeStaff, setActiveStaff] = useState<any[]>([]);
  const [staffOnBreak, setStaffOnBreak] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [selectedTimeEntry, setSelectedTimeEntry] = useState<TimeEntry | null>(null);
  const [breakNote, setBreakNote] = useState('');

  useEffect(() => {
    loadTimeEntries();
  }, [branch.id, selectedDate]);

  const loadTimeEntries = async () => {
    setLoading(true);
    try {
      console.log('Loading time entries for branch:', branch.id, 'date:', selectedDate);
      let { data: entries, error } = await timeTrackingService.getBranchTimeEntries(branch.id, selectedDate);
      
      // If no entries found for specific date, try loading all entries for the branch
      if (!entries || entries.length === 0) {
        console.log('No entries found for date, trying all entries for branch...');
        const allEntriesResult = await timeTrackingService.getBranchTimeEntries(branch.id, '');
        entries = allEntriesResult.data;
        error = allEntriesResult.error;
        console.log('All entries for branch:', entries?.length || 0);
      }
      
      if (error) {
        console.error('Error from getBranchTimeEntries:', error);
        throw error;
      }
      
      console.log('Time entries loaded:', entries?.length || 0, 'entries');
      setTimeEntries(entries || []);
      
      // Calculate active staff and staff on break
      const active = (entries || []).filter(entry => 
        entry.clock_in_time && !entry.clock_out_time && 
        !entry.break_entries?.some(b => b.clock_in_time && !b.clock_out_time)
      );
      
      const onBreak = (entries || []).filter(entry =>
        entry.clock_in_time && !entry.clock_out_time &&
        entry.break_entries?.some(b => b.clock_in_time && !b.clock_out_time)
      );
      
      console.log('Active staff:', active.length, 'On break:', onBreak.length);
      setActiveStaff(active);
      setStaffOnBreak(onBreak);
    } catch (error) {
      console.error('Error loading time entries:', error);
      // Show error to user
      setTimeEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStartBreak = async (timeEntry: TimeEntry) => {
    setSelectedTimeEntry(timeEntry);
    setShowBreakModal(true);
  };

  const handleEndBreak = async (timeEntry: TimeEntry, breakEntry: BreakEntry) => {
    try {
      const { error } = await timeTrackingService.endBreak(breakEntry.id);
      if (error) throw error;
      loadTimeEntries();
    } catch (error) {
      console.error('Error ending break:', error);
    }
  };

  const handleSubmitBreak = async () => {
    if (!selectedTimeEntry) return;
    
    try {
      const { error } = await timeTrackingService.startBreak({
        time_entry_id: selectedTimeEntry.id,
        break_type: 'regular',
        notes: breakNote
      });
      
      if (error) throw error;
      
      setShowBreakModal(false);
      setBreakNote('');
      loadTimeEntries();
    } catch (error) {
      console.error('Error starting break:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-6 border w-full max-w-6xl shadow-lg rounded-lg bg-white">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Time Management</h2>
            <p className="text-gray-500">{branch.branch_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Date Selection and Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="col-span-1">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="col-span-3 grid grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-600 font-medium">Currently Working</div>
              <div className="text-2xl font-bold text-green-700">{activeStaff.length}</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-sm text-orange-600 font-medium">On Break</div>
              <div className="text-2xl font-bold text-orange-700">{staffOnBreak.length}</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-blue-600 font-medium">Total Staff</div>
              <div className="text-2xl font-bold text-blue-700">{staff.length}</div>
            </div>
          </div>
        </div>

        {/* Time Entries Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock In</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock Out</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Break History</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Loading time entries...
                  </td>
                </tr>
              ) : timeEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    No time entries found for this date.
                  </td>
                </tr>
              ) : (
                timeEntries.map((entry) => {
                                          const isOnBreak = entry.break_entries?.some(b => b.clock_in_time && !b.clock_out_time);
                                      const currentBreak = entry.break_entries?.find(b => !b.clock_out_time);
                  
                  // Calculate duration
                  const clockIn = new Date(entry.clock_in_time);
                  const clockOut = entry.clock_out_time ? new Date(entry.clock_out_time) : new Date();
                  const totalMinutes = Math.floor((clockOut.getTime() - clockIn.getTime()) / (1000 * 60));
                  const hours = Math.floor(totalMinutes / 60);
                  const minutes = totalMinutes % 60;
                  
                  return (
                    <tr key={entry.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-blue-700 font-medium">
                                {entry.user.first_name[0]}{entry.user.last_name[0]}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {entry.user.first_name} {entry.user.last_name}
                            </div>
                            <div className="text-sm text-gray-500">{entry.user.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(entry.clock_in_time).toLocaleTimeString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(entry.clock_in_time).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {entry.clock_out_time ? (
                          <div>
                            <div className="text-sm text-gray-900">
                              {new Date(entry.clock_out_time).toLocaleTimeString()}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(entry.clock_out_time).toLocaleDateString()}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {hours}h {minutes}m
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {!entry.clock_out_time && (
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            isOnBreak 
                              ? 'bg-orange-100 text-orange-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {isOnBreak ? 'On Break' : 'Working'}
                          </span>
                        )}
                        {entry.clock_out_time && (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            Completed
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {(entry.break_entries?.length || 0) > 0 ? (
                          <div className="space-y-2">
                            {entry.break_entries?.map((breakEntry) => (
                              <div key={breakEntry.id} className="flex items-start space-x-2">
                                <span className="w-2 h-2 bg-orange-400 rounded-full mt-1.5"></span>
                                <div className="flex-1">
                                  <div className="text-sm text-gray-900">
                                    {new Date(breakEntry.clock_in_time).toLocaleTimeString()} - 
                                    {breakEntry.clock_out_time ? new Date(breakEntry.clock_out_time).toLocaleTimeString() : 'Ongoing'}
                                  </div>
                                  {breakEntry.notes && (
                                    <p className="text-xs text-gray-500 mt-0.5">{breakEntry.notes}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">No breaks</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {!entry.clock_out_time && (
                          isOnBreak ? (
                            <button
                              onClick={() => handleEndBreak(entry, currentBreak!)}
                              className="text-orange-600 hover:text-orange-900"
                            >
                              End Break
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStartBreak(entry)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Start Break
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Break Modal */}
        {showBreakModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Start Break</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Break Note (Optional)
                  </label>
                  <textarea
                    value={breakNote}
                    onChange={(e) => setBreakNote(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Add a note about this break..."
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowBreakModal(false);
                      setBreakNote('');
                    }}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitBreak}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Start Break
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BranchTimeManagement; 