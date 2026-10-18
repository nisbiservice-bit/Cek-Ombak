import { Region } from '../types';

export const INITIAL_REGIONS: Region[] = [
  // RW 01 (Dusun 1 & 2)
  { id: 'rw01_rt01', no: 1, dusun: 1, rw: '01', rt: '01', kampung: 'Bojongmenteng', baselineDpt: 168, remainingDpt: 168, voterCount: 0 },
  { id: 'rw01_rt02', no: 2, dusun: 1, rw: '01', rt: '02', kampung: 'Pasirhayam', baselineDpt: 194, remainingDpt: 194, voterCount: 0 },
  { id: 'rw01_rt03', no: 3, dusun: 1, rw: '01', rt: '03', kampung: 'Dengkeng', baselineDpt: 186, remainingDpt: 186, voterCount: 0 },
  { id: 'rw01_rt04', no: 4, dusun: 2, rw: '01', rt: '04', kampung: 'Ciheulang', baselineDpt: 180, remainingDpt: 180, voterCount: 0 },
  { id: 'rw01_rt05', no: 5, dusun: 2, rw: '01', rt: '05', kampung: 'Ciheulang', baselineDpt: 229, remainingDpt: 229, voterCount: 0 },
  { id: 'rw01_rt06', no: 6, dusun: 1, rw: '01', rt: '06', kampung: 'Bojongmenteng', baselineDpt: 82, remainingDpt: 82, voterCount: 0 },
  { id: 'rw01_rt07', no: 7, dusun: 1, rw: '01', rt: '07', kampung: 'Dengkeng', baselineDpt: 140, remainingDpt: 140, voterCount: 0 },

  // RW 02 (Dusun 2)
  { id: 'rw02_rt01', no: 8, dusun: 2, rw: '02', rt: '01', kampung: 'Ciheulang', baselineDpt: 169, remainingDpt: 169, voterCount: 0 },
  { id: 'rw02_rt02', no: 9, dusun: 2, rw: '02', rt: '02', kampung: 'Ciheulang', baselineDpt: 163, remainingDpt: 163, voterCount: 0 },
  { id: 'rw02_rt03', no: 10, dusun: 2, rw: '02', rt: '03', kampung: 'Ciheulang', baselineDpt: 167, remainingDpt: 167, voterCount: 0 },
  { id: 'rw02_rt04', no: 11, dusun: 2, rw: '02', rt: '04', kampung: 'Ciheulang', baselineDpt: 118, remainingDpt: 118, voterCount: 0 },
  { id: 'rw02_rt05', no: 12, dusun: 2, rw: '02', rt: '05', kampung: 'Ciheulang', baselineDpt: 158, remainingDpt: 158, voterCount: 0 },
  { id: 'rw02_rt06', no: 13, dusun: 2, rw: '02', rt: '06', kampung: 'Ciheulang', baselineDpt: 135, remainingDpt: 135, voterCount: 0 },
  { id: 'rw02_rt07', no: 14, dusun: 2, rw: '02', rt: '07', kampung: 'Ciheulang, Pasirleutik', baselineDpt: 149, remainingDpt: 149, voterCount: 0 },

  // RW 03 (Dusun 1, 3, 4)
  { id: 'rw03_rt01', no: 15, dusun: 1, rw: '03', rt: '01', kampung: 'Pasirkadu', baselineDpt: 189, remainingDpt: 189, voterCount: 0 },
  { id: 'rw03_rt02', no: 16, dusun: 1, rw: '03', rt: '02', kampung: 'Curugcandung', baselineDpt: 147, remainingDpt: 147, voterCount: 0 },
  { id: 'rw03_rt03', no: 17, dusun: 3, rw: '03', rt: '03', kampung: 'Pasirmalang', baselineDpt: 263, remainingDpt: 263, voterCount: 0 },
  { id: 'rw03_rt04', no: 18, dusun: 4, rw: '03', rt: '04', kampung: 'Karag', baselineDpt: 195, remainingDpt: 195, voterCount: 0 },
  { id: 'rw03_rt05', no: 19, dusun: 1, rw: '03', rt: '05', kampung: 'Pasirkadu', baselineDpt: 144, remainingDpt: 144, voterCount: 0 },
  { id: 'rw03_rt06', no: 20, dusun: 1, rw: '03', rt: '06', kampung: 'Pasirkadu', baselineDpt: 104, remainingDpt: 104, voterCount: 0 },

  // RW 04 (Dusun 3 & 4)
  { id: 'rw04_rt01', no: 21, dusun: 3, rw: '04', rt: '01', kampung: 'Karag', baselineDpt: 181, remainingDpt: 181, voterCount: 0 },
  { id: 'rw04_rt02', no: 22, dusun: 4, rw: '04', rt: '02', kampung: 'Karag', baselineDpt: 197, remainingDpt: 197, voterCount: 0 },
  { id: 'rw04_rt03', no: 23, dusun: 3, rw: '04', rt: '03', kampung: 'Karag', baselineDpt: 224, remainingDpt: 224, voterCount: 0 },
  { id: 'rw04_rt04', no: 24, dusun: 3, rw: '04', rt: '04', kampung: 'Jangga', baselineDpt: 101, remainingDpt: 101, voterCount: 0 },
  { id: 'rw04_rt05', no: 25, dusun: 3, rw: '04', rt: '05', kampung: 'Jangga', baselineDpt: 149, remainingDpt: 149, voterCount: 0 },
  { id: 'rw04_rt06', no: 26, dusun: 3, rw: '04', rt: '06', kampung: 'Jangga', baselineDpt: 126, remainingDpt: 126, voterCount: 0 },

  // RW 05 (Dusun 4)
  { id: 'rw05_rt01', no: 27, dusun: 4, rw: '05', rt: '01', kampung: 'Gombong', baselineDpt: 198, remainingDpt: 198, voterCount: 0 },
  { id: 'rw05_rt02', no: 28, dusun: 4, rw: '05', rt: '02', kampung: 'Cimalati', baselineDpt: 228, remainingDpt: 228, voterCount: 0 },
  { id: 'rw05_rt03', no: 29, dusun: 4, rw: '05', rt: '03', kampung: 'Cimalati', baselineDpt: 173, remainingDpt: 173, voterCount: 0 },
  { id: 'rw05_rt04', no: 30, dusun: 4, rw: '05', rt: '04', kampung: 'Pasirbentang', baselineDpt: 127, remainingDpt: 127, voterCount: 0 },
  { id: 'rw05_rt05', no: 31, dusun: 4, rw: '05', rt: '05', kampung: 'Pasirbentang', baselineDpt: 117, remainingDpt: 117, voterCount: 0 },
  { id: 'rw05_rt06', no: 32, dusun: 4, rw: '05', rt: '06', kampung: 'Bunut, Weleng, Psds', baselineDpt: 107, remainingDpt: 107, voterCount: 0 },

  // RW 06 (Dusun 3)
  { id: 'rw06_rt01', no: 33, dusun: 3, rw: '06', rt: '01', kampung: 'Nyantoni', baselineDpt: 170, remainingDpt: 170, voterCount: 0 },
  { id: 'rw06_rt02', no: 34, dusun: 3, rw: '06', rt: '02', kampung: 'Nyantoni, Dangdeur, Nyangkowek', baselineDpt: 135, remainingDpt: 135, voterCount: 0 },
  { id: 'rw06_rt03', no: 35, dusun: 3, rw: '06', rt: '03', kampung: 'Nyantoni, Pasirbukur', baselineDpt: 148, remainingDpt: 148, voterCount: 0 },
];

export const RW_LIST = ['01', '02', '03', '04', '05', '06'];

export function getRegion(rw: string, rt: string): Region | undefined {
  return INITIAL_REGIONS.find((r) => r.rw === rw && r.rt === rt);
}

export function getRTsForRW(rw: string): Region[] {
  return INITIAL_REGIONS.filter((r) => r.rw === rw);
}

export const GRAND_TOTAL_DPT = INITIAL_REGIONS.reduce((acc, curr) => acc + curr.baselineDpt, 0); // 5661
