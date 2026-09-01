import React, { useState } from 'react';
import { Room } from '../../1_core/domain/types';

interface SelectRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: Room[];
  onSelectRoom: (roomId: string) => void;
}

export const SelectRoomModal: React.FC<SelectRoomModalProps> = ({
  isOpen,
  onClose,
  rooms,
  onSelectRoom,
}) => {
  const [selectedFloor, setSelectedFloor] = useState<number>(3);
  const [search, setSearch] = useState<string>('');

  if (!isOpen) return null;

  const floorRooms = rooms.filter((r) => r.floorNumber === selectedFloor);
  const filtered = floorRooms.filter((r) =>
    r.roomNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white border-3 border-black rounded-2xl w-full max-w-lg p-6 shadow-none text-black relative flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="bg-black text-white p-1.5 rounded font-mono font-bold text-sm">
              🚪
            </span>
            <h3 className="font-serif font-black text-xl text-black">
              Switch Tenant Room
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 bg-white hover:bg-neutral-100 border-2 border-black rounded-lg font-mono font-bold text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Floor bar */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-3 shrink-0 font-mono text-xs">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((f) => (
            <button
              key={f}
              onClick={() => setSelectedFloor(f)}
              className={`p-2 px-3 rounded-lg border-2 font-bold cursor-pointer whitespace-nowrap ${
                selectedFloor === f
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black border-black hover:bg-neutral-100'
              }`}
            >
              Floor {f}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter room number e.g. F3-014..."
          className="w-full bg-white text-black font-mono text-xs p-2.5 border-2 border-black rounded-xl mb-3 shrink-0 focus:outline-none"
        />

        {/* Room Grid */}
        <div className="overflow-y-auto pr-1 flex-1 grid grid-cols-3 sm:grid-cols-4 gap-2 font-mono text-xs">
          {filtered.map((room) => (
            <button
              key={room.id}
              onClick={() => {
                onSelectRoom(room.id);
                onClose();
              }}
              className="bg-white hover:bg-neutral-200 border-2 border-black rounded-xl p-2.5 text-center font-bold text-black cursor-pointer transition-colors"
            >
              <div>{room.roomNumber}</div>
              <div className="text-[9px] text-neutral-500 font-normal">
                {room.tenantId ? 'Occupied' : 'Vacant'}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

