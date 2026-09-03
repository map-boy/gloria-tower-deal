import React, { useState, useEffect } from 'react';
import { useVoltraStore, useAuthRole } from './3_frontend/hooks/useVoltraStore';
import { useDarkMode } from './3_frontend/hooks/useDarkMode';
import { Sidebar, ActiveTab } from './3_frontend/components/Sidebar';
import { TopBar } from './3_frontend/components/TopBar';
import { TrainerStyleInfoCard } from './3_frontend/components/TrainerStyleInfoCard';
import { MonthlyReadingPanel } from './3_frontend/components/MonthlyReadingPanel';
import { DayEntryModal } from './3_frontend/components/DayEntryModal';
import { AdminSummaryPanel } from './3_frontend/components/AdminSummaryPanel';
import { PaymentsLedgerPanel } from './3_frontend/components/PaymentsLedgerPanel';
import { FloorCard } from './3_frontend/components/FloorCard';
import { RoomGrid } from './3_frontend/components/RoomGrid';
import { RateConfigModal } from './3_frontend/components/RateConfigModal';
import { TenantProfileModal } from './3_frontend/components/TenantProfileModal';
import { SelectRoomModal } from './3_frontend/components/SelectRoomModal';
import { getCurrentYearMonth } from './1_core/utils/dateUtils';
import { UsageEntry } from './1_core/domain/types';
import { formatCurrency, formatKwh, getFloorLabel, getStatusBadgeStyle, getStatusLabel } from './1_core/utils/formatters';
import { registerForNotifications, listenForForegroundMessages } from './2_backend/services/notificationService';
import { signInWithGoogle, signOutUser, subscribeToAuthState } from './2_backend/services/authService';
import type { User } from 'firebase/auth';

export default function App() {
  const store = useVoltraStore();
  const auth = useAuthRole();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);
  const { isDark, toggleDarkMode } = useDarkMode();

  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [selectedFloorNumber, setSelectedFloorNumber] = useState<number | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const currentYM = getCurrentYearMonth();
  const [calYear, setCalYear] = useState<number>(currentYM.year);
  const [calMonth, setCalMonth] = useState<number>(currentYM.month);

  const [isDayEntryModalOpen, setIsDayEntryModalOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState<string>('');
  const [selectedExistingEntry, setSelectedExistingEntry] = useState<UsageEntry | undefined>();
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [isTenantProfileModalOpen, setIsTenantProfileModalOpen] = useState(false);
  const [isSelectRoomModalOpen, setIsSelectRoomModalOpen] = useState(false);
  const [isMoveTenantModalOpen, setIsMoveTenantModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  const myTenantRecord =
    auth.role === 'tenant' && currentUser?.email
      ? store.getTenants().find((t) => t.email.toLowerCase() === currentUser.email!.toLowerCase())
      : undefined;

  const effectiveRoomId =
    auth.role === 'admin'
      ? selectedRoomId || 'room-1-1'
      : myTenantRecord?.roomId || '';

  useEffect(() => {
    registerForNotifications(auth.role, auth.role === 'tenant' ? effectiveRoomId : undefined);
  }, [auth.role, effectiveRoomId]);

  useEffect(() => {
    listenForForegroundMessages((title, body) => {
      setToast({ title, body });
      setTimeout(() => setToast(null), 6000);
    });
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-200 dark:bg-neutral-950 flex items-center justify-center font-mono text-black dark:text-neutral-100">
        <div className="bg-white dark:bg-neutral-900 border-3 border-black dark:border-neutral-200 rounded-2xl p-8 text-center">
          <div className="font-bold text-lg">Checking sign-in...</div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-neutral-200 dark:bg-neutral-950 flex items-center justify-center font-mono text-black dark:text-neutral-100 p-4">
        <div className="bg-white dark:bg-neutral-900 border-3 border-black dark:border-neutral-200 rounded-2xl p-8 text-center max-w-sm w-full space-y-4">
          <div className="font-serif font-black text-2xl">Voltra Tower</div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">Sign in to continue</p>
          <button
            onClick={() => signInWithGoogle()}
            className="w-full bg-black text-white hover:bg-neutral-800 font-bold text-sm py-3 rounded-xl border-2 border-black transition-transform active:scale-95 cursor-pointer"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (auth.checkingAdmin) {
    return (
      <div className="min-h-screen bg-neutral-200 dark:bg-neutral-950 flex items-center justify-center font-mono text-black dark:text-neutral-100">
        <div className="bg-white dark:bg-neutral-900 border-3 border-black dark:border-neutral-200 rounded-2xl p-8 text-center">
          <div className="font-bold text-lg">Checking access...</div>
        </div>
      </div>
    );
  }

  if (auth.role === 'tenant' && !myTenantRecord) {
    return (
      <div className="min-h-screen bg-neutral-200 dark:bg-neutral-950 flex items-center justify-center font-mono text-black dark:text-neutral-100 p-4">
        <div className="bg-white dark:bg-neutral-900 border-3 border-black dark:border-neutral-200 rounded-2xl p-8 text-center max-w-sm w-full space-y-3">
          <div className="font-serif font-black text-xl">No Room Assigned</div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            {currentUser?.email} isn't linked to a room yet. Ask the building admin to add this email when assigning your room.
          </p>
          <button
            onClick={() => signOutUser()}
            className="w-full bg-black text-white hover:bg-neutral-800 font-bold text-sm py-3 rounded-xl border-2 border-black transition-transform active:scale-95 cursor-pointer"
          >
            Log out
          </button>
        </div>
      </div>
    );
  }

  const room = auth.role === 'admin' ? store.getRoomById(effectiveRoomId) || store.getRooms()[0] : store.getRoomById(effectiveRoomId);

  if (!room) {
    return (
      <div className="min-h-screen bg-neutral-200 dark:bg-neutral-950 flex items-center justify-center font-mono text-black dark:text-neutral-100">
        <div className="bg-white dark:bg-neutral-900 border-3 border-black dark:border-neutral-200 rounded-2xl p-8 text-center">
          <div className="font-bold text-lg mb-1">Loading Voltra Tower...</div>
          <div className="text-xs text-neutral-600 dark:text-neutral-400">Connecting to building data</div>
        </div>
      </div>
    );
  }

  const tenant = store.getTenantForRoom(room.id);
  const roomStats = store.getRoomMonthlyStats(room.id, calYear, calMonth) || {
    roomId: room.id,
    roomNumber: room.roomNumber,
    tenantName: tenant ? tenant.name : 'Vacant',
    year: calYear,
    month: calMonth,
    totalUnits: 0,
    totalPaid: 0,
    expectedCost: 0,
    balance: 0,
    status: 'no_usage',
    daysLogged: 0,
    appliedRate: 350,
  };

  const roomEntries = store.getRoomUsageEntries(room.id);
  const monthlyDateStr = `${calYear}-${calMonth.toString().padStart(2, '0')}-01`;
  const monthEntry = roomEntries.find((e) => e.date === monthlyDateStr);
  const buildingSummary = store.getBuildingSummary(calYear, calMonth);
  const invoices = store.getInvoices();
  const payments = store.getPayments();

  const handleOpenDayModalForDate = (dateStr: string, existingEntry?: UsageEntry) => {
    setSelectedDateStr(dateStr);
    setSelectedExistingEntry(existingEntry);
    setIsDayEntryModalOpen(true);
  };

  const handleSaveUsageEntry = (entryData: { unitsUsed: number; note: string }) => {
    store.saveUsageEntry({
      id: selectedExistingEntry?.id,
      roomId: room.id,
      date: selectedDateStr,
      unitsUsed: entryData.unitsUsed,
      amountPaid: selectedExistingEntry?.amountPaid ?? 0,
      note: entryData.note,
      createdBy: auth.role === 'admin' ? 'Admin' : tenant ? tenant.name : 'Tenant',
    });
  };

  const handleDeleteUsageEntry = (entryId: string) => {
    store.deleteUsageEntry(entryId);
  };

  const handleSaveRateConfig = (config: {
    scope: 'building' | 'floor';
    floorNumber?: number;
    utilityType: 'electricity' | 'water' | 'rent';
    ratePerUnit: number;
  }) => {
    store.setRateConfig({
      ...config,
      effectiveFrom: new Date().toISOString().split('T')[0],
    });
  };

  const handleAssignTenant = (tenantData: { name: string; phone: string; email: string; moveInDate: string }) => {
    store.assignTenantToRoom(room.id, tenantData);
  };

  const handleVacateRoom = () => {
    store.vacateRoom(room.id);
    setIsTenantProfileModalOpen(false);
  };

  const handleOpenMoveTenantModal = () => {
    setIsTenantProfileModalOpen(false);
    setIsMoveTenantModalOpen(true);
  };

  const handleSelectMoveDestination = (destRoomId: string) => {
    store.moveTenant(room.id, destRoomId);
    setIsMoveTenantModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-neutral-200 dark:bg-neutral-950 p-2 sm:p-4 lg:p-6 font-sans text-black flex items-center justify-center">
      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-black text-white border-2 border-black rounded-xl p-4 max-w-xs shadow-2xl font-mono">
          <div className="font-bold text-sm mb-1">{toast.title}</div>
          <div className="text-xs text-neutral-300">{toast.body}</div>
        </div>
      )}
      <div className="w-full max-w-[1440px] bg-neutral-100 dark:bg-neutral-950 border-3 border-black dark:border-neutral-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row min-h-[90vh] relative">
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            if (tab === 'floors') {
              setSelectedFloorNumber(null);
              setSelectedRoomId(null);
            }
          }}
          role={auth.role}
          onLogout={() => signOutUser()}
          activeRoomNumber={room.roomNumber}
          activeTenantName={tenant?.name}

          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-neutral-100 dark:bg-neutral-950">
          <TopBar
            title={
              activeTab === 'home'
                ? auth.role === 'admin'
                  ? 'Voltra Tower Admin'
                  : `Tenant Portal - ${room.roomNumber}`
                : activeTab === 'floors'
                ? selectedFloorNumber
                  ? `Floor ${selectedFloorNumber} Rooms`
                  : 'Building Floors (1-8)'
                : activeTab === 'rooms'
                ? `Room ${room.roomNumber} Details`
                : activeTab === 'payments'
                ? 'Building Payments Ledger'
                : activeTab === 'calendar'
                ? `Monthly Log - ${room.roomNumber}`
                : 'System Settings'
            }
            onBack={
              selectedFloorNumber || selectedRoomId
                ? () => {
                    if (selectedRoomId) setSelectedRoomId(null);
                    else if (selectedFloorNumber) setSelectedFloorNumber(null);
                  }
                : undefined
            }
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
            resetData={store.resetToSeedData}
            isDark={isDark}
            onToggleDark={toggleDarkMode}
          />

          {activeTab === 'home' && (
            <div className="space-y-8">
              {auth.role === 'admin' && !selectedFloorNumber && !selectedRoomId && (
                <>
                  <AdminSummaryPanel
                    summary={buildingSummary}
                    onOpenRateConfig={() => setIsRateModalOpen(true)}
                    unseenPaymentsCount={store.getUnseenPaymentsCount()}
                    onViewPayments={() => {
                      store.markPaymentsSeen();
                      setActiveTab('payments');
                    }}
                  />

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-serif font-black text-black dark:text-neutral-100">
                        Building Floors (10 Floors x 200 Rooms = 2,000 Rooms)
                      </h3>
                      <span className="font-mono text-xs font-bold text-neutral-600 dark:text-neutral-400 bg-white dark:bg-neutral-900 border border-black dark:border-neutral-200 px-2.5 py-1 rounded-lg">
                        Click any floor to view rooms
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {buildingSummary.perFloorSummaries.map((floor) => (
                        <FloorCard
                          key={floor.floorNumber}
                          summary={floor}
                          onSelectFloor={(fNum) => {
                            setSelectedFloorNumber(fNum);
                            setActiveTab('floors');
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {(auth.role === 'tenant' || selectedRoomId) && (
                <div className="space-y-6">
                  <TrainerStyleInfoCard
                    room={room}
                    tenant={tenant}
                    stats={roomStats}
                    onOpenCalendar={() => setActiveTab('calendar')}
                    onOpenTenantProfile={() => setIsTenantProfileModalOpen(true)}
                    onLogUsage={() => handleOpenDayModalForDate(monthlyDateStr, monthEntry)}
                    role={auth.role}
                  />

                  <MonthlyReadingPanel
                    year={calYear}
                    month={calMonth}
                    onMonthChange={(y, m) => {
                      setCalYear(y);
                      setCalMonth(m);
                    }}
                    entry={monthEntry}
                    onOpenEntry={() => handleOpenDayModalForDate(monthlyDateStr, monthEntry)}
                    appliedRate={roomStats.appliedRate}
                  />

                  <div className="bg-white dark:bg-neutral-900 border-3 border-black dark:border-neutral-200 rounded-2xl p-5 shadow-none">
                    <div className="flex items-center justify-between pb-3 border-b-2 border-black dark:border-neutral-700 mb-4">
                      <h3 className="font-serif font-black text-xl text-black dark:text-neutral-100">
                        Recent Electricity and Payment Logs ({room.roomNumber})
                      </h3>
                      <button
                        onClick={() => handleOpenDayModalForDate(monthlyDateStr, monthEntry)}
                        className="bg-black dark:bg-neutral-100 text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-white font-mono font-bold text-xs px-3 py-1.5 rounded-lg border border-black dark:border-neutral-200 cursor-pointer"
                      >
                        + Log This Month
                      </button>
                    </div>

                    <div className="overflow-x-auto border-2 border-black dark:border-neutral-200 rounded-xl">
                      <table className="w-full text-left font-mono text-xs border-collapse">
                        <thead>
                          <tr className="bg-neutral-400 border-b-2 border-black text-black font-bold uppercase">
                            <th className="p-3 border-r-2 border-black">Date</th>
                            <th className="p-3 border-r-2 border-black">Power Used</th>
                            <th className="p-3 border-r-2 border-black">Calculated Cost</th>
                            <th className="p-3 border-r-2 border-black">Amount Paid</th>
                            <th className="p-3 border-r-2 border-black">Note</th>
                            <th className="p-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roomEntries.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                className="p-6 text-center text-neutral-500 dark:text-neutral-400 font-bold bg-white dark:bg-neutral-900"
                              >
                                No entries logged for this room yet. Click on any calendar day to add one.
                              </td>
                            </tr>
                          ) : (
                            roomEntries
                              .sort((a, b) => b.date.localeCompare(a.date))
                              .slice(0, 10)
                              .map((entry, idx) => {
                                const cost = entry.unitsUsed * roomStats.appliedRate;
                                return (
                                  <tr
                                    key={entry.id}
                                    className={`border-b border-black dark:border-neutral-700 ${
                                      idx % 2 === 0 ? 'bg-white dark:bg-neutral-900' : 'bg-neutral-50 dark:bg-neutral-800'
                                    }`}
                                  >
                                    <td className="p-3 border-r-2 border-black dark:border-neutral-700 font-bold text-black dark:text-neutral-100">
                                      {entry.date}
                                    </td>
                                    <td className="p-3 border-r-2 border-black dark:border-neutral-700 font-bold text-black dark:text-neutral-100">
                                      {formatKwh(entry.unitsUsed)}
                                    </td>
                                    <td className="p-3 border-r-2 border-black dark:border-neutral-700 text-neutral-700 dark:text-neutral-300">
                                      {formatCurrency(cost)}
                                    </td>
                                    <td className="p-3 border-r-2 border-black dark:border-neutral-700 font-bold text-black dark:text-neutral-100">
                                      {formatCurrency(entry.amountPaid)}
                                    </td>
                                    <td className="p-3 border-r-2 border-black dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 truncate max-w-[200px]">
                                      {entry.note || '-'}
                                    </td>
                                    <td className="p-2 text-center">
                                      <button
                                        onClick={() =>
                                          handleOpenDayModalForDate(entry.date, entry)
                                        }
                                        className="bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-black dark:text-neutral-100 border border-black dark:border-neutral-600 p-1 px-2 rounded font-bold text-[10px] cursor-pointer"
                                      >
                                        Edit
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'floors' && (
            <div>
              {selectedFloorNumber ? (
                <RoomGrid
                  floorNumber={selectedFloorNumber}
                  rooms={store.getRooms().filter((r) => r.floorNumber === selectedFloorNumber)}
                  tenants={store.getTenants()}
                  getRoomMonthlyStats={(rId) =>
                    store.getRoomMonthlyStats(rId, calYear, calMonth)
                  }
                  onSelectRoom={(rId) => {
                    setSelectedRoomId(rId);
                    setActiveTab('home');
                  }}
                  onBackToFloors={() => setSelectedFloorNumber(null)}
                />
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-3xl font-serif font-black text-black dark:text-neutral-100">
                        Select a Floor to View its 200 Rooms
                      </h2>
                      <p className="font-mono text-xs text-neutral-600 dark:text-neutral-400">
                        Total 10 Floors - 2,000 Total Units in Voltra Tower
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {buildingSummary.perFloorSummaries.map((floor) => (
                      <FloorCard
                        key={floor.floorNumber}
                        summary={floor}
                        onSelectFloor={(fNum) => setSelectedFloorNumber(fNum)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'rooms' && (
            <div className="space-y-6">
              <TrainerStyleInfoCard
                room={room}
                tenant={tenant}
                stats={roomStats}
                onOpenCalendar={() => setActiveTab('calendar')}
                onOpenTenantProfile={() => setIsTenantProfileModalOpen(true)}
                onLogUsage={() => handleOpenDayModalForDate(monthlyDateStr, monthEntry)}
                role={auth.role}
              />

              <MonthlyReadingPanel
                year={calYear}
                month={calMonth}
                onMonthChange={(y, m) => {
                  setCalYear(y);
                  setCalMonth(m);
                }}
                entry={monthEntry}
                onOpenEntry={() => handleOpenDayModalForDate(monthlyDateStr, monthEntry)}
                appliedRate={roomStats.appliedRate}
              />
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="bg-white dark:bg-neutral-900 border-3 border-black dark:border-neutral-200 rounded-2xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b-2 border-black dark:border-neutral-700">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-serif font-black text-black dark:text-neutral-100">
                    Building Financial and Payment Ledger
                  </h2>
                  <p className="font-mono text-xs text-neutral-600 dark:text-neutral-400">
                    Collection status for {calMonth}/{calYear} across all 10 floors
                  </p>
                </div>

                <div className="bg-white border-2 border-black p-3 rounded-xl font-mono text-xs font-bold text-black">
                  Collected: {formatCurrency(buildingSummary.totalCollectedThisMonth)} | Outstanding:{' '}
                  <span className="text-black dark:text-neutral-100">
                    {formatCurrency(buildingSummary.totalOutstandingThisMonth)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                <div className="bg-neutral-800 border-2 border-black rounded-xl p-4">
                  <div className="font-bold uppercase text-[10px] text-white">Paid in Full</div>
                  <div className="text-3xl font-black text-white">{buildingSummary.paidRoomsCount} Rooms</div>
                </div>

                <div className="bg-neutral-400 border-2 border-black rounded-xl p-4">
                  <div className="font-bold uppercase text-[10px] text-black">Partial Payment</div>
                  <div className="text-3xl font-black text-black">{buildingSummary.partialRoomsCount} Rooms</div>
                </div>

                <div className="bg-black border-2 border-black rounded-xl p-4">
                  <div className="font-bold uppercase text-[10px] text-white">Overdue Rooms</div>
                  <div className="text-3xl font-black text-white">{buildingSummary.overdueRoomsCount} Rooms</div>
                </div>
              </div>

              <div className="border-2 border-black dark:border-neutral-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-400 border-b-2 border-black uppercase font-bold text-black">
                      <th className="p-3 border-r-2 border-black">Floor</th>
                      <th className="p-3 border-r-2 border-black">Power Used (kWh)</th>
                      <th className="p-3 border-r-2 border-black">Total Collected</th>
                      <th className="p-3 border-r-2 border-black">Outstanding</th>
                      <th className="p-3 border-r-2 border-black">Rate (RWF/kWh)</th>
                      <th className="p-3 text-center">Floor Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildingSummary.perFloorSummaries.map((f) => (
                      <tr key={f.floorNumber} className="border-b border-black dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 bg-white dark:bg-neutral-900">
                        <td className="p-3 border-r-2 border-black dark:border-neutral-700 font-bold text-black dark:text-neutral-100">{getFloorLabel(f.floorNumber)}</td>
                        <td className="p-3 border-r-2 border-black dark:border-neutral-700 text-black dark:text-neutral-100">{formatKwh(f.totalUnits)}</td>
                        <td className="p-3 border-r-2 border-black dark:border-neutral-700 font-bold text-black dark:text-neutral-100">
                          {formatCurrency(f.totalCollected)}
                        </td>
                        <td className="p-3 border-r-2 border-black dark:border-neutral-700 font-bold text-black dark:text-neutral-100">
                          {formatCurrency(f.totalOutstanding)}
                        </td>
                        <td className="p-3 border-r-2 border-black dark:border-neutral-700 text-black dark:text-neutral-100">{formatCurrency(f.ratePerUnit)}</td>
                        <td className="p-3 text-center">
                          <span className="bg-black dark:bg-neutral-100 text-white dark:text-black px-2 py-1 rounded text-[10px] font-bold">
                            {f.paidCount}/{f.occupiedRooms} Paid
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            
              <PaymentsLedgerPanel invoices={invoices} payments={payments} />
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="space-y-6">
              <MonthlyReadingPanel
                year={calYear}
                month={calMonth}
                onMonthChange={(y, m) => {
                  setCalYear(y);
                  setCalMonth(m);
                }}
                entry={monthEntry}
                onOpenEntry={() => handleOpenDayModalForDate(monthlyDateStr, monthEntry)}
                appliedRate={roomStats.appliedRate}
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-white dark:bg-neutral-900 border-3 border-black dark:border-neutral-200 rounded-2xl p-6 space-y-6 font-mono text-xs">
              <div className="pb-4 border-b-2 border-black dark:border-neutral-700">
                <h2 className="text-3xl font-serif font-black text-black dark:text-neutral-100">
                  System Settings and Controls
                </h2>
                <p className="text-neutral-600 dark:text-neutral-400">
                  Voltra Tower Electricity Rate and Seed Configuration
                </p>
              </div>

              <div className="bg-white border-2 border-black rounded-xl p-5 space-y-3 text-black">
                <h3 className="font-bold text-sm uppercase">
                  Electricity Tariff Rate Settings
                </h3>
                <p>Current Building Default Rate: {formatCurrency(buildingSummary.defaultRatePerUnit)} / kWh</p>
                <button
                  onClick={() => setIsRateModalOpen(true)}
                  className="bg-black text-white hover:bg-neutral-800 font-bold px-4 py-2 rounded-lg border border-black cursor-pointer"
                >
                  Configure Rate Tariff
                </button>
              </div>

              <div className="bg-neutral-200 dark:bg-neutral-800 border-2 border-black rounded-xl p-5 space-y-3 text-black dark:text-neutral-100">
                <h3 className="font-bold text-sm uppercase">
                  Building Reset
                </h3>
                <p>
                  Resets to an empty 8-floor, 200-room-per-floor building shell with no tenants
                  and no usage history. Use this only when starting the building over from scratch.
                </p>
                <button
                  onClick={() => {
                    if (confirm('Reset building? All current tenants and logged entries will be cleared.')) {
                      store.resetToSeedData();
                      alert('Building reset to an empty 2,000-room shell.');
                    }
                  }}
                  className="bg-black text-white hover:bg-neutral-800 font-bold px-4 py-2 rounded-lg border border-black cursor-pointer"
                >
                  Reset Building Data
                </button>
              </div>

              <div className="bg-neutral-200 dark:bg-neutral-800 border-2 border-black dark:border-neutral-200 rounded-xl p-5 space-y-3 text-black dark:text-neutral-100">
                <h3 className="font-bold text-sm uppercase">
                  Display
                </h3>
                <p>Current mode: {isDark ? 'Dark' : 'Light'}</p>
                <button
                  onClick={toggleDarkMode}
                  className="bg-black dark:bg-neutral-100 text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-white font-bold px-4 py-2 rounded-lg border border-black dark:border-neutral-200 cursor-pointer"
                >
                  Switch to {isDark ? 'Light' : 'Dark'} Mode
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      <DayEntryModal
        isOpen={isDayEntryModalOpen}
        onClose={() => setIsDayEntryModalOpen(false)}
        dateStr={selectedDateStr}
        existingEntry={selectedExistingEntry}
        appliedRate={roomStats.appliedRate}
        onSave={handleSaveUsageEntry}
        onDelete={handleDeleteUsageEntry}
        roomNumber={room.roomNumber}
      />

      <RateConfigModal
        isOpen={isRateModalOpen}
        onClose={() => setIsRateModalOpen(false)}
        currentRates={store.getRateConfigs()}
        onSaveRate={handleSaveRateConfig}
      />

      <TenantProfileModal
        isOpen={isTenantProfileModalOpen}
        onClose={() => setIsTenantProfileModalOpen(false)}
        room={room}
        tenant={tenant}
        onAssignTenant={handleAssignTenant}
        onMoveTenant={tenant ? handleOpenMoveTenantModal : undefined}
        onVacateRoom={tenant ? handleVacateRoom : undefined}
      />


      <SelectRoomModal
        isOpen={isMoveTenantModalOpen}
        onClose={() => setIsMoveTenantModalOpen(false)}
        rooms={store.getRooms().filter((r) => !r.tenantId)}
        onSelectRoom={handleSelectMoveDestination}
      />
    </div>
  );
}













