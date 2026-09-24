export const CATEGORIES = [
  { slug: "politics", label: "Politics" },
  { slug: "business", label: "Business" },
  { slug: "technology", label: "Technology" },
  { slug: "sports", label: "Sports" },
  { slug: "entertainment", label: "Entertainment" },
  { slug: "health", label: "Health" },
];

export const CATEGORY_BADGE = {
  politics: "bg-amber-100 text-amber-900 border-amber-300",
  business: "bg-emerald-100 text-emerald-900 border-emerald-300",
  technology: "bg-blue-100 text-blue-900 border-blue-300",
  sports: "bg-orange-100 text-orange-900 border-orange-300",
  entertainment: "bg-purple-100 text-purple-900 border-purple-300",
  health: "bg-rose-100 text-rose-900 border-rose-300",
};

export const categoryLabel = (slug) =>
  CATEGORIES.find((c) => c.slug === slug)?.label || slug;

export const STATUS_PENDING = "Rewritten_Pending_Publish";
export const STATUS_PUBLISHED = "Published";
