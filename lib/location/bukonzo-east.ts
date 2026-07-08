export type BukonzoEastParish = string;
export type BukonzoEastVillage = string;

export type BukonzoEastSubcounty = {
  name: string;
  parishes: BukonzoEastParish[];
  villagesByParish?: Record<string, BukonzoEastVillage[]>;
};

export type BukonzoEastConstituency = {
  name: string;
  subCounties: BukonzoEastSubcounty[];
};

export const BUKONZO_EAST_CONSTITUENCIES: BukonzoEastConstituency[] = [
  {
    name: "Bukonzo County East Constituency",
    subCounties: [
      {
        name: "Kisinga subcounty",
        parishes: ["Kagando", "Kajenge", "Nsenyi", "Nyabirongo"],
      },
      {
        name: "Kisinga town council",
        parishes: ["Kagando", "Kinyonkoko", "Nyabirongo", "Nsenyi", "Rwenguhyo"],
        villagesByParish: {
          Kagando: ["Kagando 1", "Kagando 2", "Nyamugasani", "Rwembyo"],
          Nsenyi: ["Karambi", "Kisinga 1", "Kisinga 2", "Mughende", "Nsenyi", "Makerere"],
        },
      },
      {
        name: "Kyondo sub county",
        parishes: ["Buyagha", "Ibimbo", "Kanyatsi", "Kasokero"],
      },
      {
        name: "Kyarumba sub county",
        parishes: ["Buthale", "Kaghema", "Kalonge", "Kanyatsi", "Kihungu"],
      },
      {
        name: "Kyarumba town council",
        parishes: ["Kyarumba", "Nyakeya", "Kabughabugha"],
      },
      {
        name: "Kitabu sub county",
        parishes: [
          "Kiriba",
          "Kitabu",
          "Mughete",
          "Nyakakindo",
          "Kabirizi",
          "Butale",
          "Kinyaminagha",
          "Nyondo",
        ],
      },
      {
        name: "Mahango sub county",
        parishes: ["Kyabwenge Lhuhiri", "Mahango", "Nyamisule"],
      },
      {
        name: "Kinyamaseke town council",
        parishes: [
          "Kinyamaseke North Ward",
          "Central Ward",
          "Kinyamaseke South Ward",
          "Rwenganju Ward",
          "Mairo Ikumi Ward",
          "Musomoro Ward",
        ],
      },
      {
        name: "Munkunyu sub county",
        parishes: ["Kabingo", "Katsungiro", "Kitsutsu"],
      },
      {
        name: "Nyakatozi sub county",
        parishes: ["Kamuruli", "Kisasa", "Muruti", "Nyamugasani"],
      },
    ],
  },
];

export const BUKONZO_EAST_SUBCOUNTIES = BUKONZO_EAST_CONSTITUENCIES.flatMap(
  (constituency) => constituency.subCounties,
);

export function getBukonzoEastConstituencyNames() {
  return BUKONZO_EAST_CONSTITUENCIES.map((entry) => entry.name);
}

export function getBukonzoEastSubcounties(constituency?: string | null) {
  if (!constituency) return [];
  const normalized = constituency.trim().toLowerCase();
  return (
    BUKONZO_EAST_CONSTITUENCIES.find(
      (entry) => entry.name.trim().toLowerCase() === normalized,
    )?.subCounties ?? []
  );
}

export function getBukonzoEastParishes(
  constituency?: string | null,
  subCounty?: string | null,
) {
  if (!constituency || !subCounty) return [];
  const normalizedConstituency = constituency.trim().toLowerCase();
  const normalizedSubCounty = subCounty.trim().toLowerCase();

  const constituencyRecord = BUKONZO_EAST_CONSTITUENCIES.find(
    (entry) => entry.name.trim().toLowerCase() === normalizedConstituency,
  );

  return (
    constituencyRecord?.subCounties.find(
      (entry) => entry.name.trim().toLowerCase() === normalizedSubCounty,
    )?.parishes ?? []
  );
}

export function getBukonzoEastVillages(
  constituency?: string | null,
  subCounty?: string | null,
  parish?: string | null,
) {
  if (!constituency || !subCounty || !parish) return [];

  const normalizedConstituency = constituency.trim().toLowerCase();
  const normalizedSubCounty = subCounty.trim().toLowerCase();
  const normalizedParish = parish.trim().toLowerCase();

  const constituencyRecord = BUKONZO_EAST_CONSTITUENCIES.find(
    (entry) => entry.name.trim().toLowerCase() === normalizedConstituency,
  );
  const subCountyRecord = constituencyRecord?.subCounties.find(
    (entry) => entry.name.trim().toLowerCase() === normalizedSubCounty,
  );

  if (!subCountyRecord?.villagesByParish) return [];

  const parishRecordKey = Object.keys(subCountyRecord.villagesByParish).find(
    (key) => key.trim().toLowerCase() === normalizedParish,
  );

  return parishRecordKey ? subCountyRecord.villagesByParish[parishRecordKey] ?? [] : [];
}
