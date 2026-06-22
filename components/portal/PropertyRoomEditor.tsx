"use client";

import { UIButton } from "@/components/ui/button";
import { UIInput } from "@/components/ui/input";
import { UISelect } from "@/components/ui/select";
import { calculateRentPerWeek } from "@/lib/normalize";

export type PropertyRoomDraft = {
  roomName: string;
  rentPerMonth: string;
  expectedCommissionPct: string;
};

type Props = {
  value: PropertyRoomDraft[];
  onChange: (rooms: PropertyRoomDraft[]) => void;
  disabled?: boolean;
};

const ROOM_TYPES = ["Studio Room", "Single Room", "Double Room", "Ensuite Room", "Loft"] as const;

function createEmptyRoom(): PropertyRoomDraft {
  return {
    roomName: ROOM_TYPES[0],
    rentPerMonth: "",
    expectedCommissionPct: "",
  };
}

export function PropertyRoomEditor({ value, onChange, disabled = false }: Props) {
  function updateRoom(index: number, key: keyof PropertyRoomDraft, nextValue: string) {
    onChange(value.map((room, roomIndex) => (roomIndex === index ? { ...room, [key]: nextValue } : room)));
  }

  function addRoom() {
    onChange([...value, createEmptyRoom()]);
  }

  function removeRoom(index: number) {
    if (value.length <= 1) return;
    onChange(value.filter((_, roomIndex) => roomIndex !== index));
  }

  return (
    <div className="stack" style={{ gap: "0.85rem" }}>
      <div style={{ overflowX: "auto" }}>
        <table className="table" style={{ minWidth: 720 }}>
          <thead>
            <tr>
              <th>Room Type</th>
              <th>Rent / Month (£)</th>
              <th>Rent / Week</th>
              <th>Commission %</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {value.map((room, index) => {
              const weeklyRent = calculateRentPerWeek(room.rentPerMonth);

              return (
                <tr key={`${room.roomName}-${index}`}>
                  <td>
                    <UISelect
                      value={room.roomName}
                      onChange={(event) => updateRoom(index, "roomName", event.target.value)}
                      disabled={disabled}
                    >
                      {ROOM_TYPES.map((roomType) => (
                        <option key={roomType} value={roomType}>
                          {roomType}
                        </option>
                      ))}
                    </UISelect>
                  </td>
                  <td>
                    <UIInput
                      type="number"
                      min={0}
                      step="0.01"
                      value={room.rentPerMonth}
                      onChange={(event) => updateRoom(index, "rentPerMonth", event.target.value)}
                      placeholder="e.g. 650"
                      disabled={disabled}
                    />
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: "var(--brand-gold)" }}>
                      {weeklyRent == null ? "—" : `£${weeklyRent.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </div>
                  </td>
                  <td>
                    <UIInput
                      type="number"
                      min={0}
                      step="0.1"
                      value={room.expectedCommissionPct}
                      onChange={(event) => updateRoom(index, "expectedCommissionPct", event.target.value)}
                      placeholder="Optional"
                      disabled={disabled}
                    />
                  </td>
                  <td>
                    <UIButton type="button" variant="secondary" onClick={() => removeRoom(index)} disabled={disabled || value.length <= 1}>
                      Remove
                    </UIButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="inline-row">
        <UIButton type="button" variant="secondary" onClick={addRoom} disabled={disabled}>
          Add Room Row
        </UIButton>
      </div>
    </div>
  );
}