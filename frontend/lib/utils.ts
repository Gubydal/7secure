export const formatDate = (date: string): string =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(date));

export const getCategoryLabel = (category: string): string =>
  category.replace(/-/g, " ");
