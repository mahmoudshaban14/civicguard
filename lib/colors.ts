export const colors = {
  navy: "#17375F",
  blue: "#3478F6",
  teal: "#20A889",
  primary: "#3478F6",
  primaryHover: "#2366DF",
  success: "#20A889",
  warning: "#F3A847",
  danger: "#D9534F",
  info: "#3478F6",
  background: "#F5F7FB",
  surface: "#FFFFFF",
  border: "#E8EDF4",
  text: "#182230",
  textMuted: "#8490A3",
  disabled: "#D8DEE8",
  white: "#FFFFFF",
  black: "#000000",
} as const;

export type CivicGuardColors = typeof colors;
