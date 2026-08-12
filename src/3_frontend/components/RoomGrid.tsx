import React, { useState, useMemo } from 'react';
import { Room, Tenant, MonthlyRoomStats, BalanceStatus } from '../../1_core/domain/types';
import { formatCurrency, formatKwh, getStatusBadgeStyle, getStatusLabel } from '../../1_core/utils/formatters';

interface RoomGridProps {
  floorNumber: number;
  rooms: Room[];
  tenants: Tenant[];
  getRoomMonthlyStats: (roomId: string) => MonthlyRoomStats | undefined;
  onSelectRoom: (roomId: string) => void;
  onBackToFloors: () => void;
}

export const RoomGrid: React.FC<RoomGridProps> = ({
  floorNumber,
  rooms,
  tenants,
  getRoomMonthlyStats,
  onSelectRoom,
  onBackToFloors,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | BalanceStatus | 'vacant'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20; // 200 rooms divided into 10 pages for super fast rendering

  const tenantMap = useMemo(() => {
    const map = new Map<string, Tenant>();
    tenants.forEach((t) => map.set(t.id, t));
    return map;
  }, [tenants]);

  // Combine room + stats + tenant
  const processedRooms = useMemo(() => {
    return rooms.map((room) => {
      const tenant = room.tenantId ? tenantMap.get(room.tenantId) : undefined;
      const stats = getRoomMonthlyStats(room.id);
      return {
        room,
        tenant,
        stats,
      };
    });
  }, [rooms, tenantMap, getRoomMonthlyStats]);

  // Filter logic
  const filteredRooms = useMemo(() => {
    return processedRooms.filter(({ room, tenant, stats }) => {
      // Status filter
      if (statusFilter === 'vacant') {
        if (room.tenantId) return false;
      } else if (statusFilter !== 'all') {
        if (!stats || stats.status !== statusFilter) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const roomNumMatch = room.roomNumber.toLowerCase().includes(q);
        const tenantNameMatch = tenant ? tenant.name.toLowerCase().includes(q) : false;
        if (!roomNumMatch && !tenantNameMatch) return false;
      }

      return true;
    });
  }, [processedRooms, statusFilter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredRooms.length / pageSize) || 1;
  const paginatedRooms = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRooms.slice(start, start + pageSize);
  }, [filteredRooms, currentPage, pageSize]);

  return (
    <div className="bg-white border-3 border-black rounded-2xl p-4 sm:p-6 shadow-none">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b-2 border-black mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToFloors}
            className="p-2 bg-white hover:bg-neutral-100 border-2 border-black rounded-lg text-black font-mono font-bold transition-transform active:scale-95 cursor-pointer"
          >
            ← Back to Floors
          </button>
          <div>
            <h2 className="text-2xl sm:text-3xl font-serif font-black text-black">
              Floor {floorNumber} Rooms List
            </h2>
            <p className="font-mono text-xs text-neutral-600">
              Showing {filteredRooms.length} of {rooms.length} Rooms (200 Total)
            </p>
          </div>
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
          {(['all', 'paid', 'partial', 'overdue', 'vacant'] as const).map((st) => {
            const isActive = statusFilter === st;
            return (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg border-2 font-bold uppercase transition-transform cursor-pointer ${
                  isActive
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black border-black hover:bg-neutral-100'
                }`}
              >
                {st}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          placeholder="Filter by room number (e.g. F3-114) or tenant name..."
          className="w-full bg-white text-black font-mono text-xs p-3 border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-black placeholder:text-neutral-500"
        />
      </div>

      {/* Table of Rooms */}
      <div className="overflow-x-auto border-2 border-black rounded-xl mb-4">
        <table className="w-full text-left font-mono text-xs border-collapse">
          <thead>
            <tr className="bg-[#a8e6cf] border-b-2 border-black text-black font-bold uppercase">
              <th className="p-3 border-r-2 border-black">Room #</th>
              <th className="p-3 border-r-2 border-black">Tenant / Occupant</th>
              <th className="p-3 border-r-2 border-black">Monthly Usage</th>
              <th className="p-3 border-r-2 border-black">Total Paid</th>
              <th className="p-3 border-r-2 border-black">Balance Status</th>
              <th className="p-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRooms.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-neutral-500 font-mono font-bold">
                  No rooms matching the selected filter query.
                </td>
              </tr>
            ) : (
              paginatedRooms.map(({ room, tenant, stats }, index) => {
                const badge = stats ? getStatusBadgeStyle(stats.status) : undefined;
                return (
                  <tr
                    key={room.id}
                    className={`border-b border-black hover:bg-[#feca57]/20 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-neutral-50'
                    }`}
                  >
                    {/* Room Number */}
                    <td className="p-3 border-r-2 border-black font-black text-sm">
                      {room.roomNumber}
                    </td>

                    {/* Tenant */}
                    <td className="p-3 border-r-2 border-black">
                      {tenant ? (
                        <div>
                          <div className="font-bold text-black">{tenant.name}</div>
                          <div className="text-[10px] text-neutral-600">{tenant.phone}</div>
                        </div>
                      ) : (
                        <span className="text-neutral-400 font-semibold italic">Vacant</span>
                      )}
                    </td>

                    {/* Usage */}
                    <td className="p-3 border-r-2 border-black font-semibold">
                      {stats ? formatKwh(stats.totalUnits) : '0 kWh'}
                    </td>

                    {/* Paid */}
                    <td className="p-3 border-r-2 border-black font-semibold text-black">
                      {stats ? formatCurrency(stats.totalPaid) : '$0.00'}
                    </td>

                    {/* Status Badge */}
                    <td className="p-3 border-r-2 border-black">
                      {stats && badge ? (
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {getStatusLabel(stats.status)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-neutral-400">—</span>
                      )}
                    </td>

                    {/* Action Button */}
                    <td className="p-2 text-center">
                      <button
                        onClick={() => onSelectRoom(room.id)}
                        className="bg-black hover:bg-neutral-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg border border-black cursor-pointer transition-transform active:scale-95 whitespace-nowrap"
                      >
                        Calendar History 📅
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs pt-2">
        <span className="text-neutral-700">
          Page {currentPage} of {totalPages} ({filteredRooms.length} rooms)
        </span>

        <div className="flex items-center gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="p-2 px-3 bg-white border-2 border-black rounded-lg font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            ◄ Prev
          </button>
          <span className="font-bold px-2">{currentPage}</span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="p-2 px-3 bg-white border-2 border-black rounded-lg font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Next ►
          </button>
        </div>
      </div>
    </div>
  );
};
