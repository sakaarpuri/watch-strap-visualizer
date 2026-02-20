interface StepperProps {
  currentStep: number;
  steps?: string[];
}

const DEFAULT_STEPS = ["Select Watch", "Upload Strap", "Preview"];

export default function Stepper({ currentStep, steps = DEFAULT_STEPS }: StepperProps) {
  return (
    <ol className="grid w-full grid-cols-3 gap-4">
      {steps.map((label, index) => {
        const step = index + 1;
        const isActive = step === currentStep;
        const isDone = step < currentStep;

        return (
          <li
            key={label}
            className="rounded-xl border border-line px-4 py-3"
          >
            <p className="text-xs uppercase tracking-[0.16em] text-muted">
              Step {step}
            </p>
            <p
              className={`mt-1 text-sm font-medium ${
                isActive || isDone ? "text-ink" : "text-muted"
              }`}
            >
              {label}
            </p>
            <div
              className={`mt-3 h-1 rounded-full ${
                isDone ? "bg-ink" : isActive ? "bg-neutral-400" : "bg-line"
              }`}
            />
          </li>
        );
      })}
    </ol>
  );
}
