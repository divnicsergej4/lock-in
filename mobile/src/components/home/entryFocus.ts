// Lets other parts of Home (the reminder's "Log now") put the cursor in New entry's amount field.
export const entryFocus: { current: (() => void) | null } = { current: null };
