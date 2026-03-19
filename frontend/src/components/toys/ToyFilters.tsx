'use client';

export interface AgeGroup {
  id: number;
  name: string;
}

export interface ToyType {
  id: number;
  name: string;
}

interface ToyFiltersProps {
  ageGroups: AgeGroup[];
  toyTypes: ToyType[];
  selectedAgeGroup: string;
  selectedType: string;
  onAgeGroupChange: (ageGroup: string) => void;
  onTypeChange: (type: string) => void;
  onClearFilters: () => void;
}

export function ToyFilters({
  ageGroups,
  toyTypes,
  selectedAgeGroup,
  selectedType,
  onAgeGroupChange,
  onTypeChange,
  onClearFilters,
}: ToyFiltersProps): JSX.Element {
  const hasFilters = selectedAgeGroup || selectedType;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="age-group" className="block text-sm font-medium text-foreground">
          Starosna grupa
        </label>
        <select
          id="age-group"
          value={selectedAgeGroup}
          onChange={(e) => onAgeGroupChange(e.target.value)}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Sve starosti</option>
          {ageGroups.map((ag) => (
            <option key={ag.id} value={ag.name}>
              {ag.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="toy-type" className="block text-sm font-medium text-foreground">
          Tip igračke
        </label>
        <select
          id="toy-type"
          value={selectedType}
          onChange={(e) => onTypeChange(e.target.value)}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Svi tipovi</option>
          {toyTypes.map((t) => (
            <option key={t.id} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {hasFilters && (
        <button
          onClick={onClearFilters}
          className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Obriši filtere
        </button>
      )}
    </div>
  );
}
