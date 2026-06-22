"use client";

type Choice = "INTERESTED" | "NOT_INTERESTED" | "FOLLOW_UP";

type Props = {
  disabled?: boolean;
  onChoose: (choice: Choice) => void;
};

const OPTIONS: Array<{
  value: Choice;
  title: string;
  description: string;
}> = [
  {
    value: "INTERESTED",
    title: "Interested",
    description: "Continue into the property intake flow.",
  },
  {
    value: "NOT_INTERESTED",
    title: "Not Interested",
    description: "Log the outcome and return to the dashboard.",
  },
  {
    value: "FOLLOW_UP",
    title: "Follow Up",
    description: "Create a locked follow-up lead and schedule the next contact.",
  },
];

export function LeadStartChooser({ disabled = false, onChoose }: Props) {
  return (
    <div className="lead-start-chooser">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className="lead-start-chooser-card"
          onClick={() => onChoose(option.value)}
          disabled={disabled}
        >
          <span className="lead-start-chooser-title">{option.title}</span>
          <span className="lead-start-chooser-description">{option.description}</span>
        </button>
      ))}
    </div>
  );
}