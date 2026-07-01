let markTrialActivatedFailureCount = 0;

export function incrementTrialTrackingFailureCount(): void {
  markTrialActivatedFailureCount += 1;
}

export function getTrialTrackingFailureCount(): number {
  return markTrialActivatedFailureCount;
}

export function resetTrialTrackingFailureCount(): void {
  markTrialActivatedFailureCount = 0;
}
