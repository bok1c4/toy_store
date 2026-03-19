export interface Toy {
  toyId: number;
  name: string;
  permalink: string;
  description: string;
  targetGroup: string;
  productionDate: string;
  price: number;        // integer RSD (e.g. 1499 = 1.499 RSD)
  imageUrl: string;     // relative path e.g. "/img/1.png" — use emoji fallback
  ageGroup: {
    ageGroupId: number;
    name: string;       // "0-2", "3-5", "6-9", "10+"
    description: string;
  };
  type: {
    typeId: number;
    name: string;       // "Slagalica", "Vozilo", etc.
    description: string;
  };
}

export interface AgeGroup {
  ageGroupId: number;
  name: string;
  description: string;
}

export interface ToyType {
  typeId: number;
  name: string;
  description: string;
}
