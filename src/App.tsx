import React, { useState } from 'react';
import { useVoltraStore, useAuthRole } from './3_frontend/hooks/useVoltraStore';
import { Sidebar, ActiveTab } from './3_frontend/components/Sidebar';
import { TopBar } from './3_frontend/components/TopBar';
import { TrainerStyleInfoCard } from './3_frontend/components/TrainerStyleInfoCard';
import { CalendarGrid } from './3_frontend/components/CalendarGrid';
import { DayEntryModal } from './3_frontend/components/DayEntryModal';
import { AdminSummaryPanel } from './3_frontend/components/AdminSummaryPanel';
import { FloorCard } from './3_frontend/components/FloorCard';
import { RoomGrid } from './3_frontend/components/RoomGrid';
import { RateConfigModal } from './3_frontend/components/RateConfigModal';
import { TenantProfileModal } from './3_frontend/components/TenantProfileModal';
import { SelectRoomModal } from './3_frontend/components/SelectRoomModal';
import { getCurrentYearMonth } from './1_core/utils/dateUtils';
import { UsageEntry } from './1_core/domain/types';
import { formatCurrency, formatKwh, getStatusBadgeStyle, getStatusLabel } from './1_core/utils/formatters';

export default function App() {
  const store = useVoltraStore();
  const auth = useAuthRole();

  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [selectedFloorNumber, setSelectedFloorNumber] = useState<number | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Calendar year / month state
  const currentYM = getCurrentYearMonth();
  const [calYear, setCalYear] = useState<number>(currentYM.year);
  const [calMonth, setCalMonth] = useState<number>(currentYM.month);

  // Modals state
  const [isDayEntryModalOpen, setIsDayEntryModalOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState<string>('');
  const [selectedExistingEntry, setSelectedExistingEntry] = useState<UsageEntry | undefined>();
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [isTenantProfileModalOpen, setIsTenantProfileModalOpen] = useState(false);
  const [isSelectRoomModalOpen, setIsSelectRoomModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Global search query
  const [searchQuery, setSearchQuery] = useState('');

  // Active room determination
  const effectiveRoomId =
    auth.role === 'admin'
      ? selectedRoomId || 'room-3-14'
      : auth.activeRoomId;

  const room = store.getRoomById(effectiveRoomId) || store.getRooms()[0];
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
    appliedRate: 0.25,
  };

  const roomEntries = store.getRoomUsageEntries(room.id);
  const buildingSummary = store.getBuildingSummary(calYear, calMonth);

  // Handlers
  const handleOpenDayModalForDate = (dateStr: string, existingEntry?: UsageEntry) => {
    setSelectedDateStr(dateStr);
    setSelectedExistingEntry(existingEntry);
    setIsDayEntryModalOpen(true);
  };

  const handleSaveUsageEntry = (entryData: { unitsUsed: number; amountPaid: number; note: string }) => {
    store.saveUsageEntry({
      id: selectedExistingEntry?.id,
      roomId: room.id,
      date: selectedDateStr,
      unitsUsed: entryData.unitsUsed,
      amountPaid: entryData.amountPaid,
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
    ratePerUnit: number;
  }) => {
    store.setRateConfig({
      ...config,
      effectiveFrom: new Date().toISOString().split('T')[0],
    });
  };

  const handleAssignTenant = (tenantData: { name: string; phone: string; moveInDate: string }) => {
    store.assignTenantToRoom(room.id, tenantData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#8bd3dd] via-[#f3d2c1] to-[#f5b2b2] p-2 sm:p-4 lg:p-6 font-sans text-black flex items-center justify-center">
      {/* Outer rounded card container with 3px solid black border matching reference image */}
      <div className="w-full max-w-[1440px] bg-[#f7f5f0] border-3 border-black rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row min-h-[90vh] relative">
        {/* Fixed Left Sidebar */}
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
          onRoleToggle={() => {
            const nextRole = auth.role === 'admin' ? 'tenant' : 'admin';
            auth.setRole(nextRole);
            if (nextRole === 'admin') {
              setActiveTab('home');
            }
          }}
          activeRoomNumber={room.roomNumber}
          activeTenantName={tenant?.name}
          onSelectTenantRoomModal={() => setIsSelectRoomModalOpen(true)}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Main Content Pane */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-[#f7f5f0]">
          <TopBar
            title={
              activeTab === 'home'
                ? auth.role === 'admin'
                  ? 'Voltra Tower Admin'
                  : `Tenant Portal • ${room.roomNumber}`
                : activeTab === 'floors'
                ? selectedFloorNumber
                  ? `Floor ${selectedFloorNumber} Rooms`
                  : 'Building Floors (1–8)'
                : activeTab === 'rooms'
                ? `Room ${room.roomNumber} Details`
                : activeTab === 'payments'
                ? 'Building Payments Ledger'
                : activeTab === 'calendar'
                ? `Calendar Log • ${room.roomNumber}`
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
          />

          {/* TAB 1: HOME VIEW */}
          {activeTab === 'home' && (
            <div className="space-y-8">
              {/* Admin Dashboard view */}
              {auth.role === 'admin' && !selectedFloorNumber && !selectedRoomId && (
                <>
                  <AdminSummaryPanel
                    summary={buildingSummary}
                    onOpenRateConfig={() => setIsRateModalOpen(true)}
                  />

                  {/* 8 Floors Cards Grid */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-serif font-black text-black">
                        Building Floors (8 Floors x 200 Rooms = 1,600 Rooms)
                      </h3>
                      <span className="font-mono text-xs font-bold text-neutral-600 bg-white border border-black px-2.5 py-1 rounded-lg">
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

              {/* Tenant Portal view OR Selected Room Detail view */}
              {(auth.role === 'tenant' || selectedRoomId) && (
                <div className="space-y-6">
                  {/* Highlight Trainer-style Info Card */}
                  <TrainerStyleInfoCard
                    room={room}
                    tenant={tenant}
                    stats={roomStats}
                    onOpenCalendar={() => setActiveTab('calendar')}
                    onOpenTenantProfile={() => setIsTenantProfileModalOpen(true)}
                    onLogUsage={() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      const todayEntry = roomEntries.find((e) => e.date === todayStr);
                      handleOpenDayModalForDate(todayStr, todayEntry);
                    }}
                    role={auth.role}
                  />

                  {/* Interactive Monthly Calendar for this room */}
                  <CalendarGrid
                    year={calYear}
                    month={calMonth}
                    onMonthChange={(y, m) => {
                      setCalYear(y);
                      setCalMonth(m);
                    }}
                    entries={roomEntries}
                    onSelectDate={(dateStr, existingEntry) => {
                      handleOpenDayModalForDate(dateStr, existingEntry);
                    }}
                    appliedRate={roomStats.appliedRate}
                  />

                  {/* Recent Logs Table */}
                  <div className="bg-white border-3 border-black rounded-2xl p-5 shadow-none">
                    <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-4">
                      <h3 className="font-serif font-black text-xl text-black">
                        Recent Electricity & Payment Logs ({room.roomNumber})
                      </h3>
                      <button
                        onClick={() => {
                          const todayStr = new Date().toISOString().split('T')[0];
                          handleOpenDayModalForDate(todayStr);
                        }}
                        className="bg-black text-white hover:bg-neutral-800 font-mono font-bold text-xs px-3 py-1.5 rounded-lg border border-black cursor-pointer"
                      >
                        + Log Today
                      </button>
                    </div>

                    <div className="overflow-x-auto border-2 border-black rounded-xl">
                      <table className="w-full text-left font-mono text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#feca57] border-b-2 border-black text-black font-bold uppercase">
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
                                className="p-6 text-center text-neutral-500 font-bold"
                              >
                                No entries logged for this room yet. Click on any calendar day to add one!
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
                                    className={`border-b border-black ${
                                      idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50'
                                    }`}
                                  >
                                    <td className="p-3 border-r-2 border-black font-bold">
                                      {entry.date}
                                    </td>
                                    <td className="p-3 border-r-2 border-black font-bold text-black">
                                      {formatKwh(entry.unitsUsed)}
                                    </td>
                                    <td className="p-3 border-r-2 border-black text-neutral-700">
                                      {formatCurrency(cost)}
                                    </td>
                                    <td className="p-3 border-r-2 border-black font-bold text-[#00b894]">
                                      {formatCurrency(entry.amountPaid)}
                                    </td>
                                    <td className="p-3 border-r-2 border-black text-neutral-600 truncate max-w-[200px]">
                                      {entry.note || '—'}
                                    </td>
                                    <td className="p-2 text-center">
                                      <button
                                        onClick={() =>
                                          handleOpenDayModalForDate(entry.date, entry)
                                        }
                                        className="bg-white hover:bg-neutral-100 border border-black p-1 px-2 rounded font-bold text-[10px] cursor-pointer"
                                      >
                                        Edit ✏
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

          {/* TAB 2: FLOORS VIEW (200 Rooms per floor) */}
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
                      <h2 className="text-3xl font-serif font-black text-black">
                        Select a Floor to View its 200 Rooms
                      </h2>
                      <p className="font-mono text-xs text-neutral-600">
                        Total 8 Floors • 1,600 Total Units in Voltra Tower
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

          {/* TAB 3: ROOMS VIEW */}
          {activeTab === 'rooms' && (
            <div className="space-y-6">
              <TrainerStyleInfoCard
                room={room}
                tenant={tenant}
                stats={roomStats}
                onOpenCalendar={() => setActiveTab('calendar')}
                onOpenTenantProfile={() => setIsTenantProfileModalOpen(true)}
                onLogUsage={() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const todayEntry = roomEntries.find((e) => e.date === todayStr);
                  handleOpenDayModalForDate(todayStr, todayEntry);
                }}
                role={auth.role}
              />

              <CalendarGrid
                year={calYear}
                month={calMonth}
                onMonthChange={(y, m) => {
                  setCalYear(y);
                  setCalMonth(m);
                }}
                entries={roomEntries}
                onSelectDate={(dateStr, existingEntry) => {
                  handleOpenDayModalForDate(dateStr, existingEntry);
                }}
                appliedRate={roomStats.appliedRate}
              />
            </div>
          )}

          {/* TAB 4: PAYMENTS LEDGER */}
          {activeTab === 'payments' && (
            <div className="bg-white border-3 border-black rounded-2xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b-2 border-black">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-serif font-black text-black">
                    Building Financial & Payment Ledger
                  </h2>
                  <p className="font-mono text-xs text-neutral-600">
                    Collection status for {calMonth}/{calYear} across all 8 floors
                  </p>
                </div>

                <div className="bg-[#a8e6cf] border-2 border-black p-3 rounded-xl font-mono text-xs font-bold">
                  Collected: {formatCurrency(buildingSummary.totalCollectedThisMonth)} • Outstanding:{' '}
                  <span className="text-[#ff3838]">
                    {formatCurrency(buildingSummary.totalOutstandingThisMonth)}
                  </span>
                </div>
              </div>

              {/* Status summary tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                <div className="bg-[#2ed573] border-2 border-black rounded-xl p-4">
                  <div className="font-bold uppercase text-[10px]">Paid in Full</div>
                  <div className="text-3xl font-black">{buildingSummary.paidRoomsCount} Rooms</div>
                </div>

                <div className="bg-[#feca57] border-2 border-black rounded-xl p-4">
                  <div className="font-bold uppercase text-[10px]">Partial Payment</div>
                  <div className="text-3xl font-black">{buildingSummary.partialRoomsCount} Rooms</div>
                </div>

                <div className="bg-[#ff6b6b] border-2 border-black rounded-xl p-4">
                  <div className="font-bold uppercase text-[10px]">Overdue Rooms</div>
                  <div className="text-3xl font-black">{buildingSummary.overdueRoomsCount} Rooms</div>
                </div>
              </div>

              {/* All rooms collection table summary */}
              <div className="border-2 border-black rounded-xl overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#feca57] border-b-2 border-black uppercase font-bold">
                      <th className="p-3 border-r-2 border-black">Floor</th>
                      <th className="p-3 border-r-2 border-black">Power Used (kWh)</th>
                      <th className="p-3 border-r-2 border-black">Total Collected ($)</th>
                      <th className="p-3 border-r-2 border-black">Outstanding ($)</th>
                      <th className="p-3 border-r-2 border-black">Rate ($/kWh)</th>
                      <th className="p-3 text-center">Floor Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildingSummary.perFloorSummaries.map((f) => (
                      <tr key={f.floorNumber} className="border-b border-black hover:bg-neutral-50">
                        <td className="p-3 border-r-2 border-black font-bold">Floor {f.floorNumber}</td>
                        <td className="p-3 border-r-2 border-black">{formatKwh(f.totalUnits)}</td>
                        <td className="p-3 border-r-2 border-black font-bold text-[#2ed573]">
                          {formatCurrency(f.totalCollected)}
                        </td>
                        <td className="p-3 border-r-2 border-black font-bold text-[#ff3838]">
                          {formatCurrency(f.totalOutstanding)}
                        </td>
                        <td className="p-3 border-r-2 border-black">${f.ratePerUnit.toFixed(2)}</td>
                        <td className="p-3 text-center">
                          <span className="bg-black text-white px-2 py-1 rounded text-[10px] font-bold">
                            {f.paidCount}/{f.occupiedRooms} Paid
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: CALENDAR VIEW */}
          {activeTab === 'calendar' && (
            <div className="space-y-6">
              <CalendarGrid
                year={calYear}
                month={calMonth}
                onMonthChange={(y, m) => {
                  setCalYear(y);
                  setCalMonth(m);
                }}
                entries={roomEntries}
                onSelectDate={(dateStr, existingEntry) => {
                  handleOpenDayModalForDate(dateStr, existingEntry);
                }}
                appliedRate={roomStats.appliedRate}
              />
            </div>
          )}

          {/* TAB 6: SETTINGS VIEW */}
          {activeTab === 'settings' && (
            <div className="bg-white border-3 border-black rounded-2xl p-6 space-y-6 font-mono text-xs">
              <div className="pb-4 border-b-2 border-black">
                <h2 className="text-3xl font-serif font-black text-black">
                  System Settings & Controls
                </h2>
                <p className="text-neutral-600">
                  Voltra Tower Electricity Rate & Seed Configuration
                </p>
              </div>

              {/* Rate Config Section */}
              <div className="bg-[#a8e6cf] border-2 border-black rounded-xl p-5 space-y-3">
                <h3 className="font-bold text-sm text-black uppercase">
                  ⚡ Electricity Tariff Rate Settings
                </h3>
                <p>Current Building Default Rate: ${buildingSummary.defaultRatePerUnit.toFixed(2)} / kWh</p>
                <button
                  onClick={() => setIsRateModalOpen(true)}
                  className="bg-black text-white hover:bg-neutral-800 font-bold px-4 py-2 rounded-lg border border-black cursor-pointer"
                >
                  Configure Rate Tariff
                </button>
              </div>

              {/* Seed Data Reset */}
              <div className="bg-[#ff80bf] border-2 border-black rounded-xl p-5 space-y-3">
                <h3 className="font-bold text-sm text-black uppercase">
                  🔄 Database Reset & Seeding
                </h3>
                <p>
                  Generates all 8 floors x 200 rooms (1,600 total rooms) with demo occupants and past daily usage logs.
                </p>
                <button
                  onClick={() => {
                    if (confirm('Reset to seed dataset? All current custom edits will be refreshed.')) {
                      store.resetToSeedData();
                      alert('Seed dataset restored successfully!');
                    }
                  }}
                  className="bg-black text-white hover:bg-neutral-800 font-bold px-4 py-2 rounded-lg border border-black cursor-pointer"
                >
                  Reset Seed Building Data
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODALS */}
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
      />

      <SelectRoomModal
        isOpen={isSelectRoomModalOpen}
        onClose={() => setIsSelectRoomModalOpen(false)}
        rooms={store.getRooms()}
        onSelectRoom={(rId) => auth.setActiveRoomId(rId)}
      />
    </div>
  );
}
