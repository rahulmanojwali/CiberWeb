type StepUpTrigger = (
  resourceKey?: string | null,
  action?: string,
  opts?: { source?: string },
) => Promise<boolean>;

let stepUpTrigger: StepUpTrigger | null = null;

export function registerStepUpTrigger(trigger: StepUpTrigger | null) {
  stepUpTrigger = trigger;
}

export function isStepUpReady(): boolean {
  return stepUpTrigger !== null;
}

export async function triggerStepUp(resourceKey?: string | null, action: string = "VIEW") {
  if (!stepUpTrigger) {
    return false;
  }
  return stepUpTrigger(resourceKey, action, { source: "STEPUP_CLIENT" });
}
