export type TrialAcquisitionDays = 7 | 30 | 90;

export type TrialAcquisitionRow = {
  channel: string;
  trials: number;
  pct: number;
};

export type TrialAcquisitionResponse = {
  days: TrialAcquisitionDays;
  total_trials: number;
  rows: TrialAcquisitionRow[];
  fetched_at: string;
};
